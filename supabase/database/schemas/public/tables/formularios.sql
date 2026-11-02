CREATE TABLE public.formularios (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id            uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  descripcion          text                     NOT NULL,
  costodefault         numeric(12,2)            DEFAULT 0 NOT NULL,
  metadata             jsonb,
  created_at           timestamp with time zone DEFAULT now() NOT NULL,
  updated_at           timestamp with time zone DEFAULT now() NOT NULL,
  categoria_arreglo_id uuid
);

CREATE INDEX idx_formularios_categoria_arreglo_id ON public.formularios (categoria_arreglo_id);

CREATE INDEX idx_formularios_tenant ON public.formularios (tenant_id);

CREATE TRIGGER formularios_set_updated_at
  BEFORE UPDATE ON public.formularios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY tenant_access ON public.formularios
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.formularios
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.formularios
  ADD CONSTRAINT formularios_categoria_arreglo_id_fkey FOREIGN KEY (categoria_arreglo_id) REFERENCES public.categorias_arreglo(id) ON DELETE SET NULL;

ALTER TABLE public.formularios
  ADD CONSTRAINT formularios_pkey PRIMARY KEY (id);

ALTER TABLE public.formularios
  ADD CONSTRAINT formularios_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT ALL ON public.formularios TO anon;

GRANT ALL ON public.formularios TO authenticated;

GRANT ALL ON public.formularios TO service_role;