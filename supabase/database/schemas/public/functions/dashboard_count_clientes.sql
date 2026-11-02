CREATE FUNCTION public.dashboard_count_clientes()
  RETURNS integer
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  SELECT COUNT(*)::int FROM public.clientes;
$function$;

GRANT ALL ON FUNCTION public.dashboard_count_clientes() TO anon;

GRANT ALL ON FUNCTION public.dashboard_count_clientes() TO authenticated;

GRANT ALL ON FUNCTION public.dashboard_count_clientes() TO service_role;