CREATE TABLE public.productos (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id       uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  codigo          text                     NOT NULL,
  nombre          text                     NOT NULL,
  marca           text,
  modelo          text,
  descripcion     text,
  precio_unitario numeric                  DEFAULT 0 NOT NULL,
  costo_unitario  numeric                  DEFAULT 0 NOT NULL,
  categorias      text[]                   DEFAULT '{}'::text[] NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL,
  show_in_stock   boolean                  DEFAULT true NOT NULL,
  iva_alicuota_id smallint                 DEFAULT 5 NOT NULL
);

CREATE UNIQUE INDEX uq_productos_tenant_codigo ON public.productos (tenant_id, codigo);

CREATE INDEX productos_tenant_id_idx ON public.productos (tenant_id);

CREATE TRIGGER productos_set_updated_at
  BEFORE UPDATE ON public.productos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY tenant_access ON public.productos
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.productos
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.productos
  ADD CONSTRAINT productos_costo_nonneg CHECK (costo_unitario >= 0::numeric);

ALTER TABLE public.productos
  ADD CONSTRAINT productos_iva_alicuota_id_check CHECK (iva_alicuota_id = ANY (ARRAY[3, 4, 5, 6, 8, 9]));

ALTER TABLE public.productos
  ADD CONSTRAINT productos_pkey PRIMARY KEY (id);

ALTER TABLE public.productos
  ADD CONSTRAINT productos_precio_nonneg CHECK (precio_unitario >= 0::numeric);

ALTER TABLE public.productos
  ADD CONSTRAINT productos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT ALL ON public.productos TO anon;

GRANT ALL ON public.productos TO authenticated;

GRANT ALL ON public.productos TO service_role;