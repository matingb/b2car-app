CREATE TABLE "public"."tenants" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"         character varying(255)   NOT NULL,
  "fecha_creacion" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "plan_sub"       text                     NOT NULL DEFAULT 'BASE'::text,
  CONSTRAINT "fk_tenants_plan_sub" FOREIGN KEY (plan_sub) REFERENCES public.subscription_plans(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "tenants_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."tenants"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tenants"
  ADD COLUMN "estado" public.tenant_estado NOT NULL DEFAULT 'activo'::public.tenant_estado;

CREATE TRIGGER update_tenant_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tenants" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tenants" TO "service_role";

REVOKE ALL ON TABLE "public"."tenants" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tenants" TO "postgres";
