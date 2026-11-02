CREATE TABLE public.categorias_arreglo (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id  uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  nombre     text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_categorias_arreglo_tenant_id ON public.categorias_arreglo (tenant_id);

CREATE UNIQUE INDEX uq_categorias_arreglo_tenant_nombre_lower ON public.categorias_arreglo (tenant_id, lower(nombre));

CREATE TRIGGER categorias_arreglo_set_updated_at
  BEFORE UPDATE ON public.categorias_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY tenant_access ON public.categorias_arreglo
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.categorias_arreglo
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.categorias_arreglo
  ADD CONSTRAINT categorias_arreglo_pkey PRIMARY KEY (id);

ALTER TABLE public.categorias_arreglo
  ADD CONSTRAINT categorias_arreglo_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT ALL ON public.categorias_arreglo TO anon;

GRANT ALL ON public.categorias_arreglo TO authenticated;

GRANT ALL ON public.categorias_arreglo TO service_role;