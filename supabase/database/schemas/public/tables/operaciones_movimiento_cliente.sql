CREATE TABLE public.operaciones_movimiento_cliente (
  operacion_id uuid                     NOT NULL,
  tenant_id    uuid                     NOT NULL,
  cliente_id   uuid                     NOT NULL,
  cuenta_id    uuid                     NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE CONSTRAINT TRIGGER trg_movimiento_cliente_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_movimiento_cliente DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY operaciones_movimiento_cliente_tenant_select ON public.operaciones_movimiento_cliente
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.operaciones_movimiento_cliente
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_movimiento_cliente
  ADD CONSTRAINT fk_operaciones_movimiento_cliente_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_movimiento_cliente
  ADD CONSTRAINT fk_operaciones_movimiento_cliente_cuenta FOREIGN KEY (cuenta_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_movimiento_cliente
  ADD CONSTRAINT fk_operaciones_movimiento_cliente_operacion FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_movimiento_cliente
  ADD CONSTRAINT fk_operaciones_movimiento_cliente_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_movimiento_cliente
  ADD CONSTRAINT operaciones_movimiento_cliente_pkey PRIMARY KEY (operacion_id);

GRANT SELECT ON public.operaciones_movimiento_cliente TO authenticated;

GRANT ALL ON public.operaciones_movimiento_cliente TO service_role;

