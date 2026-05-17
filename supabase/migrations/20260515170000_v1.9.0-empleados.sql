-- v1.9.0 - Crea la tabla `empleados` para el módulo de gestión de personal del taller.
-- Multi-tenant: scoped por tenant_id (default desde JWT, igual que productos/talleres).
-- taller_id apunta a public.talleres con ON DELETE CASCADE: al eliminar un taller
-- se eliminan también los empleados asociados.

CREATE TABLE IF NOT EXISTS public.empleados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  taller_id uuid NOT NULL,
  nombre text NOT NULL,
  apellido text NOT NULL,
  dni text NOT NULL,
  email text,
  telefono text,
  cumpleanos date,
  salario numeric,
  fecha_ingreso date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empleados_salario_nonneg CHECK (salario IS NULL OR salario >= 0),
  CONSTRAINT empleados_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT empleados_taller_id_fkey FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE
);

ALTER TABLE public.empleados OWNER TO postgres;

CREATE INDEX IF NOT EXISTS empleados_tenant_id_idx ON public.empleados USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS empleados_taller_id_idx ON public.empleados USING btree (taller_id);
CREATE INDEX IF NOT EXISTS empleados_tenant_taller_idx ON public.empleados USING btree (tenant_id, taller_id);

CREATE OR REPLACE TRIGGER empleados_set_updated_at
  BEFORE UPDATE ON public.empleados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_access ON public.empleados
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empleados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empleados TO service_role;
