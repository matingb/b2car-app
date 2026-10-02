CREATE TABLE "public"."facturas_electronicas_lineas" (
  "id"               uuid          NOT NULL DEFAULT gen_random_uuid(),
  "factura_id"       uuid          NOT NULL,
  "ordinal"          smallint      NOT NULL,
  "origen"           text          NOT NULL,
  "source_id"        uuid,
  "descripcion"      text          NOT NULL,
  "codigo"           text,
  "cantidad"         numeric(14,4) NOT NULL,
  "importe_unitario" numeric(14,2) NOT NULL,
  "subtotal"         numeric(14,2) NOT NULL,
  "snapshot"         jsonb         NOT NULL DEFAULT '{}'::jsonb,
  "tratamiento_iva"  text          NOT NULL DEFAULT 'GRAVADO'::text,
  "iva_alicuota_id"  smallint,
  "iva_alicuota"     numeric(5,2)  NOT NULL DEFAULT 0,
  "importe_neto"     numeric(14,2) NOT NULL DEFAULT 0,
  "importe_iva"      numeric(14,2) NOT NULL DEFAULT 0,
  "importe_total"    numeric(14,2) NOT NULL DEFAULT 0,
  CONSTRAINT "facturas_electronicas_lineas_alicuota_check" CHECK (((iva_alicuota_id IS NULL) OR (iva_alicuota_id = ANY (ARRAY[3, 4, 5, 6, 8, 9])))),
  CONSTRAINT "facturas_electronicas_lineas_cantidad_check" CHECK ((cantidad > (0)::numeric)),
  CONSTRAINT "facturas_electronicas_lineas_factura_id_fkey" FOREIGN KEY (factura_id) REFERENCES public.facturas_electronicas(id) ON DELETE CASCADE,
  CONSTRAINT "facturas_electronicas_lineas_importe_unitario_check" CHECK ((importe_unitario >= (0)::numeric)),
  CONSTRAINT "facturas_electronicas_lineas_importes_check" CHECK (((importe_neto >= (0)::numeric) AND (importe_iva >= (0)::numeric) AND (importe_total >= (0)::numeric))),
  CONSTRAINT "facturas_electronicas_lineas_ordinal_check" CHECK ((ordinal > 0)),
  CONSTRAINT "facturas_electronicas_lineas_ordinal_unico" UNIQUE (factura_id, ordinal),
  CONSTRAINT "facturas_electronicas_lineas_origen_check" CHECK ((origen = ANY (ARRAY['SERVICIO'::text, 'FORMULARIO'::text, 'REPUESTO'::text, 'VENTA'::text, 'AJUSTE'::text]))),
  CONSTRAINT "facturas_electronicas_lineas_pkey" PRIMARY KEY (id),
  CONSTRAINT "facturas_electronicas_lineas_subtotal_check" CHECK ((subtotal >= (0)::numeric)),
  CONSTRAINT "facturas_electronicas_lineas_tratamiento_check" CHECK ((tratamiento_iva = ANY (ARRAY['GRAVADO'::text, 'EXENTO'::text, 'NO_GRAVADO'::text])))
);

ALTER TABLE "public"."facturas_electronicas_lineas"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER facturacion_snapshot_lineas_inmutables
  BEFORE INSERT OR DELETE OR UPDATE ON public.facturas_electronicas_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_snapshot_autorizado();

CREATE POLICY "facturas_electronicas_lineas_delete_tenant" ON "public"."facturas_electronicas_lineas"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturas_electronicas_lineas.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

CREATE POLICY "facturas_electronicas_lineas_insert_tenant" ON "public"."facturas_electronicas_lineas"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturas_electronicas_lineas.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

CREATE POLICY "facturas_electronicas_lineas_lectura_tenant" ON "public"."facturas_electronicas_lineas"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturas_electronicas_lineas.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

CREATE POLICY "facturas_electronicas_lineas_update_tenant" ON "public"."facturas_electronicas_lineas"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturas_electronicas_lineas.factura_id) AND (f.tenant_id = public.current_tenant_id())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturas_electronicas_lineas.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturas_electronicas_lineas" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturas_electronicas_lineas" TO "service_role";

REVOKE ALL ON TABLE "public"."facturas_electronicas_lineas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturas_electronicas_lineas" TO "postgres";
