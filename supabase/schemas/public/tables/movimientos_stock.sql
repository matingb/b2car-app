CREATE TABLE "public"."movimientos_stock" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           uuid                     NOT NULL,
  "taller_id"           uuid                     NOT NULL,
  "producto_id"         uuid                     NOT NULL,
  "stock_id"            uuid                     NOT NULL,
  "operacion_id"        uuid,
  "detalle_arreglo_id"  uuid,
  "tipo_movimiento"     text                     NOT NULL,
  "cantidad"            integer                  NOT NULL,
  "saldo_anterior"      integer                  NOT NULL,
  "saldo_posterior"     integer                  NOT NULL,
  "fecha"               timestamp with time zone NOT NULL DEFAULT now(),
  "motivo"              text,
  "created_by"          uuid,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY (id),
  CONSTRAINT "movimientos_stock_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT "movimientos_stock_taller_id_fkey" FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE RESTRICT,
  CONSTRAINT "movimientos_stock_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE RESTRICT,
  CONSTRAINT "movimientos_stock_stock_id_fkey" FOREIGN KEY (stock_id) REFERENCES public.stocks(id) ON DELETE CASCADE,
  CONSTRAINT "movimientos_stock_operacion_id_fkey" FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE SET NULL,
  CONSTRAINT "movimientos_stock_detalle_arreglo_id_fkey" FOREIGN KEY (detalle_arreglo_id) REFERENCES public.detalle_arreglo(id) ON DELETE SET NULL,
  CONSTRAINT "movimientos_stock_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "movimientos_stock_cantidad_nonzero" CHECK ((cantidad <> 0)),
  CONSTRAINT "movimientos_stock_saldo_ant_nonneg" CHECK ((saldo_anterior >= 0)),
  CONSTRAINT "movimientos_stock_saldo_post_nonneg" CHECK ((saldo_posterior >= 0)),
  CONSTRAINT "movimientos_stock_consistencia" CHECK ((saldo_posterior = (saldo_anterior + cantidad))),
  CONSTRAINT "movimientos_stock_tipo_check" CHECK ((tipo_movimiento = ANY (ARRAY['COMPRA'::text, 'VENTA'::text, 'ASIGNACION_ARREGLO'::text, 'AJUSTE'::text, 'REVERSION'::text, 'INICIAL'::text, 'DEVOLUCION_NC'::text])))
);

ALTER TABLE "public"."movimientos_stock" ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mov_stock_prod_taller ON public.movimientos_stock USING btree (producto_id, taller_id, fecha DESC, created_at DESC);
CREATE INDEX idx_mov_stock_operacion ON public.movimientos_stock USING btree (operacion_id) WHERE (operacion_id IS NOT NULL);
CREATE INDEX idx_mov_stock_tenant_fecha ON public.movimientos_stock USING btree (tenant_id, fecha DESC);

CREATE TRIGGER movimientos_stock_bloquear_mutacion
  BEFORE UPDATE OR DELETE ON public.movimientos_stock
  FOR EACH ROW
  EXECUTE FUNCTION public._stock_bloquear_mutacion_ledger();

CREATE POLICY "tenant_access" ON "public"."movimientos_stock"
  FOR ALL
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

GRANT SELECT, INSERT ON TABLE "public"."movimientos_stock" TO "anon", "authenticated";
GRANT ALL ON TABLE "public"."movimientos_stock" TO "service_role", "postgres";
