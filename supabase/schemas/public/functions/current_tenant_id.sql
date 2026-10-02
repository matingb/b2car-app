CREATE OR REPLACE FUNCTION public.current_tenant_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $function$
  select (auth.jwt() ->> 'tenant_id')::uuid;
$function$;

GRANT EXECUTE ON FUNCTION "public"."current_tenant_id"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."current_tenant_id"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."current_tenant_id"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."current_tenant_id"() TO "postgres";
