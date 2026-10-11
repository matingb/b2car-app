CREATE TABLE public.facturacion_nc_devoluciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  nota_credito_id uuid NOT NULL REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
  factura_original_id uuid NOT NULL REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
  operacion_linea_id uuid NOT NULL REFERENCES public.operaciones_lineas(id) ON DELETE RESTRICT,
  stock_id uuid NOT NULL REFERENCES public.stocks(id) ON DELETE RESTRICT,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  operacion_ajuste_id uuid REFERENCES public.operaciones(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturacion_nc_devoluciones_nota_linea_unique UNIQUE (nota_credito_id, operacion_linea_id)
);

ALTER TABLE public.facturacion_nc_devoluciones ENABLE ROW LEVEL SECURITY;
CREATE INDEX facturacion_nc_devoluciones_original_idx ON public.facturacion_nc_devoluciones (factura_original_id);
CREATE INDEX facturacion_nc_devoluciones_linea_idx ON public.facturacion_nc_devoluciones (operacion_linea_id);
CREATE INDEX facturacion_nc_devoluciones_stock_idx ON public.facturacion_nc_devoluciones (stock_id);
CREATE POLICY facturacion_nc_devoluciones_read_tenant ON public.facturacion_nc_devoluciones
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
GRANT SELECT ON public.facturacion_nc_devoluciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facturacion_nc_devoluciones TO service_role;
