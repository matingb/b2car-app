CREATE TABLE "public"."cuentas_financieras" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       uuid                     NOT NULL,
  "nombre"          text                     NOT NULL,
  "tipo"            text                     NOT NULL,
  "saldo"           numeric(14,2)            NOT NULL DEFAULT 0,
  "activo"          boolean                  NOT NULL DEFAULT true,
  "idempotency_key" uuid,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "favorita"        boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "cuentas_financieras_favorita_activa_check" CHECK (((NOT favorita) OR activo)),
  CONSTRAINT "cuentas_financieras_nombre_no_vacio" CHECK ((NULLIF(btrim(nombre), ''::text) IS NOT NULL)),
  CONSTRAINT "cuentas_financieras_pkey" PRIMARY KEY (id),
  CONSTRAINT "cuentas_financieras_tipo_check" CHECK ((tipo = ANY (ARRAY['EFECTIVO'::text, 'CUENTA_BANCARIA'::text, 'BILLETERA_DIGITAL'::text, 'TARJETA_CREDITO'::text]))),
  CONSTRAINT "cuentas_financieras_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."cuentas_financieras"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX cuentas_financieras_tenant_favorita_key ON public.cuentas_financieras USING btree (tenant_id)
  WHERE favorita;

CREATE UNIQUE INDEX cuentas_financieras_tenant_idempotency_key ON public.cuentas_financieras USING btree (tenant_id, idempotency_key)
  WHERE (idempotency_key IS NOT NULL);

CREATE UNIQUE INDEX cuentas_financieras_tenant_nombre_activo_key ON public.cuentas_financieras USING btree (tenant_id, lower(nombre))
  WHERE activo;

CREATE INDEX idx_cuentas_financieras_tenant_activo ON public.cuentas_financieras USING btree (tenant_id, activo, created_at DESC);

CREATE TRIGGER cuentas_financieras_set_updated_at
  BEFORE UPDATE ON public.cuentas_financieras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "cuentas_financieras_tenant_select" ON "public"."cuentas_financieras"
  FOR SELECT
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cuentas_financieras" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cuentas_financieras" TO "service_role";

REVOKE ALL ON TABLE "public"."cuentas_financieras" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cuentas_financieras" TO "postgres";
