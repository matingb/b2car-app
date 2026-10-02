CREATE TABLE "public"."talleres" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"     text                     NOT NULL,
  "ubicacion"  text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "valor_hora" numeric(12,2)            NOT NULL DEFAULT 0,
  CONSTRAINT "talleres_pkey" PRIMARY KEY (id),
  CONSTRAINT "talleres_valor_hora_check" CHECK ((valor_hora >= (0)::numeric)),
  "tenant_id"  uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "talleres_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."talleres"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER talleres_set_updated_at
  BEFORE UPDATE ON public.talleres
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."talleres" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."talleres" TO "service_role";

CREATE INDEX talleres_tenant_id_idx ON public.talleres USING btree (tenant_id);

CREATE POLICY "tenant_access" ON "public"."talleres"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."talleres" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."talleres" TO "postgres";
