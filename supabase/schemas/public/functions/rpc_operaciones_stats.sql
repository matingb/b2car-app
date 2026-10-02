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
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_operaciones_stats"(timestamp WITH time zone, timestamp WITH time zone, text[]) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_operaciones_stats"(timestamp WITH time zone, timestamp WITH time zone, text[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_operaciones_stats"(timestamp WITH time zone, timestamp WITH time zone, text[]) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_operaciones_stats"(timestamp WITH time zone, timestamp WITH time zone, text[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_operaciones_stats"(timestamp WITH time zone, timestamp WITH time zone, text[]) TO "postgres";
