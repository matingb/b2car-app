CREATE OR REPLACE FUNCTION public._b2c152_activacion_guardada()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  SELECT COALESCE(current_setting('b2c152.activation', true), '') = 'on';
$function$;

GRANT EXECUTE ON FUNCTION "public"."_b2c152_activacion_guardada"() TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_b2c152_activacion_guardada"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_b2c152_activacion_guardada"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_b2c152_activacion_guardada"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_b2c152_activacion_guardada"() TO "postgres";
