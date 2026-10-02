CREATE TABLE "public"."empresas" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "cuit"        text                     NOT NULL,
  "direccion"   text,
  "nombre"      text                     NOT NULL,
  "email"       text,
  "created_at"  timestamp with time zone DEFAULT now(),
  "telefono"    text,
  "codigo_pais" text,
  CONSTRAINT "empresas_id_fkey" FOREIGN KEY (id) REFERENCES public.clientes(id) ON DELETE CASCADE,
  CONSTRAINT "empresas_pkey" PRIMARY KEY (id),
  "tenant_id"   uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "empresas_tenant_cuit_unico" UNIQUE (tenant_id, cuit),
  CONSTRAINT "empresas_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."empresas"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."empresas" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."empresas" TO "service_role";

CREATE POLICY "tenant_access" ON "public"."empresas"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."empresas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."empresas" TO "postgres";
