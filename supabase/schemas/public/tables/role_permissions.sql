CREATE TABLE "public"."role_permissions" (
  "role"       text    NOT NULL,
  "permission" text    NOT NULL,
  "granted"    boolean NOT NULL DEFAULT false,
  CONSTRAINT "role_permissions_permission_fkey" FOREIGN KEY (permission) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY (ROLE, permission),
  CONSTRAINT "fk_role_permissions_role" FOREIGN KEY (ROLE) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

ALTER TABLE "public"."role_permissions"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read role_permissions" ON "public"."role_permissions"
  FOR SELECT
  TO "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."role_permissions" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."role_permissions" TO "service_role";

REVOKE ALL ON TABLE "public"."role_permissions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."role_permissions" TO "postgres";
