-- ============================================================================
-- MIGRATION: 20260825000000_arreglos_pagos_dinamicos.sql
-- Pagos dinámicos, parciales y múltiples para Arreglos.
-- Desacopla finanzas con tabla puente operaciones_cobro_arreglo.
-- ============================================================================

-- 1. Modificar tabla public.arreglos
ALTER TABLE public.arreglos
  ADD COLUMN IF NOT EXISTS total_cobrado numeric(14,2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.arreglos
  DROP COLUMN IF EXISTS estado_pago;

-- 2. Crear tabla puente public.operaciones_cobro_arreglo
CREATE TABLE IF NOT EXISTS public.operaciones_cobro_arreglo (
  operacion_id uuid PRIMARY KEY REFERENCES public.operaciones(id) ON DELETE CASCADE,
  arreglo_id   uuid NOT NULL REFERENCES public.arreglos(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_cobro_arreglo_id ON public.operaciones_cobro_arreglo (arreglo_id);
CREATE INDEX IF NOT EXISTS idx_op_cobro_tenant     ON public.operaciones_cobro_arreglo (tenant_id);

-- Migrar datos previos si existían en operaciones_movimiento_cuenta.arreglo_id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operaciones_movimiento_cuenta' AND column_name = 'arreglo_id'
  ) THEN
    INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
    SELECT omc.operacion_id, omc.arreglo_id, omc.tenant_id
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.arreglo_id IS NOT NULL
    ON CONFLICT (operacion_id) DO NOTHING;

    ALTER TABLE public.operaciones_movimiento_cuenta DROP COLUMN IF EXISTS arreglo_id;
  END IF;
END $$;

-- 3. RLS y Grants para operaciones_cobro_arreglo
ALTER TABLE public.operaciones_cobro_arreglo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operaciones_cobro_arreglo_tenant_select ON public.operaciones_cobro_arreglo;
CREATE POLICY operaciones_cobro_arreglo_tenant_select ON public.operaciones_cobro_arreglo
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

REVOKE ALL ON TABLE public.operaciones_cobro_arreglo FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operaciones_cobro_arreglo TO authenticated, service_role;

-- 4. Backfill de arreglos históricos
UPDATE public.arreglos
SET
  total_cobrado = CASE WHEN esta_pago = true THEN COALESCE(precio_final, 0) ELSE 0 END;

-- 5. Trigger para recalcular estado de pago al modificar precio_final o total_cobrado
CREATE OR REPLACE FUNCTION public._recalcular_estado_pago_arreglo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.esta_pago := COALESCE(NEW.precio_final, 0) > 0 AND COALESCE(NEW.total_cobrado, 0) >= COALESCE(NEW.precio_final, 0);
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public._recalcular_estado_pago_arreglo() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_recalcular_estado_pago ON public.arreglos;
CREATE TRIGGER trg_recalcular_estado_pago
  BEFORE INSERT OR UPDATE OF precio_final, total_cobrado ON public.arreglos
  FOR EACH ROW EXECUTE FUNCTION public._recalcular_estado_pago_arreglo();

-- 6. RPC: rpc_finanzas_cobrar_arreglo
DROP FUNCTION IF EXISTS public.rpc_finanzas_cobrar_arreglo(uuid,uuid,timestamptz,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_cobrar_arreglo(uuid,uuid,numeric,timestamptz,text,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_cobrar_arreglo(uuid,uuid,numeric,timestamptz,text,uuid,jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_cobrar_arreglo CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_cobrar_arreglo(
  p_arreglo_id      uuid,
  p_cuenta_id       uuid        DEFAULT NULL,
  p_monto           numeric     DEFAULT NULL,
  p_fecha_cobro     timestamptz DEFAULT now(),
  p_descripcion     text        DEFAULT NULL,
  p_idempotency_key uuid        DEFAULT NULL,
  p_pagos           jsonb       DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id            uuid    := public.current_tenant_id();
  v_arreglo              record;
  v_monto_total_cobrado  numeric := 0;
  v_operacion_id         uuid;
  v_pago                 jsonb;
  v_pago_cuenta_id       uuid;
  v_pago_monto           numeric;
  v_pago_desc            text;
  v_operaciones_ids      uuid[]  := ARRAY[]::uuid[];
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  -- Idempotencia: si ya existe una operación con este idempotency_key, devolver estado actual
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':cobro:' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_operacion_id
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;
    IF v_operacion_id IS NOT NULL THEN
      SELECT a.total_cobrado, a.precio_final, a.esta_pago
      INTO v_arreglo FROM public.arreglos a
      WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id;
      RETURN jsonb_build_object(
        'operacion_id',    v_operacion_id,
        'idempotent',      true,
        'total_cobrado',   v_arreglo.total_cobrado,
        'saldo_pendiente', GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - v_arreglo.total_cobrado),
        'esta_pago',       v_arreglo.esta_pago
      );
    END IF;
  END IF;

  SELECT a.id, a.precio_final, a.total_cobrado, a.tenant_id, v.patente
  INTO v_arreglo
  FROM public.arreglos a
  LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id
  FOR UPDATE OF a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado: %', p_arreglo_id USING ERRCODE = 'P0002'; END IF;

  -- MODO 1: Múltiples cuentas (p_pagos como array JSON)
  IF p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0 THEN
    FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos)
    LOOP
      v_pago_cuenta_id := (v_pago ->> 'cuenta_id')::uuid;
      v_pago_monto := (v_pago ->> 'monto')::numeric;
      v_pago_desc := NULLIF(btrim(v_pago ->> 'descripcion'), '');

      IF v_pago_cuenta_id IS NULL THEN
        RAISE EXCEPTION 'Cada cobro debe especificar una cuenta válida' USING ERRCODE = '22023';
      END IF;
      IF v_pago_monto IS NULL OR v_pago_monto <= 0 THEN
        RAISE EXCEPTION 'El monto de cada cobro debe ser mayor a 0' USING ERRCODE = '22023';
      END IF;

      PERFORM public._finanzas_exigir_cuenta(v_pago_cuenta_id, v_tenant_id, true);

      INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
      VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha_cobro, now()))
      RETURNING id INTO v_operacion_id;

      INSERT INTO public.operaciones_movimiento_cuenta (
        operacion_id, tenant_id, subtipo, cuenta_id, importe,
        descripcion, created_by
      ) VALUES (
        v_operacion_id, v_tenant_id, 'INGRESO', v_pago_cuenta_id, v_pago_monto,
        COALESCE(
          v_pago_desc,
          NULLIF(btrim(p_descripcion), ''),
          'Cobro de arreglo' || CASE WHEN v_arreglo.patente IS NOT NULL THEN ' - ' || v_arreglo.patente ELSE '' END
        ),
        auth.uid()
      );

      INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
      VALUES (v_operacion_id, p_arreglo_id, v_tenant_id);

      v_operaciones_ids := array_append(v_operaciones_ids, v_operacion_id);
      v_monto_total_cobrado := v_monto_total_cobrado + v_pago_monto;
    END LOOP;

  -- MODO 2: Cobro simple (una sola cuenta)
  ELSE
    IF p_cuenta_id IS NULL THEN
      RAISE EXCEPTION 'Debe especificar una cuenta financiera de destino' USING ERRCODE = '22023';
    END IF;

    v_pago_monto := COALESCE(
      p_monto,
      GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - COALESCE(v_arreglo.total_cobrado, 0))
    );
    IF v_pago_monto <= 0 THEN
      RAISE EXCEPTION 'El monto a cobrar debe ser mayor a 0' USING ERRCODE = '22023';
    END IF;

    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
    VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha_cobro, now()))
    RETURNING id INTO v_operacion_id;

    INSERT INTO public.operaciones_movimiento_cuenta (
      operacion_id, tenant_id, subtipo, cuenta_id, importe,
      descripcion, idempotency_key, created_by
    ) VALUES (
      v_operacion_id, v_tenant_id, 'INGRESO', p_cuenta_id, v_pago_monto,
      COALESCE(
        NULLIF(btrim(p_descripcion), ''),
        'Cobro de arreglo' || CASE WHEN v_arreglo.patente IS NOT NULL THEN ' - ' || v_arreglo.patente ELSE '' END
      ),
      p_idempotency_key, auth.uid()
    );

    INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
    VALUES (v_operacion_id, p_arreglo_id, v_tenant_id);

    v_operaciones_ids := array_append(v_operaciones_ids, v_operacion_id);
    v_monto_total_cobrado := v_pago_monto;
  END IF;

  -- Actualizar total cobrado en arreglo
  UPDATE public.arreglos
  SET total_cobrado = COALESCE(total_cobrado, 0) + v_monto_total_cobrado
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;

  SELECT a.total_cobrado, a.precio_final, a.esta_pago
  INTO v_arreglo FROM public.arreglos a WHERE a.id = p_arreglo_id;

  RETURN jsonb_build_object(
    'operaciones_ids', to_jsonb(v_operaciones_ids),
    'monto_cobrado',   v_monto_total_cobrado,
    'total_cobrado',   v_arreglo.total_cobrado,
    'saldo_pendiente', GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - v_arreglo.total_cobrado),
    'esta_pago',       v_arreglo.esta_pago
  );
END; $$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid,uuid,numeric,timestamptz,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid,uuid,numeric,timestamptz,text,uuid,jsonb) TO authenticated, service_role;

-- 7. RPC: rpc_finanzas_anular_cobro_arreglo
DROP FUNCTION IF EXISTS public.rpc_finanzas_anular_cobro_arreglo(uuid,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_anular_cobro_arreglo(uuid,uuid,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_anular_cobro_arreglo CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_anular_cobro_arreglo(
  p_arreglo_id   uuid,
  p_operacion_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id       uuid := public.current_tenant_id();
  v_op_id           uuid := p_operacion_id;
  v_importe_anulado numeric;
  v_nuevo_total     numeric;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  PERFORM 1 FROM public.arreglos WHERE id = p_arreglo_id AND tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;

  IF v_op_id IS NULL THEN
    SELECT oca.operacion_id INTO v_op_id
    FROM public.operaciones_cobro_arreglo oca
    WHERE oca.arreglo_id = p_arreglo_id AND oca.tenant_id = v_tenant_id
    ORDER BY oca.created_at DESC LIMIT 1;
  END IF;
  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'No se encontraron cobros para este arreglo' USING ERRCODE = 'P0002';
  END IF;

  SELECT omc.importe INTO v_importe_anulado
  FROM public.operaciones_movimiento_cuenta omc
  JOIN public.operaciones_cobro_arreglo oca ON oca.operacion_id = omc.operacion_id
  WHERE omc.operacion_id = v_op_id AND omc.tenant_id = v_tenant_id AND oca.arreglo_id = p_arreglo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobro no encontrado para este arreglo' USING ERRCODE = 'P0002'; END IF;

  -- Borrar la operación: CASCADE elimina operaciones_movimiento_cuenta y operaciones_cobro_arreglo
  -- Trigger _omc_after_delete revierte el ledger contable automáticamente
  DELETE FROM public.operaciones WHERE id = v_op_id AND tenant_id = v_tenant_id AND tipo = 'MOVIMIENTO_CUENTA';

  -- Recalcular total_cobrado sumando cobros restantes vía tabla puente
  SELECT COALESCE(SUM(omc.importe), 0) INTO v_nuevo_total
  FROM public.operaciones_cobro_arreglo oca
  JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = oca.operacion_id
  WHERE oca.arreglo_id = p_arreglo_id AND oca.tenant_id = v_tenant_id;

  UPDATE public.arreglos SET total_cobrado = v_nuevo_total
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'anulada_operacion_id', v_op_id,
    'importe_anulado',      v_importe_anulado,
    'total_cobrado',        v_nuevo_total
  );
END; $$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid,uuid) TO authenticated, service_role;

-- 8. Actualizar rpc_get_arreglo_detalle con cobros e indicadores dinámicos
DROP FUNCTION IF EXISTS public.rpc_get_arreglo_detalle(uuid);

CREATE OR REPLACE FUNCTION public.rpc_get_arreglo_detalle(
  p_arreglo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id    uuid;
  v_arreglo      jsonb;
  v_detalles     jsonb;
  v_asignaciones jsonb;
  v_cobros       jsonb;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;

  SELECT
    jsonb_build_object(
      'id', a.id,
      'vehiculo', to_jsonb(v),
      'taller_id', a.taller_id,
      'taller', to_jsonb(t),
      'categoria', COALESCE(
        (SELECT string_agg(ca.nombre, ', ') FROM unnest(a.categorias) AS c_id JOIN public.categorias_arreglo ca ON ca.id = c_id),
        ''
      ),
      'categorias', a.categorias,
      'empleados', a.empleados,
      'empleados_detallados', public.arreglos_empleados_detallados(a),
      'estado', a.estado,
      'descripcion', a.descripcion,
      'kilometraje_leido', a.kilometraje_leido,
      'fecha', a.fecha,
      'observaciones', a.observaciones,
      'precio_final', a.precio_final,
      'precio_sin_iva', a.precio_sin_iva,
      'esta_pago', a.esta_pago,
      'total_cobrado', a.total_cobrado,
      'saldo_pendiente', GREATEST(0, COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0)),
      'extra_data', a.extra_data
    )
  INTO v_arreglo
  FROM public.arreglos a
  JOIN public.vehiculos v ON v.id = a.vehiculo_id
  LEFT JOIN public.talleres t ON t.id = a.taller_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id LIMIT 1;

  IF v_arreglo IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id, 'arreglo_id', d.arreglo_id, 'descripcion', d.descripcion, 'cantidad', d.cantidad,
      'valor', d.valor, 'categoria_arreglo_id', d.categoria_arreglo_id, 'empleado_id', d.empleado_id,
      'created_at', d.created_at, 'updated_at', d.updated_at
    ) ORDER BY d.created_at
  ), '[]'::jsonb) INTO v_detalles
  FROM public.detalle_arreglo d WHERE d.arreglo_id = p_arreglo_id AND d.tenant_id = v_tenant_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id, 'tipo', o.tipo, 'taller_id', o.taller_id, 'created_at', o.created_at,
      'lineas', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id, 'cantidad', l.cantidad,
            'monto_unitario', l.monto_unitario, 'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at,
            'categoria_arreglo_id', l.categoria_arreglo_id, 'empleado_id', l.empleado_id,
            'producto', jsonb_build_object(
              'id', p.id, 'codigo', p.codigo, 'nombre', p.nombre, 'precio_unitario', p.precio_unitario,
              'costo_unitario', p.costo_unitario, 'proveedor', p.proveedor, 'categorias', COALESCE(p.categorias, ARRAY[]::text[])
            )
          ) ORDER BY l.created_at
        )
        FROM public.operaciones_lineas l JOIN public.stocks s ON s.id = l.stock_id JOIN public.productos p ON p.id = s.producto_id
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb)
    ) ORDER BY o.created_at
  ), '[]'::jsonb) INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oa JOIN public.operaciones o ON o.id = oa.operacion_id WHERE oa.arreglo_id = p_arreglo_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', omc.operacion_id,
      'operacion_id', omc.operacion_id,
      'importe', omc.importe,
      'cuenta_id', omc.cuenta_id,
      'cuenta_nombre', cf.nombre,
      'descripcion', omc.descripcion,
      'fecha', o.fecha,
      'created_at', omc.created_at
    ) ORDER BY o.fecha ASC, omc.created_at ASC
  ), '[]'::jsonb) INTO v_cobros
  FROM public.operaciones_cobro_arreglo oca
  JOIN public.operaciones o ON o.id = oca.operacion_id
  JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = oca.operacion_id
  JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
  WHERE oca.arreglo_id = p_arreglo_id AND oca.tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'arreglo', v_arreglo,
    'detalles', v_detalles,
    'asignaciones', v_asignaciones,
    'cobros', v_cobros
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_arreglo_detalle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_arreglo_detalle(uuid) TO authenticated, service_role;

-- 9. Actualizar dashboard_arreglos_resumen
DROP FUNCTION IF EXISTS public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.dashboard_arreglos_resumen CASCADE;

CREATE OR REPLACE FUNCTION public.dashboard_arreglos_resumen(
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(total integer, cobrados integer, pendientes integer, parciales integer, monto_ingresos numeric)
LANGUAGE sql SET search_path = public AS $$
  SELECT
    COUNT(*)::int                                                                              AS total,
    COUNT(*) FILTER (WHERE a.esta_pago = true)::int                                            AS cobrados,
    COUNT(*) FILTER (WHERE a.esta_pago = false AND COALESCE(a.total_cobrado, 0) <= 0)::int    AS pendientes,
    COUNT(*) FILTER (WHERE a.esta_pago = false AND COALESCE(a.total_cobrado, 0) > 0)::int     AS parciales,
    COALESCE(SUM(a.total_cobrado), 0)::numeric                                                AS monto_ingresos
  FROM public.arreglos a
  WHERE (p_from IS NULL OR a.fecha >= p_from)
    AND (p_to   IS NULL OR a.fecha <  p_to)
    AND (p_taller_id IS NULL OR a.taller_id = p_taller_id);
$$;

REVOKE ALL ON FUNCTION public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid) TO authenticated, service_role;

-- 10. Actualizar rpc_listar_movimientos_cuenta con arreglo_id
DROP FUNCTION IF EXISTS public.rpc_listar_movimientos_cuenta(uuid,timestamptz,timestamptz,int,int) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_listar_movimientos_cuenta CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_listar_movimientos_cuenta(
  p_cuenta_id uuid, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100, p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, cuenta_financiera_id uuid, importe numeric, fecha timestamptz,
  created_at timestamptz, operacion_id uuid, tipo text, descripcion text, categoria_gasto text,
  arreglo_id uuid
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT m.id, m.cuenta_financiera_id, m.importe, m.fecha, m.created_at, m.operacion_id,
    COALESCE(omc.subtipo, o.tipo::text, 'MOVIMIENTO') AS tipo,
    omc.descripcion, omc.categoria_gasto,
    COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id
  FROM public.movimientos_financieros AS m
  LEFT JOIN public.operaciones AS o ON o.id = m.operacion_id
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = m.operacion_id
  LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = m.operacion_id
  LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = m.operacion_id
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to   IS NULL OR m.fecha <  p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid,timestamptz,timestamptz,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid,timestamptz,timestamptz,int,int) TO authenticated, service_role;

