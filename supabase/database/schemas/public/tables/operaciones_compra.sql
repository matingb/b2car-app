CREATE TABLE public.operaciones_compra (
  operacion_id uuid                     NOT NULL,
  tenant_id    uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  proveedor_id uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_op_compra_tenant ON public.operaciones_compra (tenant_id);

CREATE INDEX idx_op_compra_proveedor ON public.operaciones_compra (tenant_id, proveedor_id);

CREATE CONSTRAINT TRIGGER trg_compra_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_compra DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY tenant_access ON public.operaciones_compra
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND ((proveedor_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.proveedores p
  WHERE ((p.id = operaciones_compra.proveedor_id) AND (p.tenant_id = public.current_tenant_id())))))));

ALTER TABLE public.operaciones_compra
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_compra
  ADD CONSTRAINT operaciones_compra_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_compra
  ADD CONSTRAINT operaciones_compra_pkey PRIMARY KEY (operacion_id);

ALTER TABLE public.operaciones_compra
  ADD CONSTRAINT operaciones_compra_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_compra
  ADD CONSTRAINT operaciones_compra_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_compra TO authenticated;

GRANT ALL ON public.operaciones_compra TO service_role;