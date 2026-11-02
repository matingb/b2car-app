CREATE FUNCTION public._b2c179_tiene_permiso (
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

REVOKE ALL ON FUNCTION public._b2c179_tiene_permiso(text) FROM PUBLIC;

GRANT ALL ON FUNCTION public._b2c179_tiene_permiso(text) TO authenticated;