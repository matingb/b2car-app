CREATE FUNCTION public.dashboard_arreglos_por_dia (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    fecha    date,
    cantidad bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  WITH dias AS (
    SELECT generate_series(
      date_trunc('day', (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc('day', (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      interval '1 day'
    ) AS dia
  ),
  agg AS (
    SELECT date_trunc('day', a.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
           COUNT(*)::bigint AS cnt
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  )
  SELECT d.dia::date, COALESCE(agg.cnt, 0)::bigint
  FROM dias d LEFT JOIN agg USING (dia)
  ORDER BY d.dia;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_arreglos_por_dia(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.dashboard_arreglos_por_dia(timestamp WITH time zone, timestamp WITH time zone, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.dashboard_arreglos_por_dia(timestamp WITH time zone, timestamp WITH time zone, uuid) TO service_role;