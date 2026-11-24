-- =============================================================================
-- Plano de Control B2Car: Operadores SUPERADMIN sin uso de service_role
-- =============================================================================

-- 1. Tabla de operadores del portal b2car-control (solo SUPERADMIN por ahora)
CREATE TABLE IF NOT EXISTS public.control_operadores (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'SUPERADMIN' CHECK (rol IN ('SUPERADMIN')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_operadores_email
  ON public.control_operadores(email);

COMMENT ON TABLE public.control_operadores IS
  'Operadores del portal b2car-control. Separados de tenant_members; operan bajo RLS con su propio JWT.';

ALTER TABLE public.control_operadores ENABLE ROW LEVEL SECURITY;

-- Revocar acceso público/anónimo; permitir solo SELECT autenticado sobre su propia fila activa
REVOKE ALL ON public.control_operadores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.control_operadores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.control_operadores TO service_role;

DROP POLICY IF EXISTS "control_operadores_select_own" ON public.control_operadores;
CREATE POLICY "control_operadores_select_own"
  ON public.control_operadores
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND activo = true
    AND rol = 'SUPERADMIN'
  );

-- 2. Función verificadora en tiempo real del rol SUPERADMIN
CREATE OR REPLACE FUNCTION public.is_control_superadmin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.control_operadores op
    WHERE op.id = (SELECT auth.uid())
      AND op.rol = 'SUPERADMIN'
      AND op.activo = true
  );
$function$;

REVOKE ALL ON FUNCTION public.is_control_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_control_superadmin() TO authenticated;

-- 3. Políticas RLS del Plano de Control para SUPERADMIN (sin DELETE y sin tocar el Plano de Datos)

-- 3.1. public.tenants: lectura y edición de estado/nombre/plan (sin DELETE)
DROP POLICY IF EXISTS "control_superadmin_tenants_select" ON public.tenants;
CREATE POLICY "control_superadmin_tenants_select"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (public.is_control_superadmin());

DROP POLICY IF EXISTS "control_superadmin_tenants_update" ON public.tenants;
CREATE POLICY "control_superadmin_tenants_update"
  ON public.tenants
  FOR UPDATE
  TO authenticated
  USING (public.is_control_superadmin())
  WITH CHECK (public.is_control_superadmin());

-- 3.2. public.tenant_members: lectura, asignación y cambio de rol (sin DELETE)
DROP POLICY IF EXISTS "control_superadmin_tenant_members_select" ON public.tenant_members;
CREATE POLICY "control_superadmin_tenant_members_select"
  ON public.tenant_members
  FOR SELECT
  TO authenticated
  USING (public.is_control_superadmin());

DROP POLICY IF EXISTS "control_superadmin_tenant_members_insert" ON public.tenant_members;
CREATE POLICY "control_superadmin_tenant_members_insert"
  ON public.tenant_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_control_superadmin());

DROP POLICY IF EXISTS "control_superadmin_tenant_members_update" ON public.tenant_members;
CREATE POLICY "control_superadmin_tenant_members_update"
  ON public.tenant_members
  FOR UPDATE
  TO authenticated
  USING (public.is_control_superadmin())
  WITH CHECK (public.is_control_superadmin());

-- 3.3. public.talleres: solo lectura de configuración inicial del tenant
DROP POLICY IF EXISTS "control_superadmin_talleres_select" ON public.talleres;
CREATE POLICY "control_superadmin_talleres_select"
  ON public.talleres
  FOR SELECT
  TO authenticated
  USING (public.is_control_superadmin());

-- 3.4. Catálogos de acceso: creación/edición de roles y matrices (sin DELETE)
DROP POLICY IF EXISTS "control_superadmin_roles_insert" ON public.roles;
CREATE POLICY "control_superadmin_roles_insert"
  ON public.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_control_superadmin());

DROP POLICY IF EXISTS "control_superadmin_roles_update" ON public.roles;
CREATE POLICY "control_superadmin_roles_update"
  ON public.roles
  FOR UPDATE
  TO authenticated
  USING (public.is_control_superadmin())
  WITH CHECK (public.is_control_superadmin());

DROP POLICY IF EXISTS "control_superadmin_role_permissions_insert" ON public.role_permissions;
CREATE POLICY "control_superadmin_role_permissions_insert"
  ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_control_superadmin());

DROP POLICY IF EXISTS "control_superadmin_role_permissions_update" ON public.role_permissions;
CREATE POLICY "control_superadmin_role_permissions_update"
  ON public.role_permissions
  FOR UPDATE
  TO authenticated
  USING (public.is_control_superadmin())
  WITH CHECK (public.is_control_superadmin());

DROP POLICY IF EXISTS "control_superadmin_plan_permissions_insert" ON public.plan_permissions;
CREATE POLICY "control_superadmin_plan_permissions_insert"
  ON public.plan_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_control_superadmin());

DROP POLICY IF EXISTS "control_superadmin_plan_permissions_update" ON public.plan_permissions;
CREATE POLICY "control_superadmin_plan_permissions_update"
  ON public.plan_permissions
  FOR UPDATE
  TO authenticated
  USING (public.is_control_superadmin())
  WITH CHECK (public.is_control_superadmin());

-- 4. RPC acotado para listar usuarios de Auth con DTO reducido (reemplaza auth.admin.listUsers)
CREATE OR REPLACE FUNCTION public.rpc_control_list_users()
  RETURNS TABLE (
    id uuid,
    email text,
    name text,
    created_at timestamptz,
    last_sign_in_at timestamptz,
    email_confirmed_at timestamptz
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $function$
BEGIN
  IF NOT public.is_control_superadmin() THEN
    RAISE EXCEPTION 'Acceso reservado a SUPERADMIN de control'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    left(u.raw_user_meta_data ->> 'name', 100)::text AS name,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at
  FROM auth.users u
  ORDER BY u.created_at DESC, u.id ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_control_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_control_list_users() TO authenticated;

-- 5. RPC acotado para conteo de métricas sin exponer filas del Plano de Datos
CREATE OR REPLACE FUNCTION public.rpc_control_count_entity(
  p_table text,
  p_tenant_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
  RETURNS bigint
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $function$
DECLARE
  v_date_col text;
  v_sql text;
  v_count bigint;
BEGIN
  IF NOT public.is_control_superadmin() THEN
    RAISE EXCEPTION 'Acceso reservado a SUPERADMIN de control'
      USING ERRCODE = '42501';
  END IF;

  v_date_col := CASE p_table
    WHEN 'tenants' THEN 'fecha_creacion'
    WHEN 'clientes' THEN 'fecha_creacion'
    WHEN 'vehiculos' THEN 'created_at'
    WHEN 'arreglos' THEN 'created_at'
    WHEN 'productos' THEN 'created_at'
    WHEN 'turnos' THEN 'created_at'
    WHEN 'empleados' THEN 'created_at'
    WHEN 'operaciones' THEN 'created_at'
    WHEN 'talleres' THEN 'created_at'
    WHEN 'stocks' THEN 'created_at'
    WHEN 'facturas_electronicas' THEN 'created_at'
    WHEN 'remitos' THEN 'created_at'
    WHEN 'cuentas_financieras' THEN 'created_at'
    WHEN 'categorias_arreglo' THEN 'created_at'
    ELSE NULL
  END;

  IF v_date_col IS NULL THEN
    RAISE EXCEPTION 'Tabla no habilitada para métricas de control: %', p_table
      USING ERRCODE = '22023';
  END IF;

  v_sql := format('SELECT count(*)::bigint FROM public.%I WHERE true', p_table);

  IF p_tenant_id IS NOT NULL THEN
    IF p_table = 'tenants' THEN
      v_sql := v_sql || ' AND id = $1';
    ELSE
      v_sql := v_sql || ' AND tenant_id = $1';
    END IF;
  END IF;

  IF p_from IS NOT NULL THEN
    v_sql := v_sql || format(' AND %I >= $2', v_date_col);
  END IF;

  IF p_to IS NOT NULL THEN
    v_sql := v_sql || format(' AND %I < $3', v_date_col);
  END IF;

  EXECUTE v_sql INTO v_count USING p_tenant_id, p_from, p_to;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_control_count_entity(text, uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_control_count_entity(text, uuid, timestamptz, timestamptz) TO authenticated;
