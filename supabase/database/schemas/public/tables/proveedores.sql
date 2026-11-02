CREATE TABLE public.proveedores (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id  uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  nombre     text                     NOT NULL,
  cuit       text,
  telefono   text,
  email      text,
  direccion  text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX uq_proveedores_tenant_cuit ON public.proveedores (tenant_id, cuit)
  WHERE cuit IS NOT NULL AND btrim(cuit) <> ''::text;

CREATE INDEX idx_proveedores_tenant_id ON public.proveedores (tenant_id);

CREATE INDEX idx_proveedores_tenant_nombre_lower ON public.proveedores (tenant_id, lower(nombre));

CREATE TRIGGER proveedores_set_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY tenant_access ON public.proveedores
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.proveedores
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.proveedores
  ADD CONSTRAINT proveedores_nombre_not_empty CHECK (char_length(btrim(nombre)) > 0);

ALTER TABLE public.proveedores
  ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);

ALTER TABLE public.proveedores
  ADD CONSTRAINT proveedores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT ALL ON public.proveedores TO anon;

GRANT ALL ON public.proveedores TO authenticated;

GRANT ALL ON public.proveedores TO service_role;