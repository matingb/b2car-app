CREATE FUNCTION public.dashboard_clientes_nuevos_por_dia (
  p_from timestamp with time zone,
  p_to   timestamp with time zone
)
  RETURNS TABLE (
    label text,
    valor integer
  )
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  WITH days AS (
    SELECT generate_series(
      date_trunc('day', (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc('day', (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      interval '1 day'
    ) AS day
  ),
  agg AS (
    SELECT date_trunc('day', c.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires') AS day, COUNT(*)::int AS valor
    FROM public.clientes c
    WHERE c.fecha_creacion >= p_from
      AND c.fecha_creacion < p_to
    GROUP BY 1
  )
  SELECT
    to_char(days.day::date, 'DD/MM') AS label,
    COALESCE(agg.valor, 0)::int AS valor
  FROM days
  LEFT JOIN agg USING (day)
  ORDER BY days.day ASC;
$function$;

GRANT ALL ON FUNCTION public.dashboard_clientes_nuevos_por_dia(timestamp WITH time zone, timestamp WITH time zone) TO anon;

GRANT ALL ON FUNCTION public.dashboard_clientes_nuevos_por_dia(timestamp WITH time zone, timestamp WITH time zone) TO authenticated;

GRANT ALL ON FUNCTION public.dashboard_clientes_nuevos_por_dia(timestamp WITH time zone, timestamp WITH time zone) TO service_role;