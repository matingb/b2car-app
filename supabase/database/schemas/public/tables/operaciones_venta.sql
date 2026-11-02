CREATE TABLE public.operaciones_venta (
  operacion_id uuid                     NOT NULL,
  tenant_id    uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  cliente_id   uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_op_venta_tenant ON public.operaciones_venta (tenant_id);

CREATE INDEX idx_op_venta_cliente ON public.operaciones_venta (tenant_id, cliente_id);

CREATE CONSTRAINT TRIGGER trg_venta_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_venta DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY tenant_access ON public.operaciones_venta
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND ((cliente_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.clientes c
  WHERE ((c.id = operaciones_venta.cliente_id) AND (c.tenant_id = public.current_tenant_id())))))));

ALTER TABLE public.operaciones_venta
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_venta
  ADD CONSTRAINT operaciones_venta_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_venta
  ADD CONSTRAINT operaciones_venta_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_venta
  ADD CONSTRAINT operaciones_venta_pkey PRIMARY KEY (operacion_id);

ALTER TABLE public.operaciones_venta
  ADD CONSTRAINT operaciones_venta_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_venta TO authenticated;

GRANT ALL ON public.operaciones_venta TO service_role;