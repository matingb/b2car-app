CREATE TABLE public.tenant_members (
  cliente_id uuid                  NOT NULL,
  tenant_id  uuid                  NOT NULL,
  rol        character varying(50) DEFAULT 'admin'::character varying
);

CREATE POLICY tenant_members_select_own ON public.tenant_members
  FOR SELECT
  TO authenticated
  USING ((cliente_id = auth.uid()));

ALTER TABLE public.tenant_members
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_members
  ADD CONSTRAINT fk_tenant_members_rol FOREIGN KEY (rol) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.tenant_members
  ADD CONSTRAINT tenant_members_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES auth.users(id);

ALTER TABLE public.tenant_members
  ADD CONSTRAINT tenant_members_cliente_id_tenant_id_key UNIQUE (cliente_id, tenant_id);

ALTER TABLE public.tenant_members
  ADD CONSTRAINT tenant_members_pkey PRIMARY KEY (cliente_id);

ALTER TABLE public.tenant_members
  ADD CONSTRAINT tenant_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT ALL ON public.tenant_members TO anon;

GRANT ALL ON public.tenant_members TO authenticated;

GRANT ALL ON public.tenant_members TO service_role;