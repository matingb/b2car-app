CREATE TABLE public.operaciones_ajuste_financiero (
  operacion_id uuid                     NOT NULL,
  tenant_id    uuid                     NOT NULL,
  cuenta_id    uuid                     NOT NULL,
  descripcion  text,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE CONSTRAINT TRIGGER trg_ajuste_financiero_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_ajuste_financiero DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY operaciones_ajuste_financiero_tenant_select ON public.operaciones_ajuste_financiero
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.operaciones_ajuste_financiero
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_ajuste_financiero
  ADD CONSTRAINT operaciones_ajuste_financiero_cuenta_id_fkey FOREIGN KEY (cuenta_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_ajuste_financiero
  ADD CONSTRAINT operaciones_ajuste_financiero_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_ajuste_financiero
  ADD CONSTRAINT operaciones_ajuste_financiero_pkey PRIMARY KEY (operacion_id);

ALTER TABLE public.operaciones_ajuste_financiero
  ADD CONSTRAINT operaciones_ajuste_financiero_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_ajuste_financiero TO authenticated;

GRANT ALL ON public.operaciones_ajuste_financiero TO service_role;