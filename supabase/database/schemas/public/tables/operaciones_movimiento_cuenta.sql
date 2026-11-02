CREATE TABLE public.operaciones_movimiento_cuenta (
  operacion_id    uuid                     NOT NULL,
  tenant_id       uuid                     NOT NULL,
  cuenta_id       uuid                     NOT NULL,
  importe         numeric(14,2),
  descripcion     text,
  idempotency_key uuid,
  created_by      uuid,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  fecha           timestamp with time zone NOT NULL
);

CREATE INDEX idx_omc_operacion_id ON public.operaciones_movimiento_cuenta (operacion_id);

CREATE INDEX idx_omc_tenant ON public.operaciones_movimiento_cuenta (tenant_id);

CREATE INDEX idx_omc_cuenta ON public.operaciones_movimiento_cuenta (cuenta_id)
  WHERE cuenta_id IS NOT NULL;

CREATE UNIQUE INDEX omc_tenant_idempotency_key ON public.operaciones_movimiento_cuenta (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TRIGGER omc_after_delete
  AFTER DELETE ON public.operaciones_movimiento_cuenta
  FOR EACH ROW
  EXECUTE FUNCTION public._omc_after_delete();

CREATE TRIGGER omc_after_insert
  AFTER INSERT ON public.operaciones_movimiento_cuenta
  FOR EACH ROW
  EXECUTE FUNCTION public._omc_after_insert();

CREATE TRIGGER omc_after_update
  AFTER UPDATE ON public.operaciones_movimiento_cuenta
  FOR EACH ROW
  EXECUTE FUNCTION public._omc_after_update();

CREATE TRIGGER omc_validar
  BEFORE INSERT OR UPDATE ON public.operaciones_movimiento_cuenta
  FOR EACH ROW
  EXECUTE FUNCTION public._omc_validar();

CREATE TRIGGER trg_omc_sync_total_pagado
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_movimiento_cuenta
  FOR EACH ROW
  EXECUTE FUNCTION public._omc_sync_total_pagado();

CREATE CONSTRAINT TRIGGER trg_omc_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_movimiento_cuenta DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY omc_tenant_select ON public.operaciones_movimiento_cuenta
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

CREATE POLICY tenant_access ON public.operaciones_movimiento_cuenta
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.operaciones_movimiento_cuenta
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_movimiento_cuenta
  ADD CONSTRAINT omc_importe_check CHECK (importe <> 0::numeric);

ALTER TABLE public.operaciones_movimiento_cuenta
  ADD CONSTRAINT operaciones_movimiento_cuenta_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.operaciones_movimiento_cuenta
  ADD CONSTRAINT operaciones_movimiento_cuenta_cuenta_id_fkey FOREIGN KEY (cuenta_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_movimiento_cuenta
  ADD CONSTRAINT operaciones_movimiento_cuenta_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_movimiento_cuenta
  ADD CONSTRAINT operaciones_movimiento_cuenta_pkey PRIMARY KEY (id);

ALTER TABLE public.operaciones_movimiento_cuenta
  ADD CONSTRAINT operaciones_movimiento_cuenta_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_movimiento_cuenta TO authenticated;

GRANT ALL ON public.operaciones_movimiento_cuenta TO service_role;