CREATE FUNCTION public.dashboard_count_vehiculos()
  RETURNS integer
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  SELECT COUNT(*)::int FROM public.vehiculos;
$function$;

GRANT ALL ON FUNCTION public.dashboard_count_vehiculos() TO anon;

GRANT ALL ON FUNCTION public.dashboard_count_vehiculos() TO authenticated;

GRANT ALL ON FUNCTION public.dashboard_count_vehiculos() TO service_role;