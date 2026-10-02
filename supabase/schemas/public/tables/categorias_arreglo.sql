CREATE TABLE "public"."categorias_arreglo" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"     text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "categorias_arreglo_pkey" PRIMARY KEY (id),
  "tenant_id"  uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "categorias_arreglo_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."categorias_arreglo"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER categorias_arreglo_set_updated_at
  BEFORE UPDATE ON public.categorias_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categorias_arreglo" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categorias_arreglo" TO "service_role";

CREATE INDEX idx_categorias_arreglo_tenant_id ON public.categorias_arreglo USING btree (tenant_id);

CREATE UNIQUE INDEX uq_categorias_arreglo_tenant_nombre_lower ON public.categorias_arreglo USING btree (tenant_id, lower(nombre));

CREATE POLICY "tenant_access" ON "public"."categorias_arreglo"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."categorias_arreglo" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categorias_arreglo" TO "postgres";
