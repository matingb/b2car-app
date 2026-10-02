CREATE OR REPLACE FUNCTION public.dashboard_arreglos_por_periodo (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label    text,
    cantidad bigint
  )
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);
  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, p_from),
      date_trunc(b.trunc_name, p_to - interval '1 second'),
      b.step
    ) AS slot_start
  ),
  agg AS (
    SELECT date_trunc(b.trunc_name, a.fecha) AS slot_start,
           COUNT(*)::bigint AS cnt
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt), COALESCE(agg.cnt, 0)
  FROM slots s LEFT JOIN agg USING (slot_start)
  ORDER BY s.slot_start;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_arreglos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_arreglos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_arreglos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."dashboard_arreglos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_arreglos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "postgres";
