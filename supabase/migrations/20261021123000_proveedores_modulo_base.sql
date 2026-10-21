-- Migración: Módulo base de proveedores (Etapa 1)
-- Crea la tabla proveedores con RLS, índices, trigger de updated_at y permisos del sistema.

CREATE TABLE IF NOT EXISTS public.proveedores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  nombre text NOT NULL,
  cuit text,
  telefono text,
  email text,
  direccion text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT proveedores_pkey PRIMARY KEY (id),
  CONSTRAINT proveedores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT proveedores_nombre_not_empty CHECK (char_length(btrim(nombre)) > 0)
);

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_proveedores_tenant_cuit
  ON public.proveedores (tenant_id, cuit)
  WHERE (cuit IS NOT NULL AND btrim(cuit) <> '');

CREATE INDEX IF NOT EXISTS idx_proveedores_tenant_id
  ON public.proveedores USING btree (tenant_id);

CREATE INDEX IF NOT EXISTS idx_proveedores_tenant_nombre_lower
  ON public.proveedores USING btree (tenant_id, lower(nombre));

DROP TRIGGER IF EXISTS proveedores_set_updated_at ON public.proveedores;
CREATE TRIGGER proveedores_set_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "tenant_access" ON public.proveedores;
CREATE POLICY "tenant_access" ON public.proveedores
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.proveedores TO authenticated, service_role;

-- Permisos del sistema
INSERT INTO public.permissions (id, descripcion) VALUES
  ('proveedores:view', 'Consulta del catálogo de proveedores y datos de contacto'),
  ('proveedores:edit', 'Alta, modificación y eliminación de proveedores')
ON CONFLICT (id) DO NOTHING;

-- Asignar a roles existentes
INSERT INTO public.role_permissions (role, permission, granted) VALUES
  ('admin', 'proveedores:view', true),
  ('admin', 'proveedores:edit', true),
  ('operativo', 'proveedores:view', true),
  ('operativo', 'proveedores:edit', true)
ON CONFLICT (role, permission) DO NOTHING;

-- Asignar a planes de suscripción
INSERT INTO public.plan_permissions (plan, permission, granted) VALUES
  ('PRO', 'proveedores:view', true),
  ('PRO', 'proveedores:edit', true),
  ('BASE', 'proveedores:view', true),
  ('BASE', 'proveedores:edit', true)
ON CONFLICT (plan, permission) DO NOTHING;
