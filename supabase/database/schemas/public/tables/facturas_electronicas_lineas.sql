CREATE TABLE public.facturas_electronicas_lineas (
  id               uuid          DEFAULT gen_random_uuid() NOT NULL,
  factura_id       uuid          NOT NULL,
  ordinal          smallint      NOT NULL,
  origen           text          NOT NULL,
  source_id        uuid,
  descripcion      text          NOT NULL,
  codigo           text,
  cantidad         numeric(14,4) NOT NULL,
  importe_unitario numeric(14,2) NOT NULL,
  subtotal         numeric(14,2) NOT NULL,
  snapshot         jsonb         DEFAULT '{}'::jsonb NOT NULL,
  tratamiento_iva  text          DEFAULT 'GRAVADO'::text NOT NULL,
  iva_alicuota_id  smallint,
  iva_alicuota     numeric(5,2)  DEFAULT 0 NOT NULL,
  importe_neto     numeric(14,2) DEFAULT 0 NOT NULL,
  importe_iva      numeric(14,2) DEFAULT 0 NOT NULL,
  importe_total    numeric(14,2) DEFAULT 0 NOT NULL
);

CREATE TRIGGER facturacion_snapshot_lineas_inmutables
  BEFORE INSERT OR DELETE OR UPDATE ON public.facturas_electronicas_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_snapshot_autorizado();

CREATE POLICY facturas_electronicas_lineas_delete_tenant ON public.facturas_electronicas_lineas
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturas_electronicas_lineas.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

CREATE POLICY facturas_electronicas_lineas_insert_tenant ON public.facturas_electronicas_lineas
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturas_electronicas_lineas.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

CREATE POLICY facturas_electronicas_lineas_lectura_tenant ON public.facturas_electronicas_lineas
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturas_electronicas_lineas.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

CREATE POLICY facturas_electronicas_lineas_update_tenant ON public.facturas_electronicas_lineas
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturas_electronicas_lineas.factura_id) AND (f.tenant_id = public.current_tenant_id())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturas_electronicas_lineas.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

ALTER TABLE public.facturas_electronicas_lineas
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_alicuota_check CHECK (iva_alicuota_id IS NULL OR (iva_alicuota_id = ANY (ARRAY[3, 4, 5, 6, 8, 9])));

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_cantidad_check CHECK (cantidad > 0::numeric);

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas_electronicas(id) ON DELETE CASCADE;

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_importe_unitario_check CHECK (importe_unitario >= 0::numeric);

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_importes_check CHECK (importe_neto >= 0::numeric AND importe_iva >= 0::numeric AND importe_total >= 0::numeric);

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_ordinal_check CHECK (ordinal > 0);

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_ordinal_unico UNIQUE (factura_id, ordinal);

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_origen_check CHECK (origen = ANY (ARRAY['SERVICIO'::text, 'FORMULARIO'::text, 'REPUESTO'::text, 'VENTA'::text, 'AJUSTE'::text]));

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_pkey PRIMARY KEY (id);

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_subtotal_check CHECK (subtotal >= 0::numeric);

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_tratamiento_check CHECK (tratamiento_iva = ANY (ARRAY['GRAVADO'::text, 'EXENTO'::text, 'NO_GRAVADO'::text]));

GRANT DELETE, INSERT, SELECT, UPDATE ON public.facturas_electronicas_lineas TO authenticated;

GRANT ALL ON public.facturas_electronicas_lineas TO service_role;