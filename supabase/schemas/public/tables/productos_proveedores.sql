CREATE TABLE "public"."productos_proveedores" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  "producto_id"       uuid                     NOT NULL,
  "proveedor_id"      uuid                     NOT NULL,
  "codigo_proveedor"  text,
  "costo_referencia"  numeric(14,2)            NOT NULL DEFAULT 0.00,
  "es_predeterminado" boolean                  NOT NULL DEFAULT false,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "productos_proveedores_pkey" PRIMARY KEY (id),
  CONSTRAINT "productos_proveedores_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT "productos_proveedores_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE,
  CONSTRAINT "productos_proveedores_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE CASCADE,
  CONSTRAINT "productos_proveedores_costo_nonneg" CHECK ((costo_referencia >= (0)::numeric)),
  CONSTRAINT "uq_productos_proveedores" UNIQUE (tenant_id, producto_id, proveedor_id)
);

ALTER TABLE "public"."productos_proveedores" ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_prod_prov_proveedor ON public.productos_proveedores USING btree (tenant_id, proveedor_id);
CREATE INDEX idx_prod_prov_producto ON public.productos_proveedores USING btree (tenant_id, producto_id);

CREATE TRIGGER productos_proveedores_set_updated_at
  BEFORE UPDATE ON public.productos_proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "tenant_access" ON "public"."productos_proveedores"
  FOR ALL
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

GRANT ALL ON TABLE "public"."productos_proveedores" TO "anon", "authenticated", "service_role", "postgres";
