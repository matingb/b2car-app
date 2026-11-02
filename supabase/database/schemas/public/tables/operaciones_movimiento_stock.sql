CREATE TABLE public.operaciones_movimiento_stock (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id          uuid                     NOT NULL,
  operacion_id       uuid                     NOT NULL,
  operacion_linea_id uuid                     NOT NULL,
  stock_id           uuid                     NOT NULL,
  cantidad           integer                  NOT NULL,
  fecha              timestamp with time zone NOT NULL,
  motivo             text,
  idempotency_key    uuid,
  created_by         uuid,
  created_at         timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_oms_tenant_fecha ON public.operaciones_movimiento_stock (tenant_id, fecha DESC);

CREATE UNIQUE INDEX uq_oms_tenant_idempotency ON public.operaciones_movimiento_stock (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_oms_operacion_id ON public.operaciones_movimiento_stock (operacion_id);

CREATE INDEX idx_oms_linea_id ON public.operaciones_movimiento_stock (operacion_linea_id);

CREATE INDEX idx_oms_stock_id ON public.operaciones_movimiento_stock (stock_id);

CREATE TRIGGER trg_oms_after_delete
  AFTER DELETE ON public.operaciones_movimiento_stock
  FOR EACH ROW
  EXECUTE FUNCTION public._oms_after_delete();

CREATE TRIGGER trg_oms_after_insert
  AFTER INSERT ON public.operaciones_movimiento_stock
  FOR EACH ROW
  EXECUTE FUNCTION public._oms_after_insert();

CREATE TRIGGER trg_oms_bloquear_update
  BEFORE UPDATE ON public.operaciones_movimiento_stock
  FOR EACH ROW
  EXECUTE FUNCTION public._oms_bloquear_update();

CREATE TRIGGER trg_oms_validar
  BEFORE INSERT ON public.operaciones_movimiento_stock
  FOR EACH ROW
  EXECUTE FUNCTION public._oms_validar();

CREATE POLICY tenant_access ON public.operaciones_movimiento_stock
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.operaciones_movimiento_stock
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_movimiento_stock
  ADD CONSTRAINT operaciones_movimiento_stock_cantidad_check CHECK (cantidad <> 0);

ALTER TABLE public.operaciones_movimiento_stock
  ADD CONSTRAINT operaciones_movimiento_stock_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.operaciones_movimiento_stock
  ADD CONSTRAINT operaciones_movimiento_stock_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_movimiento_stock
  ADD CONSTRAINT operaciones_movimiento_stock_operacion_linea_id_fkey FOREIGN KEY (operacion_linea_id) REFERENCES public.operaciones_lineas(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_movimiento_stock
  ADD CONSTRAINT operaciones_movimiento_stock_pkey PRIMARY KEY (id);

ALTER TABLE public.operaciones_movimiento_stock
  ADD CONSTRAINT operaciones_movimiento_stock_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.stocks(id) ON DELETE RESTRICT;

ALTER TABLE public.operaciones_movimiento_stock
  ADD CONSTRAINT operaciones_movimiento_stock_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_movimiento_stock TO authenticated;

GRANT ALL ON public.operaciones_movimiento_stock TO service_role;