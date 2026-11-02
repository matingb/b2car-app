CREATE FUNCTION public.current_tenant_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $function$
  select (auth.jwt() ->> 'tenant_id')::uuid;
$function$;

GRANT ALL ON FUNCTION public.current_tenant_id() TO anon;

GRANT ALL ON FUNCTION public.current_tenant_id() TO authenticated;

GRANT ALL ON FUNCTION public.current_tenant_id() TO service_role;