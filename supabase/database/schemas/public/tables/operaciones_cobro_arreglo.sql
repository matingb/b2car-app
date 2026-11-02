CREATE TABLE public.operaciones_cobro_arreglo (
  operacion_id uuid                     NOT NULL,
  arreglo_id   uuid                     NOT NULL,
  tenant_id    uuid                     NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_op_cobro_arreglo_id ON public.operaciones_cobro_arreglo (arreglo_id);

CREATE INDEX idx_op_cobro_tenant ON public.operaciones_cobro_arreglo (tenant_id);

CREATE CONSTRAINT TRIGGER trg_cobro_arreglo_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_cobro_arreglo DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY operaciones_cobro_arreglo_tenant_select ON public.operaciones_cobro_arreglo
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

CREATE POLICY tenant_access ON public.operaciones_cobro_arreglo
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.arreglos a
  WHERE ((a.id = operaciones_cobro_arreglo.arreglo_id) AND (a.tenant_id = public.current_tenant_id()))))));

ALTER TABLE public.operaciones_cobro_arreglo
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_cobro_arreglo
  ADD CONSTRAINT operaciones_cobro_arreglo_arreglo_id_fkey FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_cobro_arreglo
  ADD CONSTRAINT operaciones_cobro_arreglo_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_cobro_arreglo
  ADD CONSTRAINT operaciones_cobro_arreglo_pkey PRIMARY KEY (operacion_id);

ALTER TABLE public.operaciones_cobro_arreglo
  ADD CONSTRAINT operaciones_cobro_arreglo_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_cobro_arreglo TO authenticated;

GRANT ALL ON public.operaciones_cobro_arreglo TO service_role;