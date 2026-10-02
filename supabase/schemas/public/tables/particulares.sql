CREATE TABLE "public"."particulares" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"      character varying(100)   NOT NULL,
  "apellido"    character varying(100)   NOT NULL,
  "telefono"    text,
  "email"       text,
  "created_at"  timestamp with time zone DEFAULT now(),
  "direccion"   text,
  "codigo_pais" text,
  "dni_cuil"    text,
  CONSTRAINT "particulares_dni_cuil_formato_valido" CHECK (((dni_cuil IS NULL) OR (dni_cuil ~ '^(?:[0-9]{7,8}|[0-9]{11})$'::text))),
  CONSTRAINT "particulares_id_fkey" FOREIGN KEY (id) REFERENCES public.clientes(id) ON DELETE CASCADE,
  CONSTRAINT "personas_pkey" PRIMARY KEY (id),
  "tenant_id"   uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "particulares_tenant_dni_cuil_unico" UNIQUE (tenant_id, dni_cuil),
  CONSTRAINT "particulares_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."particulares"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_personas_email ON public.particulares USING btree (email);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."particulares" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."particulares" TO "service_role";

CREATE POLICY "tenant_access" ON "public"."particulares"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."particulares" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."particulares" TO "postgres";
