CREATE TABLE public.empleado_salarios (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  empleado_id   uuid                     NOT NULL,
  tenant_id     uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  taller_id     uuid                     NOT NULL,
  salario       numeric                  NOT NULL,
  vigente_desde date                     NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX empleado_salarios_tenant_id_idx ON public.empleado_salarios (tenant_id);

CREATE INDEX empleado_salarios_empleado_id_idx ON public.empleado_salarios (empleado_id);

CREATE INDEX empleado_salarios_vigente_desde_idx ON public.empleado_salarios (vigente_desde);

CREATE POLICY tenant_access ON public.empleado_salarios
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.empleado_salarios
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.empleado_salarios
  ADD CONSTRAINT empleado_salarios_pkey PRIMARY KEY (id);

ALTER TABLE public.empleado_salarios
  ADD CONSTRAINT empleado_salarios_salario_nonneg CHECK (salario >= 0::numeric);

ALTER TABLE public.empleado_salarios
  ADD CONSTRAINT empleado_salarios_unique_vigencia UNIQUE (empleado_id, vigente_desde);

ALTER TABLE public.empleado_salarios
  ADD CONSTRAINT empleado_salarios_empleado_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE CASCADE;

ALTER TABLE public.empleado_salarios
  ADD CONSTRAINT empleado_salarios_taller_fkey FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE;

ALTER TABLE public.empleado_salarios
  ADD CONSTRAINT empleado_salarios_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT ALL ON public.empleado_salarios TO anon;

GRANT ALL ON public.empleado_salarios TO authenticated;

GRANT ALL ON public.empleado_salarios TO service_role;