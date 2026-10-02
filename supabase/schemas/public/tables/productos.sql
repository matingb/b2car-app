CREATE TABLE "public"."productos" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "codigo"          text                     NOT NULL,
  "nombre"          text                     NOT NULL,
  "marca"           text,
  "modelo"          text,
  "descripcion"     text,
  "precio_unitario" numeric                  NOT NULL DEFAULT 0,
  "costo_unitario"  numeric                  NOT NULL DEFAULT 0,
  "proveedor"       text,
  "categorias"      text[]                   NOT NULL DEFAULT '{}'::text[],
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "show_in_stock"   boolean                  NOT NULL DEFAULT true,
  "iva_alicuota_id" smallint                 NOT NULL DEFAULT 5,
  CONSTRAINT "productos_costo_nonneg" CHECK ((costo_unitario >= (0)::numeric)),
  CONSTRAINT "productos_iva_alicuota_id_check" CHECK ((iva_alicuota_id = ANY (ARRAY[3, 4, 5, 6, 8, 9]))),
  CONSTRAINT "productos_pkey" PRIMARY KEY (id),
  CONSTRAINT "productos_precio_nonneg" CHECK ((precio_unitario >= (0)::numeric)),
  "tenant_id"       uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "productos_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."productos"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER productos_set_updated_at
  BEFORE UPDATE ON public.productos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."productos" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."productos" TO "service_role";

CREATE INDEX productos_tenant_id_idx ON public.productos USING btree (tenant_id);

CREATE UNIQUE INDEX uq_productos_tenant_codigo ON public.productos USING btree (tenant_id, codigo);

CREATE POLICY "tenant_access" ON "public"."productos"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."productos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."productos" TO "postgres";
