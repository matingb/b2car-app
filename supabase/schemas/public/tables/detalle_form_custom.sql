CREATE TABLE "public"."detalle_form_custom" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "arreglo_id" uuid                     NOT NULL,
  "config_id"  uuid,
  "costo"      numeric(12,2)            NOT NULL DEFAULT 0,
  "metadata"   jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "detalle_form_custom_arreglo_id_fkey" FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE CASCADE,
  CONSTRAINT "detalle_form_custom_pkey" PRIMARY KEY (id),
  CONSTRAINT "detalle_form_custom_config_id_fkey" FOREIGN KEY (config_id) REFERENCES public.formularios(id) ON DELETE SET NULL,
  "tenant_id"  uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "detalle_form_custom_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."detalle_form_custom"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_detalle_form_custom_arreglo_id ON public.detalle_form_custom USING btree (arreglo_id);

CREATE INDEX idx_detalle_form_custom_config_id ON public.detalle_form_custom USING btree (config_id);

CREATE TRIGGER detalle_form_custom_set_updated_at
  BEFORE UPDATE ON public.detalle_form_custom
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER facturacion_proteger_detalle_form_custom
  BEFORE INSERT OR DELETE OR UPDATE ON public.detalle_form_custom
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."detalle_form_custom" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."detalle_form_custom" TO "service_role";

CREATE INDEX idx_detalle_form_custom_tenant_arreglo ON public.detalle_form_custom USING btree (tenant_id, arreglo_id);

CREATE POLICY "tenant_access" ON "public"."detalle_form_custom"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."detalle_form_custom" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."detalle_form_custom" TO "postgres";
