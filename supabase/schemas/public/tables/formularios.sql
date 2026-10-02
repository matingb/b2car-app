CREATE TABLE "public"."formularios" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "descripcion"          text                     NOT NULL,
  "costodefault"         numeric(12,2)            NOT NULL DEFAULT 0,
  "metadata"             jsonb,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "categoria_arreglo_id" uuid,
  CONSTRAINT "formularios_categoria_arreglo_id_fkey" FOREIGN KEY (categoria_arreglo_id) REFERENCES public.categorias_arreglo(id) ON DELETE SET NULL,
  CONSTRAINT "formularios_pkey" PRIMARY KEY (id),
  "tenant_id"            uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "formularios_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."formularios"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_formularios_categoria_arreglo_id ON public.formularios USING btree (categoria_arreglo_id);

CREATE TRIGGER formularios_set_updated_at
  BEFORE UPDATE ON public.formularios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."formularios" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."formularios" TO "service_role";

CREATE INDEX idx_formularios_tenant ON public.formularios USING btree (tenant_id);

CREATE POLICY "tenant_access" ON "public"."formularios"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."formularios" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."formularios" TO "postgres";
