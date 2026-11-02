CREATE TABLE public.operaciones_ajuste (
  operacion_id uuid                     NOT NULL,
  tenant_id    uuid                     NOT NULL,
  motivo       text                     NOT NULL,
  descripcion  text,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE CONSTRAINT TRIGGER trg_ajuste_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_ajuste DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY tenant_access ON public.operaciones_ajuste
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.operaciones_ajuste
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_ajuste
  ADD CONSTRAINT operaciones_ajuste_motivo_check CHECK (motivo = ANY (ARRAY['INICIAL'::text, 'MANUAL'::text, 'DEVOLUCION_NC'::text]));

ALTER TABLE public.operaciones_ajuste
  ADD CONSTRAINT operaciones_ajuste_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_ajuste
  ADD CONSTRAINT operaciones_ajuste_pkey PRIMARY KEY (operacion_id);

ALTER TABLE public.operaciones_ajuste
  ADD CONSTRAINT operaciones_ajuste_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_ajuste TO authenticated;

GRANT ALL ON public.operaciones_ajuste TO service_role;