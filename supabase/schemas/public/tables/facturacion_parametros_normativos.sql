CREATE TABLE "public"."facturacion_parametros_normativos" (
  "clave"          text                     NOT NULL,
  "vigente_desde"  date                     NOT NULL,
  "valor_numerico" numeric(18,2),
  "fuente"         text                     NOT NULL,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "facturacion_parametros_normativos_pkey" PRIMARY KEY (clave, vigente_desde)
);

ALTER TABLE "public"."facturacion_parametros_normativos"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facturacion_parametros_normativos_lectura" ON "public"."facturacion_parametros_normativos"
  FOR SELECT
  TO "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_parametros_normativos" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_parametros_normativos" TO "service_role";

REVOKE ALL ON TABLE "public"."facturacion_parametros_normativos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_parametros_normativos" TO "postgres";
