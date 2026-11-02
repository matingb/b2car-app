CREATE FUNCTION public.rpc_operaciones_stats (
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
      o.tipo::text AS tipo,
      COALESCE(o.monto_total, 0) AS monto
    FROM public.operaciones AS o
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
      AND (
        COALESCE(cardinality(p_tipos), 0) = 0
        OR o.tipo::text = ANY(p_tipos)
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

REVOKE ALL ON FUNCTION public.rpc_operaciones_stats(timestamp WITH time zone, timestamp WITH time zone, text[]) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_operaciones_stats(timestamp WITH time zone, timestamp WITH time zone, text[]) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_operaciones_stats(timestamp WITH time zone, timestamp WITH time zone, text[]) TO service_role;