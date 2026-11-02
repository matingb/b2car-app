CREATE TABLE public.facturacion_nc_devoluciones (
  id                  uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id           uuid                     NOT NULL,
  nota_credito_id     uuid                     NOT NULL,
  factura_original_id uuid                     NOT NULL,
  operacion_linea_id  uuid                     NOT NULL,
  stock_id            uuid                     NOT NULL,
  cantidad            integer                  NOT NULL,
  operacion_ajuste_id uuid,
  created_at          timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX facturacion_nc_devoluciones_original_idx ON public.facturacion_nc_devoluciones (factura_original_id);

CREATE INDEX facturacion_nc_devoluciones_stock_idx ON public.facturacion_nc_devoluciones (stock_id);

CREATE INDEX facturacion_nc_devoluciones_linea_idx ON public.facturacion_nc_devoluciones (operacion_linea_id);

CREATE POLICY facturacion_nc_devoluciones_read_tenant ON public.facturacion_nc_devoluciones
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.facturacion_nc_devoluciones
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturacion_nc_devoluciones
  ADD CONSTRAINT facturacion_nc_devoluciones_cantidad_check CHECK (cantidad > 0);

ALTER TABLE public.facturacion_nc_devoluciones
  ADD CONSTRAINT facturacion_nc_devoluciones_nota_linea_unique UNIQUE (nota_credito_id, operacion_linea_id);

ALTER TABLE public.facturacion_nc_devoluciones
  ADD CONSTRAINT facturacion_nc_devoluciones_pkey PRIMARY KEY (id);

ALTER TABLE public.facturacion_nc_devoluciones
  ADD CONSTRAINT facturacion_nc_devoluciones_factura_original_id_fkey FOREIGN KEY (factura_original_id) REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_nc_devoluciones
  ADD CONSTRAINT facturacion_nc_devoluciones_nota_credito_id_fkey FOREIGN KEY (nota_credito_id) REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_nc_devoluciones
  ADD CONSTRAINT facturacion_nc_devoluciones_operacion_ajuste_id_fkey FOREIGN KEY (operacion_ajuste_id) REFERENCES public.operaciones(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_nc_devoluciones
  ADD CONSTRAINT facturacion_nc_devoluciones_operacion_linea_id_fkey FOREIGN KEY (operacion_linea_id) REFERENCES public.operaciones_lineas(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_nc_devoluciones
  ADD CONSTRAINT facturacion_nc_devoluciones_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.stocks(id) ON DELETE RESTRICT;

ALTER TABLE public.facturacion_nc_devoluciones
  ADD CONSTRAINT facturacion_nc_devoluciones_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT ALL ON public.facturacion_nc_devoluciones TO anon;

GRANT ALL ON public.facturacion_nc_devoluciones TO authenticated;

GRANT ALL ON public.facturacion_nc_devoluciones TO service_role;