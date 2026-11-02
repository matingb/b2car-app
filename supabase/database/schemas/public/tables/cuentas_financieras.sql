CREATE TABLE public.cuentas_financieras (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id       uuid                     NOT NULL,
  nombre          text                     NOT NULL,
  tipo            text                     NOT NULL,
  saldo           numeric(14,2)            DEFAULT 0 NOT NULL,
  activo          boolean                  DEFAULT true NOT NULL,
  idempotency_key uuid,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL,
  favorita        boolean                  DEFAULT false NOT NULL
);

CREATE UNIQUE INDEX cuentas_financieras_tenant_idempotency_key ON public.cuentas_financieras (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX cuentas_financieras_tenant_favorita_key ON public.cuentas_financieras (tenant_id)
  WHERE favorita;

CREATE UNIQUE INDEX cuentas_financieras_tenant_nombre_activo_key ON public.cuentas_financieras (tenant_id, lower(nombre))
  WHERE activo;

CREATE INDEX idx_cuentas_financieras_tenant_activo ON public.cuentas_financieras (tenant_id, activo, created_at DESC);

CREATE TRIGGER cuentas_financieras_set_updated_at
  BEFORE UPDATE ON public.cuentas_financieras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY cuentas_financieras_tenant_select ON public.cuentas_financieras
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.cuentas_financieras
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cuentas_financieras
  ADD CONSTRAINT cuentas_financieras_favorita_activa_check CHECK (NOT favorita OR activo);

ALTER TABLE public.cuentas_financieras
  ADD CONSTRAINT cuentas_financieras_nombre_no_vacio CHECK (NULLIF(btrim(nombre), ''::text) IS NOT NULL);

ALTER TABLE public.cuentas_financieras
  ADD CONSTRAINT cuentas_financieras_pkey PRIMARY KEY (id);

ALTER TABLE public.cuentas_financieras
  ADD CONSTRAINT cuentas_financieras_tipo_check CHECK (tipo = ANY (ARRAY['EFECTIVO'::text, 'CUENTA_BANCARIA'::text, 'BILLETERA_DIGITAL'::text, 'TARJETA_CREDITO'::text]));

ALTER TABLE public.cuentas_financieras
  ADD CONSTRAINT cuentas_financieras_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT ALL ON public.cuentas_financieras TO authenticated;

GRANT ALL ON public.cuentas_financieras TO service_role;