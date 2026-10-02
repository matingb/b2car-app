CREATE OR REPLACE FUNCTION public.dashboard_count_vehiculos()
  RETURNS integer
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  SELECT COUNT(*)::int FROM public.vehiculos;
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_count_vehiculos"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_count_vehiculos"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_count_vehiculos"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_count_vehiculos"() TO "postgres";
