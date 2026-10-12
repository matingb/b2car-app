CREATE TABLE public.facturacion_factura_stock_origenes (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  factura_id uuid NOT NULL REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
  operacion_linea_id uuid NOT NULL REFERENCES public.operaciones_lineas(id) ON DELETE RESTRICT,
  operacion_origen_id uuid NOT NULL REFERENCES public.operaciones(id) ON DELETE RESTRICT,
  stock_id uuid NOT NULL REFERENCES public.stocks(id) ON DELETE RESTRICT,
  taller_id uuid NOT NULL REFERENCES public.talleres(id) ON DELETE RESTRICT,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  origen_linea text NOT NULL CHECK (origen_linea IN ('VENTA','REPUESTO')),
  cantidad_original integer NOT NULL CHECK (cantidad_original > 0),
  nombre_snapshot text NOT NULL,
  codigo_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturacion_factura_stock_origenes_pkey PRIMARY KEY (factura_id, operacion_linea_id)
);

ALTER TABLE public.facturacion_factura_stock_origenes ENABLE ROW LEVEL SECURITY;

CREATE INDEX facturacion_stock_origenes_linea_idx ON public.facturacion_factura_stock_origenes (operacion_linea_id);
CREATE INDEX facturacion_stock_origenes_stock_idx ON public.facturacion_factura_stock_origenes (stock_id);
CREATE INDEX facturacion_stock_origenes_tenant_factura_idx ON public.facturacion_factura_stock_origenes (tenant_id, factura_id);

CREATE POLICY facturacion_stock_origenes_read_tenant ON public.facturacion_factura_stock_origenes
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

REVOKE ALL ON TABLE public.facturacion_factura_stock_origenes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.facturacion_factura_stock_origenes TO authenticated;
GRANT SELECT ON TABLE public.facturacion_factura_stock_origenes TO service_role;
REVOKE ALL ON TABLE public.facturacion_factura_stock_origenes FROM postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.facturacion_factura_stock_origenes TO postgres;

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_stock_origenes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = OLD.factura_id AND f.estado = 'AUTORIZADA'
    ) THEN RAISE EXCEPTION 'El snapshot de origen autorizado es inmutable'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Los snapshots de origen no se modifican'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.facturas_electronicas f
    WHERE f.id = NEW.factura_id AND (f.documento_tipo <> 'FACTURA' OR f.estado = 'AUTORIZADA')
  ) THEN RAISE EXCEPTION 'No se puede insertar snapshot para este documento'; END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.facturacion_bloquear_mutacion_stock_origenes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.facturacion_bloquear_mutacion_stock_origenes() TO postgres, service_role;

CREATE TRIGGER facturacion_stock_origenes_inmutables
  BEFORE INSERT OR UPDATE OR DELETE ON public.facturacion_factura_stock_origenes
  FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_stock_origenes();
