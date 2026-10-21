CREATE TABLE "public"."proveedores" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"     text                     NOT NULL,
  "cuit"       text,
  "telefono"   text,
  "email"      text,
  "direccion"  text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "proveedores_pkey" PRIMARY KEY (id),
  CONSTRAINT "proveedores_nombre_not_empty" CHECK (char_length(btrim(nombre)) > 0),
  "tenant_id"  uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "proveedores_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."proveedores"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX uq_proveedores_tenant_cuit ON public.proveedores USING btree (tenant_id, cuit)
  WHERE (cuit IS NOT NULL AND btrim(cuit) <> '');

CREATE INDEX idx_proveedores_tenant_id ON public.proveedores USING btree (tenant_id);

CREATE INDEX idx_proveedores_tenant_nombre_lower ON public.proveedores USING btree (tenant_id, lower(nombre));

CREATE TRIGGER proveedores_set_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."proveedores" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."proveedores" TO "service_role";

CREATE POLICY "tenant_access" ON "public"."proveedores"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."proveedores" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."proveedores" TO "postgres";
