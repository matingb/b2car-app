CREATE OR REPLACE FUNCTION public.dashboard_count_clientes()
  RETURNS integer
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  SELECT COUNT(*)::int FROM public.clientes;
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_count_clientes"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_count_clientes"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_count_clientes"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_count_clientes"() TO "postgres";
