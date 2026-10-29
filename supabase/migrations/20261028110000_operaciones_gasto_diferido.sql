-- ============================================================================
-- Migración: Operaciones de Gasto diferidas y tablas de asociación
-- Permite que las operaciones de tipo GASTO soporten pagos diferidos, parciales,
-- múltiples cuentas y trazabilidad unificada igual que COMPRA y VENTA.
-- ============================================================================

-- 1. Modificar constraint de taller para permitir tipo GASTO sin taller obligatorio
ALTER TABLE public.operaciones
  DROP CONSTRAINT IF EXISTS operaciones_taller_requerido;

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_taller_requerido
  CHECK (((taller_id IS NOT NULL) OR ((tipo)::text IN ('MOVIMIENTO_CUENTA', 'GASTO'))));

-- 2. Crear tabla public.operaciones_gasto
CREATE TABLE IF NOT EXISTS public.operaciones_gasto (
  operacion_id    uuid NOT NULL,
  tenant_id       uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  categoria_gasto text NOT NULL,
  descripcion     text,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT operaciones_gasto_pkey PRIMARY KEY (operacion_id),
  CONSTRAINT operaciones_gasto_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT operaciones_gasto_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE public.operaciones_gasto DROP COLUMN IF EXISTS proveedor_id;
DROP INDEX IF EXISTS public.idx_op_gasto_proveedor;

ALTER TABLE public.operaciones_gasto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_access ON public.operaciones_gasto;
CREATE POLICY tenant_access ON public.operaciones_gasto
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_op_gasto_tenant ON public.operaciones_gasto USING btree (tenant_id);

GRANT ALL ON TABLE public.operaciones_gasto TO "anon", "authenticated", "service_role", "postgres";

-- 3. Backfill de gastos históricos desde operaciones_movimiento_cuenta
DO $$
BEGIN
  -- 3.1. Poblar operaciones_gasto con categoría y descripción históricas
  INSERT INTO public.operaciones_gasto (operacion_id, tenant_id, categoria_gasto, descripcion, created_at)
  SELECT
    omc.operacion_id,
    omc.tenant_id,
    COALESCE(NULLIF(btrim(omc.categoria_gasto), ''), 'General'),
    NULLIF(btrim(omc.descripcion), ''),
    omc.created_at
  FROM public.operaciones_movimiento_cuenta omc
  JOIN public.operaciones o ON o.id = omc.operacion_id
  WHERE omc.subtipo = 'GASTO'
  ON CONFLICT (operacion_id) DO UPDATE
    SET categoria_gasto = EXCLUDED.categoria_gasto,
        descripcion = COALESCE(EXCLUDED.descripcion, operaciones_gasto.descripcion);

  -- 3.2. Actualizar la tabla operaciones: tipo GASTO, monto_total y marcar pagadas completamente
  UPDATE public.operaciones o
  SET
    tipo = 'GASTO',
    monto_total = COALESCE(NULLIF(o.monto_total, 0), abs(omc.importe), 0),
    total_pagado = COALESCE(NULLIF(o.monto_total, 0), abs(omc.importe), 0),
    esta_pago = true,
    estado_pago = 'PAGADO'::public.estado_pago_operacion,
    estado_stock = 'NO_APLICA'::public.estado_stock_operacion
  FROM public.operaciones_movimiento_cuenta omc
  WHERE omc.operacion_id = o.id
    AND omc.subtipo = 'GASTO';

  -- 3.4. Crear el registro en operaciones_pagos para reflejar el pago completo inicial y su cuenta financiera
  INSERT INTO public.operaciones_pagos (
    tenant_id,
    operacion_id,
    operacion_pago_id,
    cuenta_financiera_id,
    monto,
    fecha,
    descripcion,
    created_at
  )
  SELECT
    o.tenant_id,
    o.id,
    NULL,
    omc.cuenta_id,
    abs(omc.importe),
    COALESCE(o.fecha, omc.created_at, now()),
    COALESCE(NULLIF(btrim(omc.descripcion), ''), 'Pago de gasto registrado'),
    COALESCE(omc.created_at, o.created_at, now())
  FROM public.operaciones o
  JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = o.id
  WHERE omc.subtipo = 'GASTO'
    AND omc.cuenta_id IS NOT NULL
    AND abs(omc.importe) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.operaciones_pagos op WHERE op.operacion_id = o.id
    );

  -- 3.5. Re-asegurar que cualquier gasto histórico quede con estado_pago = PAGADO y total_pagado sincronizado
  UPDATE public.operaciones o
  SET
    total_pagado = o.monto_total,
    esta_pago = true,
    estado_pago = 'PAGADO'::public.estado_pago_operacion,
    estado_stock = 'NO_APLICA'::public.estado_stock_operacion
  WHERE o.tipo = 'GASTO'
    AND o.monto_total > 0
    AND (o.total_pagado < o.monto_total OR o.estado_pago IS NULL OR o.estado_pago != 'PAGADO' OR NOT o.esta_pago)
    AND EXISTS (
      SELECT 1 FROM public.operaciones_movimiento_cuenta omc
      WHERE omc.operacion_id = o.id AND omc.subtipo = 'GASTO'
    );
END $$;

-- 4. Crear RPC rpc_crear_operacion_gasto
CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_gasto (
  p_categoria_gasto text,
  p_monto           numeric,
  p_descripcion     text                     DEFAULT NULL::text,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_observaciones   text                     DEFAULT NULL::text,
  p_taller_id       uuid                     DEFAULT NULL::uuid,
  p_proveedor_id    uuid                     DEFAULT NULL::uuid,
  p_estado_pago     text                     DEFAULT NULL::text,
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_monto_inicial   numeric                  DEFAULT NULL::numeric,
  p_pagos           jsonb                    DEFAULT NULL::jsonb,
  p_idempotency_key uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id         uuid := public.current_tenant_id();
  v_operacion_id      uuid;
  v_estado_pago       public.estado_pago_operacion;
  v_monto_pago        numeric := 0;
  v_tiene_pagos       boolean := false;
  v_pago              jsonb;
  v_pago_cuenta_id    uuid;
  v_pago_monto        numeric;
  v_pago_fecha        timestamp with time zone;
  v_pago_desc         text;
  v_monto_total_pagos numeric := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_categoria_gasto IS NULL OR btrim(p_categoria_gasto) = '' THEN
    RAISE EXCEPTION 'categoria_gasto es requerida' USING ERRCODE = '22023';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del gasto debe ser mayor a 0' USING ERRCODE = '22023';
  END IF;

  IF p_proveedor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.proveedores WHERE id = p_proveedor_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Proveedor no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_taller_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.talleres WHERE id = p_taller_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Taller no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_tiene_pagos := (p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0);

  IF p_estado_pago IS NOT NULL THEN
    v_estado_pago := upper(p_estado_pago)::public.estado_pago_operacion;
  ELSIF v_tiene_pagos THEN
    v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSIF p_cuenta_id IS NOT NULL THEN
    v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSE
    v_estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
  END IF;

  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;

  -- Insertar operación de tipo GASTO
  INSERT INTO public.operaciones (
    tenant_id, tipo, taller_id, fecha, observaciones,
    monto_total, total_pagado, esta_pago,
    estado_pago, estado_stock
  )
  VALUES (
    v_tenant_id, 'GASTO', p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''),
    p_monto, 0, false,
    v_estado_pago, 'NO_APLICA'
  )
  RETURNING id INTO v_operacion_id;

  -- Asociar en operaciones_gasto
  INSERT INTO public.operaciones_gasto (
    operacion_id, tenant_id, categoria_gasto, descripcion
  )
  VALUES (
    v_operacion_id, v_tenant_id, btrim(p_categoria_gasto), NULLIF(btrim(p_descripcion), '')
  );

  -- Procesar pagos múltiples si fueron provistos
  IF v_tiene_pagos THEN
    v_monto_total_pagos := 0;
    FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos) LOOP
      v_pago_cuenta_id := (v_pago->>'cuenta_id')::uuid;
      v_pago_monto := coalesce((v_pago->>'monto')::numeric, 0);
      v_pago_fecha := coalesce((v_pago->>'fecha')::timestamptz, coalesce(p_fecha, now()));
      v_pago_desc := v_pago->>'descripcion';

      IF v_pago_cuenta_id IS NOT NULL AND v_pago_monto > 0 THEN
        PERFORM public._finanzas_exigir_cuenta(v_pago_cuenta_id, v_tenant_id, true);
        v_monto_total_pagos := v_monto_total_pagos + v_pago_monto;

        -- Flujo de salida: debita de la cuenta financiera
        PERFORM public._ledger_insertar(v_operacion_id, v_tenant_id, v_pago_cuenta_id, -v_pago_monto, v_pago_fecha);

        INSERT INTO public.operaciones_pagos (
          tenant_id,
          operacion_id,
          cuenta_financiera_id,
          monto,
          fecha,
          descripcion
        )
        VALUES (
          v_tenant_id,
          v_operacion_id,
          v_pago_cuenta_id,
          v_pago_monto,
          v_pago_fecha,
          coalesce(v_pago_desc, 'Pago inicial al registrar gasto #' || substr(v_operacion_id::text, 1, 8))
        );
      END IF;
    END LOOP;

    IF v_monto_total_pagos >= p_monto AND p_monto > 0 THEN
      v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
    ELSIF v_monto_total_pagos > 0 THEN
      v_estado_pago := 'PARCIAL'::public.estado_pago_operacion;
    ELSE
      v_estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
    END IF;

    UPDATE public.operaciones
    SET estado_pago = v_estado_pago,
        total_pagado = v_monto_total_pagos,
        esta_pago = (v_monto_total_pagos >= p_monto AND p_monto > 0)
    WHERE id = v_operacion_id;

  ELSE
    -- Comportamiento con cuenta única
    IF p_cuenta_id IS NOT NULL THEN
      IF v_estado_pago = 'PAGADO' THEN
        v_monto_pago := p_monto;
      ELSIF v_estado_pago = 'PARCIAL' THEN
        IF p_monto_inicial IS NULL OR p_monto_inicial <= 0 OR p_monto_inicial >= p_monto THEN
          RAISE EXCEPTION 'Para estado de pago PARCIAL debe indicar un monto inicial válido menor al total' USING ERRCODE = '22023';
        END IF;
        v_monto_pago := p_monto_inicial;
      END IF;
    ELSE
      v_monto_pago := 0;
    END IF;

    IF p_cuenta_id IS NOT NULL AND v_monto_pago > 0 THEN
      PERFORM public._ledger_insertar(v_operacion_id, v_tenant_id, p_cuenta_id, -v_monto_pago, p_fecha);

      INSERT INTO public.operaciones_pagos (
        tenant_id,
        operacion_id,
        cuenta_financiera_id,
        monto,
        fecha,
        descripcion
      )
      VALUES (
        v_tenant_id,
        v_operacion_id,
        p_cuenta_id,
        v_monto_pago,
        COALESCE(p_fecha, now()),
        'Pago inicial al registrar gasto #' || substr(v_operacion_id::text, 1, 8)
      );

      IF v_monto_pago >= p_monto AND p_monto > 0 THEN
        v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
      ELSIF v_monto_pago > 0 THEN
        v_estado_pago := 'PARCIAL'::public.estado_pago_operacion;
      ELSE
        v_estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
      END IF;

      UPDATE public.operaciones
      SET estado_pago = v_estado_pago,
          total_pagado = v_monto_pago,
          esta_pago = (v_monto_pago >= p_monto AND p_monto > 0)
      WHERE id = v_operacion_id;
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_gasto(text, numeric, text, timestamp with time zone, text, uuid, uuid, text, uuid, numeric, jsonb, uuid) TO "anon", "authenticated", "service_role", "postgres";

-- 5. Actualizar rpc_listar_operaciones_con_gastos
CREATE OR REPLACE FUNCTION public.rpc_listar_operaciones_con_gastos (
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_tipos     text[]                   DEFAULT NULL::text[],
  p_page      integer                  DEFAULT 1,
  p_page_size integer                  DEFAULT 50
)
  RETURNS TABLE (
    id                       uuid,
    tipo                     text,
    taller_id                uuid,
    fecha                    timestamp with time zone,
    created_at               timestamp with time zone,
    lineas                   jsonb,
    gasto_id                 uuid,
    descripcion              text,
    categoria_gasto          text,
    cuenta_financiera_id     uuid,
    cuenta_financiera_nombre text,
    monto                    numeric,
    monto_total              numeric,
    total_pagado             numeric,
    saldo_pendiente          numeric,
    esta_pago                boolean,
    estado_pago              text,
    estado_stock             text,
    arreglo_id               uuid,
    total_count              bigint,
    observaciones            text,
    proveedor_id             uuid,
    proveedor_nombre         text,
    cliente_id               uuid,
    cliente_nombre           text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  WITH rows AS (
    SELECT
      o.id,
      CASE
        WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
        ELSE COALESCE(omc.subtipo, o.tipo::text)
      END AS tipo,
      o.taller_id, o.fecha, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id,
          'cantidad', l.cantidad, 'cantidad_cumplida', l.cantidad_cumplida,
          'monto_unitario', l.monto_unitario, 'delta_cantidad', l.delta_cantidad,
          'created_at', l.created_at, 'nombre', p.nombre, 'codigo', p.codigo
        ) ORDER BY l.created_at, l.id)
        FROM public.operaciones_lineas AS l
        LEFT JOIN public.stocks AS s ON s.id = l.stock_id
        LEFT JOIN public.productos AS p ON p.id = s.producto_id
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb) AS lineas,
      CASE WHEN omc.subtipo = 'GASTO' OR o.tipo = 'GASTO' THEN o.id ELSE NULL END AS gasto_id,
      CASE
        WHEN o.tipo = 'ASIGNACION_ARREGLO' AND v.id IS NOT NULL THEN
          'Asignación · ' || TRIM(v.marca || ' ' || v.modelo) || ' (' || v.patente || ')'
        WHEN EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones d WHERE d.operacion_ajuste_id = o.id) THEN
          'Devolución por NC · ' || COALESCE((
            SELECT 'NC ' || COALESCE(n.numero_comprobante::text, n.id::text)
              || ' · Factura ' || COALESCE(f.numero_comprobante::text, f.id::text)
            FROM public.facturacion_nc_devoluciones d
            JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id
            JOIN public.facturas_electronicas f ON f.id = n.documento_asociado_id
            WHERE d.operacion_ajuste_id = o.id LIMIT 1
          ), '')
        ELSE COALESCE(og.descripcion, omc.descripcion)
      END AS descripcion,
      COALESCE(og.categoria_gasto, omc.categoria_gasto) AS categoria_gasto,
      COALESCE(omc.cuenta_id, omc.cuenta_origen_id, op_first.cuenta_financiera_id, mf.cuenta_financiera_id) AS cuenta_financiera_id,
      COALESCE(cf_s.nombre, cf_o.nombre, cf_op.nombre, cf_m.nombre) AS cuenta_financiera_nombre,
      COALESCE(
        NULLIF(o.monto_total, 0),
        abs(omc.importe),
        abs(mf.importe),
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
      )::numeric AS monto,
      o.monto_total,
      o.total_pagado,
      GREATEST(0, COALESCE(o.monto_total, 0) - COALESCE(o.total_pagado, 0))::numeric AS saldo_pendiente,
      COALESCE(o.esta_pago, false) AS esta_pago,
      o.estado_pago::text AS estado_pago,
      o.estado_stock::text AS estado_stock,
      COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id,
      o.observaciones,
      oc.proveedor_id,
      prov.nombre AS proveedor_nombre,
      ov.cliente_id,
      COALESCE(NULLIF(TRIM(concat(part.nombre, ' ', COALESCE(part.apellido, ''))), ''), emp.nombre) AS cliente_nombre
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = o.id
    LEFT JOIN public.operaciones_gasto AS og ON og.operacion_id = o.id
    LEFT JOIN LATERAL (
      SELECT m.cuenta_financiera_id, m.importe
      FROM public.movimientos_financieros AS m
      WHERE m.operacion_id = o.id AND m.tenant_id = o.tenant_id
      ORDER BY m.created_at, m.id
      LIMIT 1
    ) AS mf ON true
    LEFT JOIN LATERAL (
      SELECT op.cuenta_financiera_id, op.monto
      FROM public.operaciones_pagos AS op
      WHERE op.operacion_id = o.id AND op.tenant_id = o.tenant_id
      ORDER BY op.created_at, op.id
      LIMIT 1
    ) AS op_first ON true
    LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
    LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = o.id
    LEFT JOIN public.operaciones_venta AS ov ON ov.operacion_id = o.id
    LEFT JOIN public.particulares AS part ON part.id = ov.cliente_id
    LEFT JOIN public.empresas AS emp ON emp.id = ov.cliente_id
    LEFT JOIN public.operaciones_compra AS oc ON oc.operacion_id = o.id
    LEFT JOIN public.proveedores AS prov ON prov.id = oc.proveedor_id
    LEFT JOIN public.arreglos AS a ON a.id = COALESCE(oca.arreglo_id, oaa.arreglo_id)
    LEFT JOIN public.vehiculos AS v ON v.id = a.vehiculo_id
    LEFT JOIN public.cuentas_financieras AS cf_s ON cf_s.id = omc.cuenta_id
    LEFT JOIN public.cuentas_financieras AS cf_o ON cf_o.id = omc.cuenta_origen_id
    LEFT JOIN public.cuentas_financieras AS cf_m ON cf_m.id = mf.cuenta_financiera_id
    LEFT JOIN public.cuentas_financieras AS cf_op ON cf_op.id = op_first.cuenta_financiera_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
  )
  SELECT
    r.id, r.tipo, r.taller_id, r.fecha, r.created_at, r.lineas, r.gasto_id, r.descripcion, r.categoria_gasto,
    r.cuenta_financiera_id, r.cuenta_financiera_nombre, r.monto,
    r.monto_total, r.total_pagado, r.saldo_pendiente, r.esta_pago, r.estado_pago, r.estado_stock,
    r.arreglo_id, COUNT(*) OVER() AS total_count, r.observaciones,
    r.proveedor_id, r.proveedor_nombre, r.cliente_id, r.cliente_nombre
  FROM rows AS r
  WHERE COALESCE(cardinality(p_tipos), 0) = 0 OR r.tipo = ANY(p_tipos)
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO "anon", "authenticated", "service_role", "postgres";

-- 6. Actualizar rpc_finanzas_anular_pago_operacion para admitir tipo GASTO
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
  v_cleanup_previo   text := current_setting('app.finanzas_tenant_cleanup', true);
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

  -- Buscar el pago vinculado (puede pasarse el id de operaciones_pagos o el operacion_pago_id)
  SELECT id, operacion_pago_id, cuenta_financiera_id, monto
  INTO v_pago
  FROM public.operaciones_pagos
  WHERE operacion_id = p_operacion_id
    AND tenant_id = v_tenant_id
    AND (id = p_pago_id OR operacion_pago_id = p_pago_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado para esta operación' USING ERRCODE = 'P0002';
  END IF;

  -- Si el pago tiene un movimiento de cuenta asociado en operaciones, eliminarlo.
  IF v_pago.operacion_pago_id IS NOT NULL THEN
    PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);
    DELETE FROM public.operaciones
    WHERE id = v_pago.operacion_pago_id
      AND tenant_id = v_tenant_id
      AND tipo = 'MOVIMIENTO_CUENTA';
    PERFORM set_config(
      'app.finanzas_tenant_cleanup',
      COALESCE(NULLIF(v_cleanup_previo, ''), 'off'),
      true
    );
  ELSIF v_pago.cuenta_financiera_id IS NOT NULL THEN
    -- Pago inicial registrado al crear la operación: revertir directamente en el ledger
    IF v_op.tipo = 'VENTA' THEN
      PERFORM public._ledger_insertar(NULL, v_tenant_id, v_pago.cuenta_financiera_id, -v_pago.monto, now());
    ELSIF v_op.tipo IN ('COMPRA', 'GASTO') THEN
      PERFORM public._ledger_insertar(NULL, v_tenant_id, v_pago.cuenta_financiera_id, v_pago.monto, now());
    END IF;
  END IF;

  -- Asegurarse de eliminar de operaciones_pagos si no cascada automáticamente
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

-- 7. Actualizar rpc_registrar_pago_operacion para descripción por defecto de gasto diferido
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
  v_pago_existente     record;
  v_saldo_pendiente    numeric;
  v_pago_operacion_id  uuid;
  v_monto_pago         numeric;
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
    SELECT op.id, op.operacion_id, op.monto
    INTO v_pago_existente
    FROM public.operaciones_pagos op
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = op.operacion_pago_id
    WHERE op.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;

    IF v_pago_existente.id IS NOT NULL THEN
      SELECT monto_total, total_pagado, esta_pago, estado_pago
      INTO v_op FROM public.operaciones WHERE id = p_operacion_id;

      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
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

  v_saldo_pendiente := GREATEST(0, COALESCE(v_op.monto_total, 0) - COALESCE(v_op.total_pagado, 0));
  IF v_saldo_pendiente <= 0 THEN
    RAISE EXCEPTION 'Esta operación ya se encuentra totalmente saldada' USING ERRCODE = '22023';
  END IF;

  IF p_monto > v_saldo_pendiente THEN
    RAISE EXCEPTION 'El monto ingresado ($%) supera el saldo pendiente ($%)', p_monto, v_saldo_pendiente
      USING ERRCODE = '22023';
  END IF;

  v_monto_pago := p_monto;

  -- Crear operación de movimiento financiero de cuenta
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha, now()))
  RETURNING id INTO v_pago_operacion_id;

  INSERT INTO public.operaciones_movimiento_cuenta (
    operacion_id, tenant_id, subtipo, cuenta_id, importe,
    descripcion, idempotency_key, created_by
  )
  VALUES (
    v_pago_operacion_id,
    v_tenant_id,
    CASE WHEN v_op.tipo = 'VENTA' THEN 'INGRESO' ELSE 'GASTO' END,
    p_cuenta_id,
    CASE WHEN v_op.tipo = 'VENTA' THEN v_monto_pago ELSE -v_monto_pago END,
    COALESCE(
      NULLIF(btrim(p_descripcion), ''),
      CASE
        WHEN v_op.tipo = 'VENTA' THEN 'Cobro de venta diferida'
        WHEN v_op.tipo = 'COMPRA' THEN 'Pago de compra diferida'
        WHEN v_op.tipo = 'GASTO' THEN 'Pago de gasto diferido'
        ELSE 'Pago de operación'
      END
    ),
    p_idempotency_key,
    auth.uid()
  );

  -- Vincular en operaciones_pagos
  INSERT INTO public.operaciones_pagos (
    tenant_id,
    operacion_id,
    operacion_pago_id,
    cuenta_financiera_id,
    monto,
    fecha,
    descripcion,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_operacion_id,
    v_pago_operacion_id,
    p_cuenta_id,
    v_monto_pago,
    COALESCE(p_fecha, now()),
    NULLIF(btrim(p_descripcion), ''),
    auth.uid()
  );

  -- Leer estado resultante actualizado
  SELECT monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'pago_operacion_id', v_pago_operacion_id,
    'monto_registrado', v_monto_pago,
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_registrar_pago_operacion(uuid, uuid, numeric, timestamp with time zone, text, uuid) TO authenticated, service_role, postgres;
