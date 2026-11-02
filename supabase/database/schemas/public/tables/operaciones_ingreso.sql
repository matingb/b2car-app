CREATE TABLE public.operaciones_ingreso (
  operacion_id uuid                     NOT NULL,
  tenant_id    uuid                     NOT NULL,
  cuenta_id    uuid                     NOT NULL,
  concepto     text                     NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE CONSTRAINT TRIGGER trg_ingreso_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_ingreso DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY tenant_access ON public.operaciones_ingreso
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.operaciones_ingreso
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_ingreso
  ADD CONSTRAINT operaciones_ingreso_concepto_check CHECK (btrim(concepto) <> ''::text);

ALTER TABLE public.operaciones_ingreso
  ADD CONSTRAINT operaciones_ingreso_cuenta_id_fkey FOREIGN KEY (cuenta_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_ingreso
  ADD CONSTRAINT operaciones_ingreso_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_ingreso
  ADD CONSTRAINT operaciones_ingreso_pkey PRIMARY KEY (operacion_id);

ALTER TABLE public.operaciones_ingreso
  ADD CONSTRAINT operaciones_ingreso_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_ingreso TO authenticated;

GRANT ALL ON public.operaciones_ingreso TO service_role;