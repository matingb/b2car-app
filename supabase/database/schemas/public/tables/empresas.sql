CREATE TABLE public.empresas (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  cuit        text                     NOT NULL,
  direccion   text,
  nombre      text                     NOT NULL,
  email       text,
  created_at  timestamp with time zone DEFAULT now(),
  telefono    text,
  codigo_pais text,
  tenant_id   uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL
);

CREATE POLICY tenant_access ON public.empresas
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.empresas
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_id_fkey FOREIGN KEY (id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_tenant_cuit_unico UNIQUE (tenant_id, cuit);

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT ALL ON public.empresas TO anon;

GRANT ALL ON public.empresas TO authenticated;

GRANT ALL ON public.empresas TO service_role;