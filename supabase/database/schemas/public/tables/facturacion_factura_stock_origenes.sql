CREATE TABLE public.facturacion_factura_stock_origenes (
  tenant_id           uuid                     NOT NULL,
  factura_id          uuid                     NOT NULL,
  operacion_linea_id  uuid                     NOT NULL,
  operacion_origen_id uuid                     NOT NULL,
  stock_id            uuid                     NOT NULL,
  taller_id           uuid                     NOT NULL,
  producto_id         uuid                     NOT NULL,
  origen_linea        text                     NOT NULL,
  cantidad_original   integer                  NOT NULL,
  nombre_snapshot     text                     NOT NULL,
  codigo_snapshot     text,
  created_at          timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX facturacion_stock_origenes_stock_idx ON public.facturacion_factura_stock_origenes (stock_id);

CREATE INDEX facturacion_stock_origenes_tenant_factura_idx ON public.facturacion_factura_stock_origenes (tenant_id, factura_id);

CREATE INDEX facturacion_stock_origenes_linea_idx ON public.facturacion_factura_stock_origenes (operacion_linea_id);

CREATE TRIGGER facturacion_stock_origenes_inmutables
  BEFORE INSERT OR DELETE OR UPDATE ON public.facturacion_factura_stock_origenes
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_stock_origenes();

CREATE POLICY facturacion_stock_origenes_read_tenant ON public.facturacion_factura_stock_origenes
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.facturacion_factura_stock_origenes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturacion_factura_stock_origenes
  ADD CONSTRAINT facturacion_factura_stock_origenes_cantidad_original_check CHECK (cantidad_original > 0);

ALTER TABLE public.facturacion_factura_stock_origenes
  ADD CONSTRAINT facturacion_factura_stock_origenes_origen_linea_check CHECK (origen_linea = ANY (ARRAY['VENTA'::text, 'REPUESTO'::text]));

ALTER TABLE public.facturacion_factura_stock_origenes
  ADD CONSTRAINT facturacion_factura_stock_origenes_pkey PRIMARY KEY (factura_id, operacion_linea_id);

ALTER TABLE public.facturacion_factura_stock_origenes
  ADD CONSTRAINT facturacion_factura_stock_origenes_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_factura_stock_origenes
  ADD CONSTRAINT facturacion_factura_stock_origenes_operacion_origen_id_fkey FOREIGN KEY (operacion_origen_id) REFERENCES public.operaciones(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_factura_stock_origenes
  ADD CONSTRAINT facturacion_factura_stock_origenes_operacion_linea_id_fkey FOREIGN KEY (operacion_linea_id) REFERENCES public.operaciones_lineas(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_factura_stock_origenes
  ADD CONSTRAINT facturacion_factura_stock_origenes_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_factura_stock_origenes
  ADD CONSTRAINT facturacion_factura_stock_origenes_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.stocks(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_factura_stock_origenes
  ADD CONSTRAINT facturacion_factura_stock_origenes_taller_id_fkey FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_factura_stock_origenes
  ADD CONSTRAINT facturacion_factura_stock_origenes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.facturacion_factura_stock_origenes TO authenticated;

GRANT ALL ON public.facturacion_factura_stock_origenes TO service_role;