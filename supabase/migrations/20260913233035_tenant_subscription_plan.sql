-- Tiering inicial por tenant. BASE conserva el acceso general y PRO habilita
-- facturación electrónica y su configuración fiscal.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_sub text;

UPDATE public.tenants
SET plan_sub = 'BASE'
WHERE plan_sub IS NULL;

ALTER TABLE public.tenants
  ALTER COLUMN plan_sub SET DEFAULT 'BASE',
  ALTER COLUMN plan_sub SET NOT NULL;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_plan_sub_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_plan_sub_check
  CHECK (plan_sub IN ('BASE', 'PRO'));

CREATE OR REPLACE FUNCTION public.custom_claims(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claims        jsonb;
  tenant_uuid   uuid;
  tenant_name   text;
  user_id       uuid;
  user_role     text;
  tenant_estado text;
  tenant_plan   text;
BEGIN
  claims := event->'claims';

  IF claims IS NULL OR jsonb_typeof(claims) IS NULL THEN
    RETURN event;
  END IF;

  user_id := (claims->>'sub')::uuid;

  SELECT tm.tenant_id, tm.rol
    INTO tenant_uuid, user_role
  FROM public.tenant_members tm
  WHERE tm.cliente_id = user_id
  LIMIT 1;

  IF tenant_uuid IS NULL THEN
    claims := claims
      || jsonb_build_object('error', 'NO_TENANT')
      || jsonb_build_object('error_description', 'El usuario no tiene un tenant asignado.');
    RETURN jsonb_set(event, '{claims}', claims);
  END IF;

  SELECT t.nombre, t.estado, t.plan_sub
    INTO tenant_name, tenant_estado, tenant_plan
  FROM public.tenants t
  WHERE t.id = tenant_uuid
    AND t.estado = 'activo';

  IF tenant_name IS NULL THEN
    claims := claims
      || jsonb_build_object('error', 'TENANT_INACTIVE')
      || jsonb_build_object('error_description', 'El tenant está inactivo o no existe.');
    RETURN jsonb_set(event, '{claims}', claims);
  END IF;

  claims := claims
    || jsonb_build_object('tenant_id', tenant_uuid)
    || jsonb_build_object('user_role', user_role)
    || jsonb_build_object('tenant_name', tenant_name)
    || jsonb_build_object('plan_sub', tenant_plan);

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- El hook es invocado por Supabase Auth, no por clientes de la Data API.
REVOKE ALL ON FUNCTION public.custom_claims(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.custom_claims(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.custom_claims(jsonb) TO supabase_auth_admin;
