CREATE TABLE public.productos_proveedores (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id         uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  producto_id       uuid                     NOT NULL,
  proveedor_id      uuid                     NOT NULL,
  codigo_proveedor  text,
  costo_referencia  numeric(14,2)            DEFAULT 0.00 NOT NULL,
  es_predeterminado boolean                  DEFAULT false NOT NULL,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  updated_at        timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_prod_prov_producto ON public.productos_proveedores (tenant_id, producto_id);

CREATE INDEX idx_prod_prov_proveedor ON public.productos_proveedores (tenant_id, proveedor_id);

CREATE TRIGGER productos_proveedores_set_updated_at
  BEFORE UPDATE ON public.productos_proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY tenant_access ON public.productos_proveedores
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.productos_proveedores
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.productos_proveedores
  ADD CONSTRAINT productos_proveedores_costo_nonneg CHECK (costo_referencia >= 0::numeric);

ALTER TABLE public.productos_proveedores
  ADD CONSTRAINT productos_proveedores_pkey PRIMARY KEY (id);

ALTER TABLE public.productos_proveedores
  ADD CONSTRAINT productos_proveedores_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

ALTER TABLE public.productos_proveedores
  ADD CONSTRAINT uq_productos_proveedores UNIQUE (tenant_id, producto_id, proveedor_id);

ALTER TABLE public.productos_proveedores
  ADD CONSTRAINT productos_proveedores_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE CASCADE;

ALTER TABLE public.productos_proveedores
  ADD CONSTRAINT productos_proveedores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT ALL ON public.productos_proveedores TO anon;

GRANT ALL ON public.productos_proveedores TO authenticated;

GRANT ALL ON public.productos_proveedores TO service_role;