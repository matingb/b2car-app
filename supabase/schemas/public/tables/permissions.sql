CREATE TABLE "public"."permissions" (
  "id"          text NOT NULL,
  "descripcion" text NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."permissions"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read permissions" ON "public"."permissions"
  FOR SELECT
  TO "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."permissions" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."permissions" TO "service_role";

REVOKE ALL ON TABLE "public"."permissions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."permissions" TO "postgres";
