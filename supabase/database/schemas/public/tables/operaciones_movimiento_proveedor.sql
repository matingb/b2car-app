CREATE TABLE public.operaciones_movimiento_proveedor (
  operacion_id uuid                     NOT NULL,
  tenant_id    uuid                     NOT NULL,
  proveedor_id uuid                     NOT NULL,
  cuenta_id    uuid                     NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE CONSTRAINT TRIGGER trg_movimiento_proveedor_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_movimiento_proveedor DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY operaciones_movimiento_proveedor_tenant_select ON public.operaciones_movimiento_proveedor
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.operaciones_movimiento_proveedor
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_movimiento_proveedor
  ADD CONSTRAINT fk_operaciones_movimiento_proveedor_cuenta FOREIGN KEY (cuenta_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_movimiento_proveedor
  ADD CONSTRAINT fk_operaciones_movimiento_proveedor_operacion FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_movimiento_proveedor
  ADD CONSTRAINT fk_operaciones_movimiento_proveedor_proveedor FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_movimiento_proveedor
  ADD CONSTRAINT fk_operaciones_movimiento_proveedor_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_movimiento_proveedor
  ADD CONSTRAINT operaciones_movimiento_proveedor_pkey PRIMARY KEY (operacion_id);

GRANT SELECT ON public.operaciones_movimiento_proveedor TO authenticated;

GRANT ALL ON public.operaciones_movimiento_proveedor TO service_role;

