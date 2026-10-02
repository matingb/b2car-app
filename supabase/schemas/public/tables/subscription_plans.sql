CREATE TABLE "public"."subscription_plans" (
  "id"          text                     NOT NULL,
  "nombre"      text                     NOT NULL,
  "descripcion" text,
  "activo"      boolean                  NOT NULL DEFAULT true,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."subscription_plans"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read subscription_plans" ON "public"."subscription_plans"
  FOR SELECT
  TO "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subscription_plans" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subscription_plans" TO "service_role";

REVOKE ALL ON TABLE "public"."subscription_plans" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subscription_plans" TO "postgres";
