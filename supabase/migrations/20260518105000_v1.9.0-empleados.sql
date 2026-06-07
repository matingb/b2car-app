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

-- Historial de salarios: cada fila registra un salario y desde cuándo aplica.
-- Al crear un empleado con salario, el trigger inserta el primer registro.
-- Los cambios posteriores se insertan desde la API con la fecha elegida por el empleador.
CREATE TABLE IF NOT EXISTS public.empleado_salarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL,
  tenant_id uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  taller_id uuid NOT NULL,
  salario numeric NOT NULL,
  vigente_desde date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empleado_salarios_salario_nonneg CHECK (salario >= 0),
  CONSTRAINT empleado_salarios_empleado_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE CASCADE,
  CONSTRAINT empleado_salarios_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT empleado_salarios_taller_fkey FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE,
  CONSTRAINT empleado_salarios_unique_vigencia UNIQUE (empleado_id, vigente_desde)
);

ALTER TABLE public.empleado_salarios OWNER TO postgres;

CREATE INDEX IF NOT EXISTS empleado_salarios_empleado_id_idx  ON public.empleado_salarios USING btree (empleado_id);
CREATE INDEX IF NOT EXISTS empleado_salarios_vigente_desde_idx ON public.empleado_salarios USING btree (vigente_desde);
CREATE INDEX IF NOT EXISTS empleado_salarios_tenant_id_idx    ON public.empleado_salarios USING btree (tenant_id);

ALTER TABLE public.empleado_salarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_access ON public.empleado_salarios
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empleado_salarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empleado_salarios TO service_role;

-- Trigger: registra el salario inicial al crear un empleado.
-- Usa fecha_ingreso si está disponible, sino el primer día del mes actual.
CREATE OR REPLACE FUNCTION public.empleados_register_initial_salario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.salario IS NOT NULL THEN
    INSERT INTO public.empleado_salarios (empleado_id, tenant_id, taller_id, salario, vigente_desde)
    VALUES (
      NEW.id,
      NEW.tenant_id,
      NEW.taller_id,
      NEW.salario,
      COALESCE(NEW.fecha_ingreso, date_trunc('month', CURRENT_DATE)::date)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER empleados_initial_salario
  AFTER INSERT ON public.empleados
  FOR EACH ROW EXECUTE FUNCTION public.empleados_register_initial_salario();
