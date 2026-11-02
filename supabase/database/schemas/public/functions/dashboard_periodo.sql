CREATE FUNCTION public.dashboard_periodo (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'Rango de fechas inválido: p_from debe ser anterior a p_to'
      USING ERRCODE = '22023';
  END IF;

  -- Una sola sentencia: el resumen y las tres series se calculan sobre el mismo snapshot.
  RETURN (
    SELECT jsonb_build_object(
      'resumen', (
        SELECT to_jsonb(r)
        FROM public.dashboard_arreglos_resumen(p_from, p_to, p_taller_id) AS r
      ),
      'arreglos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d) ORDER BY d.fecha)
        FROM public.dashboard_arreglos_por_dia(p_from, p_to, p_taller_id) AS d
      ), '[]'::jsonb),
      'ingresos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d) ORDER BY d.fecha)
        FROM public.dashboard_ingresos_por_dia(p_from, p_to, p_taller_id) AS d
      ), '[]'::jsonb),
      'gastos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d) ORDER BY d.fecha)
        FROM public.dashboard_gastos_por_dia(p_from, p_to, p_taller_id) AS d
      ), '[]'::jsonb)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_periodo(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.dashboard_periodo(timestamp WITH time zone, timestamp WITH time zone, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.dashboard_periodo(timestamp WITH time zone, timestamp WITH time zone, uuid) TO service_role;