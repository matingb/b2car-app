CREATE TABLE "public"."tenant_members" (
  "cliente_id" uuid                  NOT NULL,
  "tenant_id"  uuid                  NOT NULL,
  "rol"        character varying(50) DEFAULT 'admin'::character varying,
  CONSTRAINT "fk_tenant_members_rol" FOREIGN KEY (rol) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "tenant_members_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES auth.users(id),
  CONSTRAINT "tenant_members_cliente_id_tenant_id_key" UNIQUE (cliente_id, tenant_id),
  CONSTRAINT "tenant_members_pkey" PRIMARY KEY (cliente_id),
  CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."tenant_members"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_select_own" ON "public"."tenant_members"
  FOR SELECT
  TO "authenticated"
  USING ((cliente_id = auth.uid()));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tenant_members" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tenant_members" TO "service_role";

REVOKE ALL ON TABLE "public"."tenant_members" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tenant_members" TO "postgres";
