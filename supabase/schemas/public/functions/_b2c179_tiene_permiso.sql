CREATE OR REPLACE FUNCTION public._b2c179_tiene_permiso (
  p_permission text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.plan_permissions pp ON pp.permission = rp.permission
    WHERE rp.role::text = auth.jwt() ->> 'user_role'
      AND rp.permission::text = p_permission
      AND rp.granted IS TRUE
      AND pp.plan::text = auth.jwt() ->> 'plan_sub'
      AND pp.granted IS TRUE
  );
$function$;

GRANT EXECUTE ON FUNCTION "public"."_b2c179_tiene_permiso"(text) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_b2c179_tiene_permiso"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_b2c179_tiene_permiso"(text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_b2c179_tiene_permiso"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_b2c179_tiene_permiso"(text) TO "postgres";
