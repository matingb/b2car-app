CREATE TABLE public.movimientos_financieros (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id            uuid                     NOT NULL,
  cuenta_financiera_id uuid                     NOT NULL,
  importe              numeric(14,2)            NOT NULL,
  fecha                timestamp with time zone DEFAULT now() NOT NULL,
  operacion_id         uuid,
  created_at           timestamp with time zone DEFAULT now() NOT NULL,
  omc_id               uuid,
  reversion_de_id      uuid
);

CREATE INDEX idx_mov_cuenta_fecha ON public.movimientos_financieros (cuenta_financiera_id, fecha DESC, created_at DESC);

CREATE INDEX idx_mov_tenant_fecha ON public.movimientos_financieros (tenant_id, fecha DESC);

CREATE INDEX idx_mov_operacion ON public.movimientos_financieros (operacion_id)
  WHERE operacion_id IS NOT NULL;

CREATE INDEX idx_mf_omc_id ON public.movimientos_financieros (omc_id);

CREATE TRIGGER movimientos_financieros_actualizar_saldo
  AFTER INSERT ON public.movimientos_financieros
  FOR EACH ROW
  EXECUTE FUNCTION public._finanzas_actualizar_saldo_cuenta();

CREATE TRIGGER movimientos_financieros_bloquear_mutacion
  BEFORE DELETE OR UPDATE ON public.movimientos_financieros
  FOR EACH ROW
  EXECUTE FUNCTION public._finanzas_bloquear_mutacion_ledger();

CREATE TRIGGER movimientos_financieros_validar_tenant
  BEFORE INSERT ON public.movimientos_financieros
  FOR EACH ROW
  EXECUTE FUNCTION public._finanzas_validar_movimiento_tenant();

CREATE POLICY movimientos_financieros_tenant_select ON public.movimientos_financieros
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.movimientos_financieros
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.movimientos_financieros
  ADD CONSTRAINT movimientos_financieros_cuenta_financiera_id_fkey FOREIGN KEY (cuenta_financiera_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT;

ALTER TABLE public.movimientos_financieros
  ADD CONSTRAINT movimientos_financieros_pkey PRIMARY KEY (id);

ALTER TABLE public.movimientos_financieros
  ADD CONSTRAINT movimientos_financieros_reversion_de_id_fkey FOREIGN KEY (reversion_de_id) REFERENCES public.movimientos_financieros(id) ON DELETE SET NULL;

ALTER TABLE public.movimientos_financieros
  ADD CONSTRAINT movimientos_financieros_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON public.movimientos_financieros TO authenticated;

GRANT ALL ON public.movimientos_financieros TO service_role;