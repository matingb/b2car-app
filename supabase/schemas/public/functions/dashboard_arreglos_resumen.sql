CREATE OR REPLACE FUNCTION public.dashboard_arreglos_resumen (
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    total                   integer,
    cobrados                integer,
    pendientes              integer,
    parciales               integer,
    monto_ingresos          numeric,
    monto_cobrado_total     numeric,
    monto_cobrado_parcial   numeric,
    monto_pendiente_parcial numeric,
    monto_pendiente         numeric
  )
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE a.esta_pago = true)::int AS cobrados,
    COUNT(*) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) <= 0
    )::int AS pendientes,
    COUNT(*) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) > 0
    )::int AS parciales,
    COALESCE(SUM(a.precio_final), 0)::numeric AS monto_ingresos,
    COALESCE(SUM(a.total_cobrado) FILTER (WHERE a.esta_pago = true), 0)::numeric AS monto_cobrado_total,
    COALESCE(SUM(a.total_cobrado) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) > 0
    ), 0)::numeric AS monto_cobrado_parcial,
    COALESCE(SUM(GREATEST(0, COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0))) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) > 0
    ), 0)::numeric AS monto_pendiente_parcial,
    COALESCE(SUM(GREATEST(0, COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0))) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) <= 0
    ), 0)::numeric AS monto_pendiente
  FROM public.arreglos a
  WHERE (p_from IS NULL OR a.fecha >= p_from)
    AND (p_to IS NULL OR a.fecha < p_to)
    AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
    AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO');
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_arreglos_resumen"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_arreglos_resumen"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_arreglos_resumen"(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."dashboard_arreglos_resumen"(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_arreglos_resumen"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "postgres";
