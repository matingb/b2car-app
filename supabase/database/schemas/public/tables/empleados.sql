CREATE TABLE public.empleados (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id     uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  taller_id     uuid                     NOT NULL,
  nombre        text                     NOT NULL,
  apellido      text                     NOT NULL,
  dni           text                     NOT NULL,
  email         text,
  telefono      text,
  cumpleanos    date,
  salario       numeric,
  fecha_ingreso date,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL,
  valor_hora    numeric(12,2)
);

CREATE INDEX empleados_tenant_taller_idx ON public.empleados (tenant_id, taller_id);

CREATE INDEX empleados_tenant_id_idx ON public.empleados (tenant_id);

CREATE INDEX empleados_taller_id_idx ON public.empleados (taller_id);

CREATE TRIGGER empleados_proteger_valor_hora
  BEFORE INSERT OR UPDATE OF valor_hora ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public._b2c179_proteger_valor_hora_empleado();

CREATE TRIGGER empleados_set_updated_at
  BEFORE UPDATE ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY tenant_access ON public.empleados
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.empleados
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.empleados
  ADD CONSTRAINT empleados_pkey PRIMARY KEY (id);

ALTER TABLE public.empleados
  ADD CONSTRAINT empleados_salario_nonneg CHECK (salario IS NULL OR salario >= 0::numeric);

ALTER TABLE public.empleados
  ADD CONSTRAINT empleados_valor_hora_check CHECK (valor_hora IS NULL OR valor_hora >= 0::numeric);

ALTER TABLE public.empleados
  ADD CONSTRAINT empleados_taller_id_fkey FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE;

ALTER TABLE public.empleados
  ADD CONSTRAINT empleados_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.empleados TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.empleados TO authenticated;

GRANT SELECT (apellido, created_at, cumpleanos, dni, email, fecha_ingreso, id, nombre, salario, taller_id, telefono, tenant_id, updated_at) ON public.empleados TO authenticated;

GRANT ALL ON public.empleados TO service_role;