-- ============================================================================
-- Migración: los pagos de operaciones (VENTA / COMPRA / GASTO) ya no crean una
-- operación MOVIMIENTO_CUENTA intermedia.
--
-- Antes: un pago posterior creaba una operación MOVIMIENTO_CUENTA (con su
-- operaciones_movimiento_cuenta), que aparecía como un GASTO/INGRESO más en la
-- lista de operaciones y duplicaba el monto en las estadísticas. El pago inicial
-- (al crear la operación), en cambio, solo escribía el ledger + operaciones_pagos.
--
-- Ahora: ambos caminos son iguales. El pago es una fila de operaciones_pagos
-- (detalle) y un asiento en movimientos_financieros con operacion_id = la
-- operación original (asiento). No se crea ninguna operación adicional.
-- Los arreglos (cobros) no se tocan.
-- ============================================================================

-- 1. Idempotencia en operaciones_pagos (antes vivía en operaciones_movimiento_cuenta)
ALTER TABLE public.operaciones_pagos
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS operaciones_pagos_tenant_idempotency_key
  ON public.operaciones_pagos USING btree (tenant_id, idempotency_key)
  WHERE (idempotency_key IS NOT NULL);

-- 2. Backfill: eliminar las operaciones MOVIMIENTO_CUENTA que eran pagos
--    y reapuntar sus asientos del ledger a la operación original.
ALTER TABLE public.operaciones_movimiento_cuenta DISABLE TRIGGER omc_after_delete;

DO $$
DECLARE
  r record;
BEGIN
  -- El ledger es inmutable salvo en modo cleanup (mismo flag que usan las RPC de borrado)
  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);

  FOR r IN
    SELECT p.id AS pago_id, p.operacion_id, p.operacion_pago_id
    FROM public.operaciones_pagos AS p
    WHERE p.operacion_pago_id IS NOT NULL
  LOOP
    UPDATE public.movimientos_financieros
    SET operacion_id = r.operacion_id
    WHERE operacion_id = r.operacion_pago_id;

    UPDATE public.operaciones_pagos AS p
    SET idempotency_key = omc.idempotency_key,
        descripcion = COALESCE(p.descripcion, omc.descripcion)
    FROM public.operaciones_movimiento_cuenta AS omc
    WHERE p.id = r.pago_id
      AND omc.operacion_id = r.operacion_pago_id;

    -- Desvincular antes de borrar para que el ON DELETE CASCADE no elimine el pago
    UPDATE public.operaciones_pagos
    SET operacion_pago_id = NULL
    WHERE id = r.pago_id;

    DELETE FROM public.operaciones
    WHERE id = r.operacion_pago_id
      AND tipo = 'MOVIMIENTO_CUENTA';
  END LOOP;

  PERFORM set_config('app.finanzas_tenant_cleanup', 'off', true);
END $$;

ALTER TABLE public.operaciones_movimiento_cuenta ENABLE TRIGGER omc_after_delete;

-- 3. La columna operacion_pago_id ya no tiene sentido
DROP INDEX IF EXISTS public.idx_operaciones_pagos_pago_id;
ALTER TABLE public.operaciones_pagos DROP COLUMN IF EXISTS operacion_pago_id;

-- 4. rpc_registrar_pago_operacion: ledger + operaciones_pagos, sin operación intermedia
CREATE OR REPLACE FUNCTION public.rpc_registrar_pago_operacion (
  p_operacion_id       uuid,
  p_cuenta_id          uuid,
  p_monto              numeric,
  p_fecha              timestamp with time zone DEFAULT now(),
  p_descripcion        text                     DEFAULT NULL::text,
  p_idempotency_key    uuid                     DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id          uuid := public.current_tenant_id();
  v_op                 record;
  v_pago_existente     uuid;
  v_saldo_pendiente    numeric;
  v_pago_id            uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificar una cuenta financiera' USING ERRCODE = '22023';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a 0' USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

  -- Idempotencia
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':pago:' || p_idempotency_key::text));

    SELECT op.id
    INTO v_pago_existente
    FROM public.operaciones_pagos AS op
    WHERE op.tenant_id = v_tenant_id AND op.idempotency_key = p_idempotency_key;

    IF v_pago_existente IS NOT NULL THEN
      SELECT monto_total, total_pagado, esta_pago, estado_pago
      INTO v_op FROM public.operaciones WHERE id = p_operacion_id;

      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'operacion_id', p_operacion_id,
        'pago_id', v_pago_existente,
        'total_pagado', v_op.total_pagado,
        'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
        'esta_pago', v_op.esta_pago,
        'estado_pago', v_op.estado_pago
      );
    END IF;
  END IF;

  SELECT id, tipo, monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_op.tipo NOT IN ('VENTA', 'COMPRA', 'GASTO') THEN
    RAISE EXCEPTION 'La operación de tipo % no admite pagos', v_op.tipo USING ERRCODE = '22023';
  END IF;

  v_saldo_pendiente := GREATEST(0, COALESCE(v_op.monto_total, 0) - COALESCE(v_op.total_pagado, 0));
  IF v_saldo_pendiente <= 0 THEN
    RAISE EXCEPTION 'Esta operación ya se encuentra totalmente saldada' USING ERRCODE = '22023';
  END IF;

  IF p_monto > v_saldo_pendiente THEN
    RAISE EXCEPTION 'El monto ingresado ($%) supera el saldo pendiente ($%)', p_monto, v_saldo_pendiente
      USING ERRCODE = '22023';
  END IF;

  -- Asiento en el ledger asociado a la operación original (ventas suman, compras y gastos restan)
  PERFORM public._ledger_insertar(
    p_operacion_id,
    v_tenant_id,
    p_cuenta_id,
    CASE WHEN v_op.tipo = 'VENTA' THEN p_monto ELSE -p_monto END,
    COALESCE(p_fecha, now())
  );

  -- Detalle del pago (el trigger recalcula total_pagado, esta_pago y estado_pago)
  INSERT INTO public.operaciones_pagos (
    tenant_id,
    operacion_id,
    cuenta_financiera_id,
    monto,
    fecha,
    descripcion,
    idempotency_key,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_operacion_id,
    p_cuenta_id,
    p_monto,
    COALESCE(p_fecha, now()),
    COALESCE(
      NULLIF(btrim(p_descripcion), ''),
      CASE
        WHEN v_op.tipo = 'VENTA' THEN 'Cobro de venta'
        WHEN v_op.tipo = 'COMPRA' THEN 'Pago de compra'
        ELSE 'Pago de gasto'
      END
    ),
    p_idempotency_key,
    auth.uid()
  )
  RETURNING id INTO v_pago_id;

  -- Leer estado resultante actualizado
  SELECT monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'pago_id', v_pago_id,
    'monto_registrado', p_monto,
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_registrar_pago_operacion(uuid, uuid, numeric, timestamp with time zone, text, uuid) TO authenticated, service_role, postgres;

-- 5. rpc_finanzas_anular_pago_operacion: una sola rama (contraasiento + borrar el pago)
CREATE OR REPLACE FUNCTION public.rpc_finanzas_anular_pago_operacion (
  p_operacion_id uuid,
  p_pago_id      uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id        uuid := public.current_tenant_id();
  v_op               record;
  v_pago             record;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_operacion_id IS NULL OR p_pago_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos' USING ERRCODE = '22023';
  END IF;

  -- Bloquear operación para actualización y verificar pertenencia al tenant
  SELECT id, tipo, monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_op.tipo NOT IN ('VENTA', 'COMPRA', 'GASTO') THEN
    RAISE EXCEPTION 'La operación de tipo % no admite pagos', v_op.tipo USING ERRCODE = '22023';
  END IF;

  SELECT id, cuenta_financiera_id, monto
  INTO v_pago
  FROM public.operaciones_pagos
  WHERE operacion_id = p_operacion_id
    AND tenant_id = v_tenant_id
    AND id = p_pago_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado para esta operación' USING ERRCODE = 'P0002';
  END IF;

  -- Contraasiento (el ledger es inmutable). Queda asociado a la operación para que,
  -- si la operación se borra, el conjunto asiento + contraasiento se revierta a cero.
  PERFORM public._ledger_insertar(
    p_operacion_id,
    v_tenant_id,
    v_pago.cuenta_financiera_id,
    CASE WHEN v_op.tipo = 'VENTA' THEN -v_pago.monto ELSE v_pago.monto END,
    now()
  );

  -- El trigger de operaciones_pagos recalcula total_pagado, esta_pago y estado_pago
  DELETE FROM public.operaciones_pagos
  WHERE id = v_pago.id
    AND tenant_id = v_tenant_id;

  -- Consultar valores actualizados post-triggers
  SELECT monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'anulada_pago_id', v_pago.id,
    'importe_anulado', v_pago.monto,
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_finanzas_anular_pago_operacion(uuid, uuid) TO authenticated, service_role, postgres;

-- 6. rpc_listar_movimientos_cuenta: sin operaciones intermedias, tipo y descripción desde la operación
CREATE OR REPLACE FUNCTION public.rpc_listar_movimientos_cuenta (
  p_cuenta_id uuid,
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_limit     integer                  DEFAULT 100,
  p_offset    integer                  DEFAULT 0
)
  RETURNS TABLE (
    id                   uuid,
    cuenta_financiera_id uuid,
    importe              numeric,
    fecha                timestamp with time zone,
    created_at           timestamp with time zone,
    operacion_id         uuid,
    tipo                 text,
    descripcion          text,
    categoria_gasto      text,
    arreglo_id           uuid
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  SELECT
    m.id,
    m.cuenta_financiera_id,
    m.importe,
    m.fecha,
    m.created_at,
    m.operacion_id,
    CASE
      WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
      WHEN o.tipo IN ('VENTA', 'COMPRA', 'GASTO') THEN o.tipo::text
      ELSE COALESCE(omc.subtipo, o.tipo::text, 'MOVIMIENTO')
    END AS tipo,
    CASE
      -- Contraasiento de un pago anulado: ventas restan, compras y gastos suman
      WHEN o.tipo = 'VENTA' AND m.importe < 0 THEN 'Anulación de cobro'
      WHEN o.tipo IN ('COMPRA', 'GASTO') AND m.importe > 0 THEN 'Anulación de pago'
      ELSE COALESCE(
        omc.descripcion,
        op.descripcion,
        og.descripcion,
        o.observaciones,
        CASE
          WHEN o.tipo = 'VENTA' THEN 'Cobro de venta'
          WHEN o.tipo = 'COMPRA' THEN 'Pago de compra'
          WHEN o.tipo = 'GASTO' THEN 'Pago de gasto'
          ELSE NULL
        END
      )
    END AS descripcion,
    COALESCE(omc.categoria_gasto, og.categoria_gasto) AS categoria_gasto,
    COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id
  FROM public.movimientos_financieros AS m
  LEFT JOIN public.operaciones AS o ON o.id = m.operacion_id
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = m.operacion_id
  LEFT JOIN public.operaciones_gasto AS og ON og.operacion_id = m.operacion_id
  LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = m.operacion_id
  LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = m.operacion_id
  LEFT JOIN LATERAL (
    SELECT op_sub.descripcion
    FROM public.operaciones_pagos AS op_sub
    WHERE op_sub.operacion_id = m.operacion_id
      AND op_sub.cuenta_financiera_id = m.cuenta_financiera_id
      AND op_sub.monto = abs(m.importe)
      AND op_sub.tenant_id = m.tenant_id
    ORDER BY op_sub.created_at DESC
    LIMIT 1
  ) AS op ON true
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to IS NULL OR m.fecha < p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp with time zone, timestamp with time zone, integer, integer) TO anon, authenticated, service_role, postgres;

-- 7. rpc_operaciones_stats: los gastos creados como operación GASTO (sin omc ni líneas) usan monto_total
CREATE OR REPLACE FUNCTION public.rpc_operaciones_stats (
  p_from  timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to    timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_tipos text[]                   DEFAULT NULL::text[]
)
  RETURNS TABLE (
    ventas       numeric,
    compras      numeric,
    asignaciones numeric,
    cobros       numeric,
    gastos       numeric,
    neto         numeric
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  WITH base AS (
    SELECT
      CASE
        WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
        ELSE COALESCE(omc.subtipo, o.tipo::text)
      END AS tipo,
      COALESCE(
        abs(omc.importe),
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id),
        o.monto_total
      ) AS monto
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = o.id
    LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
      AND (
        COALESCE(cardinality(p_tipos), 0) = 0
        OR CASE WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO' ELSE COALESCE(omc.subtipo, o.tipo::text) END = ANY(p_tipos)
      )
  )
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'VENTA' THEN monto ELSE 0 END), 0) AS ventas,
    COALESCE(SUM(CASE WHEN tipo = 'COMPRA' THEN monto ELSE 0 END), 0) AS compras,
    COALESCE(SUM(CASE WHEN tipo = 'ASIGNACION_ARREGLO' THEN monto ELSE 0 END), 0) AS asignaciones,
    COALESCE(SUM(CASE WHEN tipo = 'COBRO_ARREGLO' THEN monto ELSE 0 END), 0) AS cobros,
    COALESCE(SUM(CASE WHEN tipo = 'GASTO' THEN monto ELSE 0 END), 0) AS gastos,
    COALESCE(SUM(CASE
      WHEN tipo IN ('VENTA', 'INGRESO', 'COBRO_ARREGLO') THEN monto
      WHEN tipo IN ('COMPRA', 'GASTO') THEN -monto
      ELSE 0
    END), 0) AS neto
  FROM base;
$function$;

-- 8. dashboard_gastos_por_periodo: gastos eventuales = gastos manuales (MOVIMIENTO_CUENTA)
--    + operaciones GASTO (monto_total). Los pagos de gastos ya no son operaciones propias.
CREATE OR REPLACE FUNCTION public.dashboard_gastos_por_periodo(p_from timestamp with time zone, p_to timestamp with time zone, p_taller_id uuid DEFAULT NULL::uuid)
  RETURNS TABLE(label text, repuestos numeric, sueldos numeric, eventuales numeric)
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);
  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc(b.trunc_name, (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      b.step
    ) AS slot_start
  ),
  compras AS (
    SELECT date_trunc(b.trunc_name, o.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS rep
    FROM public.operaciones AS o
    JOIN public.operaciones_lineas AS ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'COMPRA'::public.tipo_operacion
      AND o.tenant_id = (SELECT public.current_tenant_id())
      AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(
      date_trunc('month', (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc('month', (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      interval '1 month'
    ) AS mes_start
  ),
  sueldo_mes AS (
    SELECT m.mes_start, COALESCE(lat.sueldos, 0)::numeric AS sueldos
    FROM meses AS m
    LEFT JOIN LATERAL (
      SELECT SUM(eff.salario) AS sueldos
      FROM (
        SELECT DISTINCT ON (es.empleado_id) es.salario
        FROM public.empleado_salarios AS es
        JOIN public.empleados AS e ON e.id = es.empleado_id
        WHERE e.tenant_id = (SELECT public.current_tenant_id())
          AND (p_taller_id IS NULL OR e.taller_id = p_taller_id)
          AND es.vigente_desde < (m.mes_start + interval '1 month')::date
          AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
        ORDER BY es.empleado_id, es.vigente_desde DESC
      ) AS eff
    ) AS lat ON true
  ),
  gastos_eventuales AS (
    SELECT date_trunc(b.trunc_name, g.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS slot_start,
           COALESCE(SUM(g.monto), 0)::numeric AS eventual
    FROM (
      SELECT o.fecha, o.taller_id, abs(omc.importe) AS monto
      FROM public.operaciones_movimiento_cuenta AS omc
      JOIN public.operaciones AS o ON o.id = omc.operacion_id
      WHERE omc.subtipo = 'GASTO'
        AND o.tipo = 'MOVIMIENTO_CUENTA'::public.tipo_operacion
        AND omc.tenant_id = (SELECT public.current_tenant_id())
      UNION ALL
      SELECT o.fecha, o.taller_id, o.monto_total AS monto
      FROM public.operaciones AS o
      WHERE o.tipo = 'GASTO'::public.tipo_operacion
        AND o.tenant_id = (SELECT public.current_tenant_id())
    ) AS g
    WHERE g.fecha >= p_from AND g.fecha < p_to
      AND (p_taller_id IS NULL OR g.taller_id = p_taller_id OR g.taller_id IS NULL)
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt),
         COALESCE(c.rep, 0), COALESCE(sm.sueldos, 0), COALESCE(ge.eventual, 0)
  FROM slots AS s
  LEFT JOIN compras AS c USING (slot_start)
  LEFT JOIN sueldo_mes AS sm ON date_trunc(b.trunc_name, sm.mes_start) = s.slot_start
  LEFT JOIN gastos_eventuales AS ge USING (slot_start)
  ORDER BY s.slot_start;
END;
$function$;
