-- Proyecta los cobros de arreglos como un tipo de operación propio. Internamente
-- siguen siendo movimientos de cuenta de subtipo INGRESO, pero la relación con
-- operaciones_cobro_arreglo es la fuente de verdad de su semántica de negocio.

DROP FUNCTION IF EXISTS public.rpc_listar_operaciones_con_gastos(timestamptz,timestamptz,text[],int,int) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_listar_operaciones_con_gastos CASCADE;

CREATE FUNCTION public.rpc_listar_operaciones_con_gastos(
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_tipos text[] DEFAULT NULL, p_page int DEFAULT 1, p_page_size int DEFAULT 50
)
RETURNS TABLE (
  id uuid, tipo text, taller_id uuid, fecha timestamptz, created_at timestamptz,
  lineas jsonb, gasto_id uuid, descripcion text, categoria_gasto text,
  cuenta_financiera_id uuid, cuenta_financiera_nombre text, monto numeric,
  arreglo_id uuid, total_count bigint
)
LANGUAGE sql STABLE SET search_path = '' AS $$
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
          'cantidad', l.cantidad, 'monto_unitario', l.monto_unitario,
          'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at
        ) ORDER BY l.created_at, l.id)
        FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id
      ), '[]'::jsonb) AS lineas,
      CASE WHEN omc.subtipo = 'GASTO' THEN o.id ELSE NULL END AS gasto_id,
      omc.descripcion,
      omc.categoria_gasto,
      COALESCE(omc.cuenta_id, omc.cuenta_origen_id) AS cuenta_financiera_id,
      COALESCE(cf_s.nombre, cf_o.nombre) AS cuenta_financiera_nombre,
      COALESCE(
        abs(omc.importe),
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
      )::numeric AS monto,
      oca.arreglo_id
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = o.id
    LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras AS cf_s ON cf_s.id = omc.cuenta_id
    LEFT JOIN public.cuentas_financieras AS cf_o ON cf_o.id = omc.cuenta_origen_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
  )
  SELECT r.*, COUNT(*) OVER() AS total_count
  FROM rows AS r
  WHERE COALESCE(cardinality(p_tipos), 0) = 0 OR r.tipo = ANY(p_tipos)
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamptz,timestamptz,text[],int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamptz,timestamptz,text[],int,int) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_listar_movimientos_cuenta(uuid,timestamptz,timestamptz,int,int) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_listar_movimientos_cuenta CASCADE;

CREATE FUNCTION public.rpc_listar_movimientos_cuenta(
  p_cuenta_id uuid, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100, p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, cuenta_financiera_id uuid, importe numeric, fecha timestamptz,
  created_at timestamptz, operacion_id uuid, tipo text, descripcion text, categoria_gasto text,
  arreglo_id uuid
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT
    m.id, m.cuenta_financiera_id, m.importe, m.fecha, m.created_at, m.operacion_id,
    CASE
      WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
      ELSE COALESCE(omc.subtipo, o.tipo::text, 'MOVIMIENTO')
    END AS tipo,
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
    AND (p_to IS NULL OR m.fecha < p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid,timestamptz,timestamptz,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid,timestamptz,timestamptz,int,int) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_movimientos(uuid,timestamptz,timestamptz,int,int) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_movimientos CASCADE;

CREATE FUNCTION public.rpc_finanzas_listar_movimientos(
  p_cuenta_id uuid, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100, p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, cuenta_financiera_id uuid, importe numeric, fecha timestamptz,
  created_at timestamptz, operacion_id uuid, tipo text, descripcion text, categoria_gasto text,
  arreglo_id uuid
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT * FROM public.rpc_listar_movimientos_cuenta(p_cuenta_id, p_from, p_to, p_limit, p_offset);
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid,timestamptz,timestamptz,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid,timestamptz,timestamptz,int,int) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_operaciones_stats(timestamptz,timestamptz,text[]) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_operaciones_stats(timestamptz,timestamptz,public.tipo_operacion[]) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_operaciones_stats CASCADE;

CREATE FUNCTION public.rpc_operaciones_stats(
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_tipos text[] DEFAULT NULL
)
RETURNS TABLE (
  ventas numeric, compras numeric, asignaciones numeric, cobros numeric, gastos numeric, neto numeric
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH base AS (
    SELECT
      CASE
        WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
        ELSE COALESCE(omc.subtipo, o.tipo::text)
      END AS tipo,
      COALESCE(
        abs(omc.importe),
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
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
$$;

REVOKE ALL ON FUNCTION public.rpc_operaciones_stats(timestamptz,timestamptz,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_operaciones_stats(timestamptz,timestamptz,text[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
