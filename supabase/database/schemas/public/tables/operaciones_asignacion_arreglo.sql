CREATE TABLE public.operaciones_asignacion_arreglo (
  operacion_id uuid                     NOT NULL,
  arreglo_id   uuid                     NOT NULL,
  tenant_id    uuid                     DEFAULT public.current_tenant_id() NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX uq_operaciones_asignacion_arreglo_arreglo_id ON public.operaciones_asignacion_arreglo (arreglo_id);

CREATE INDEX idx_op_asig_arreglo_arreglo_id ON public.operaciones_asignacion_arreglo (arreglo_id);

CREATE TRIGGER b2c152_guardar_asignacion
  BEFORE INSERT OR UPDATE ON public.operaciones_asignacion_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public._b2c152_guardar_asignacion();

CREATE TRIGGER facturacion_proteger_asignacion_arreglo
  BEFORE INSERT OR DELETE OR UPDATE ON public.operaciones_asignacion_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE CONSTRAINT TRIGGER trg_asig_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_asignacion_arreglo DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE TRIGGER trg_operaciones_asignacion_arreglo_tenant
  BEFORE INSERT ON public.operaciones_asignacion_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_operaciones_asignacion_arreglo_tenant();

CREATE TRIGGER trigger_recalcular_precio_asignacion
  AFTER INSERT OR DELETE ON public.operaciones_asignacion_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

CREATE POLICY tenant_access ON public.operaciones_asignacion_arreglo
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.arreglos a
  WHERE ((a.id = operaciones_asignacion_arreglo.arreglo_id) AND (a.tenant_id = public.current_tenant_id()))))));

ALTER TABLE public.operaciones_asignacion_arreglo
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_asignacion_arreglo
  ADD CONSTRAINT operaciones_asignacion_arreglo_arreglo_id_fkey FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_asignacion_arreglo
  ADD CONSTRAINT operaciones_asignacion_arreglo_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_asignacion_arreglo
  ADD CONSTRAINT pk_operaciones_asignacion_arreglo PRIMARY KEY (operacion_id);

ALTER TABLE public.operaciones_asignacion_arreglo
  ADD CONSTRAINT operaciones_asignacion_arreglo_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_asignacion_arreglo TO authenticated;

GRANT ALL ON public.operaciones_asignacion_arreglo TO service_role;