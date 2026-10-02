CREATE TABLE "public"."plan_permissions" (
  "plan"       text    NOT NULL,
  "permission" text    NOT NULL,
  "granted"    boolean NOT NULL DEFAULT false,
  CONSTRAINT "plan_permissions_permission_fkey" FOREIGN KEY (permission) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "plan_permissions_pkey" PRIMARY KEY (plan, permission),
  CONSTRAINT "fk_plan_permissions_plan" FOREIGN KEY (plan) REFERENCES public.subscription_plans(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

ALTER TABLE "public"."plan_permissions"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read plan_permissions" ON "public"."plan_permissions"
  FOR SELECT
  TO "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."plan_permissions" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."plan_permissions" TO "service_role";

REVOKE ALL ON TABLE "public"."plan_permissions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."plan_permissions" TO "postgres";
