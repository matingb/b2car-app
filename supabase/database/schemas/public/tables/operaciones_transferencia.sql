CREATE TABLE public.operaciones_transferencia (
  operacion_id      uuid                     NOT NULL,
  tenant_id         uuid                     NOT NULL,
  cuenta_origen_id  uuid                     NOT NULL,
  cuenta_destino_id uuid                     NOT NULL,
  created_at        timestamp with time zone DEFAULT now() NOT NULL
);

CREATE CONSTRAINT TRIGGER trg_transferencia_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_transferencia DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY tenant_access ON public.operaciones_transferencia
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.operaciones_transferencia
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_transferencia
  ADD CONSTRAINT operaciones_transferencia_cuenta_destino_id_fkey FOREIGN KEY (cuenta_destino_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_transferencia
  ADD CONSTRAINT operaciones_transferencia_cuenta_origen_id_fkey FOREIGN KEY (cuenta_origen_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_transferencia
  ADD CONSTRAINT operaciones_transferencia_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_transferencia
  ADD CONSTRAINT operaciones_transferencia_pkey PRIMARY KEY (operacion_id);

ALTER TABLE public.operaciones_transferencia
  ADD CONSTRAINT transferencias_cuentas_distintas CHECK (cuenta_origen_id <> cuenta_destino_id);

ALTER TABLE public.operaciones_transferencia
  ADD CONSTRAINT operaciones_transferencia_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_transferencia TO authenticated;

GRANT ALL ON public.operaciones_transferencia TO service_role;