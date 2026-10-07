CREATE OR REPLACE FUNCTION public._remitos_hoy()
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
$function$
;

REVOKE ALL ON FUNCTION "public"."_remitos_hoy"() FROM PUBLIC, "anon", "authenticated", "service_role";
