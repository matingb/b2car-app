CREATE TABLE "public"."representantes" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "empresa_id"  uuid                     NOT NULL,
  "nombre"      text                     NOT NULL,
  "apellido"    text                     NOT NULL,
  "telefono"    text,
  "created_at"  timestamp with time zone DEFAULT now(),
  "codigo_pais" text,
  CONSTRAINT "representantes_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE,
  CONSTRAINT "representantes_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."representantes"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_representantes_empresa_id ON public.representantes USING btree (empresa_id);

CREATE POLICY "auth_access" ON "public"."representantes"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."representantes" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."representantes" TO "service_role";

REVOKE ALL ON TABLE "public"."representantes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."representantes" TO "postgres";
