CREATE TABLE public.movimientos_stock (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id          uuid                     NOT NULL,
  taller_id          uuid                     NOT NULL,
  producto_id        uuid                     NOT NULL,
  stock_id           uuid                     NOT NULL,
  operacion_id       uuid,
  detalle_arreglo_id uuid,
  tipo_movimiento    text                     NOT NULL,
  cantidad           integer                  NOT NULL,
  saldo_anterior     integer                  NOT NULL,
  saldo_posterior    integer                  NOT NULL,
  fecha              timestamp with time zone DEFAULT now() NOT NULL,
  motivo             text,
  created_by         uuid,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  reversion_de_id    uuid,
  oms_id             uuid
);

CREATE INDEX idx_mov_stock_tenant_fecha ON public.movimientos_stock (tenant_id, fecha DESC);

CREATE INDEX idx_mov_stock_oms_id ON public.movimientos_stock (oms_id)
  WHERE oms_id IS NOT NULL;

CREATE INDEX idx_mov_stock_prod_taller ON public.movimientos_stock (producto_id, taller_id, fecha DESC, created_at DESC);

CREATE INDEX idx_mov_stock_reversion_de_id ON public.movimientos_stock (reversion_de_id)
  WHERE reversion_de_id IS NOT NULL;

CREATE INDEX idx_mov_stock_operacion ON public.movimientos_stock (operacion_id)
  WHERE operacion_id IS NOT NULL;

CREATE TRIGGER movimientos_stock_bloquear_mutacion
  BEFORE DELETE OR UPDATE ON public.movimientos_stock
  FOR EACH ROW
  EXECUTE FUNCTION public._stock_bloquear_mutacion_ledger();

CREATE TRIGGER trg_stock_aplicar_movimiento
  BEFORE INSERT ON public.movimientos_stock
  FOR EACH ROW
  EXECUTE FUNCTION public._stock_aplicar_movimiento();

CREATE POLICY tenant_access ON public.movimientos_stock
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.movimientos_stock
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_cantidad_nonzero CHECK (cantidad <> 0);

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_consistencia CHECK (saldo_posterior = (saldo_anterior + cantidad));

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_pkey PRIMARY KEY (id);

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_reversion_de_id_fkey FOREIGN KEY (reversion_de_id) REFERENCES public.movimientos_stock(id) ON DELETE SET NULL;

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_saldo_ant_nonneg CHECK (saldo_anterior >= 0);

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_saldo_post_nonneg CHECK (saldo_posterior >= 0);

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_tipo_check
    CHECK (tipo_movimiento = ANY (ARRAY['COMPRA'::text, 'VENTA'::text, 'ASIGNACION_ARREGLO'::text, 'AJUSTE'::text, 'REVERSION'::text, 'INICIAL'::text, 'DEVOLUCION_NC'::text]));

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE RESTRICT;

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.stocks(id) ON DELETE CASCADE;

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_taller_id_fkey FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE RESTRICT;

ALTER TABLE public.movimientos_stock
  ADD CONSTRAINT movimientos_stock_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON public.movimientos_stock TO anon;

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON public.movimientos_stock TO authenticated;

GRANT ALL ON public.movimientos_stock TO service_role;