CREATE TABLE "public"."facturas_electronicas" (
  "id"                         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"                  uuid                     NOT NULL,
  "arreglo_id"                 uuid,
  "idempotency_key"            uuid                     NOT NULL,
  "estado"                     text                     NOT NULL DEFAULT 'BORRADOR'::text,
  "ambiente"                   text                     NOT NULL DEFAULT 'HOMOLOGACION'::text,
  "emisor_snapshot"            jsonb                    NOT NULL,
  "receptor_snapshot"          jsonb                    NOT NULL,
  "concepto"                   smallint                 NOT NULL,
  "fecha_comprobante"          date                     NOT NULL,
  "fecha_servicio_desde"       date,
  "fecha_servicio_hasta"       date,
  "fecha_vencimiento_pago"     date,
  "moneda"                     text                     NOT NULL DEFAULT 'PES'::text,
  "total"                      numeric(14,2)            NOT NULL,
  "punto_venta"                integer                  NOT NULL,
  "tipo_comprobante"           smallint                 NOT NULL DEFAULT 11,
  "numero_comprobante"         integer,
  "cae"                        text,
  "cae_vencimiento"            date,
  "error_codigo"               text,
  "error_mensaje"              text,
  "created_by"                 uuid,
  "created_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "origen_tipo"                text                     NOT NULL DEFAULT 'ARREGLO'::text,
  "operacion_id"               uuid,
  "documento_tipo"             text                     NOT NULL DEFAULT 'FACTURA'::text,
  "documento_asociado_id"      uuid,
  "clase_comprobante"          text                     NOT NULL DEFAULT 'C'::text,
  "condicion_venta"            text                     NOT NULL DEFAULT 'CONTADO'::text,
  "importe_neto_gravado"       numeric(14,2)            NOT NULL DEFAULT 0,
  "importe_no_gravado"         numeric(14,2)            NOT NULL DEFAULT 0,
  "importe_exento"             numeric(14,2)            NOT NULL DEFAULT 0,
  "importe_iva"                numeric(14,2)            NOT NULL DEFAULT 0,
  "importe_tributos"           numeric(14,2)            NOT NULL DEFAULT 0,
  "otros_impuestos_nacionales" numeric(14,2)            NOT NULL DEFAULT 0,
  "contenido_hash"             text,
  "autorizada_at"              timestamp with time zone,
  "origen_externo"             boolean                  NOT NULL DEFAULT false,
  "pdf_storage_path"           text,
  "pdf_sha256"                 text,
  "pdf_template_version"       text,
  "fce_sistema"                text,
  "fce_cbu"                     text,
  "fce_estado_manual"          text,
  "fce_estado_manual_actualizado_at" timestamp with time zone,
  "fce_estado_manual_actualizado_by" uuid,
  CONSTRAINT "facturas_electronicas_ambiente_check" CHECK ((ambiente = ANY (ARRAY['HOMOLOGACION'::text, 'PRODUCCION'::text]))),
  CONSTRAINT "facturas_electronicas_arreglo_id_fkey" FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE RESTRICT,
  CONSTRAINT "facturas_electronicas_asociacion_check"
    CHECK
    ((((documento_tipo = 'FACTURA'::text) AND (documento_asociado_id IS NULL)) OR ((documento_tipo = ANY (ARRAY['NOTA_CREDITO'::text, 'NOTA_DEBITO'::text])) AND
    (documento_asociado_id IS NOT NULL)))),
  CONSTRAINT "facturas_electronicas_clase_check" CHECK ((clase_comprobante = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'M'::text]))),
  CONSTRAINT "facturas_electronicas_concepto_check" CHECK ((concepto = ANY (ARRAY[1, 2, 3]))),
  CONSTRAINT "facturas_electronicas_documento_tipo_check" CHECK ((documento_tipo = ANY (ARRAY['FACTURA'::text, 'NOTA_CREDITO'::text, 'NOTA_DEBITO'::text]))),
  CONSTRAINT "facturas_electronicas_estado_check"
    CHECK ((estado = ANY (ARRAY['BORRADOR'::text, 'LISTA'::text, 'ENVIANDO'::text, 'AUTORIZADA'::text, 'RECHAZADA'::text, 'INCIERTA'::text]))),
  CONSTRAINT "facturas_electronicas_idempotencia_unica" UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT "facturas_electronicas_moneda_check" CHECK ((moneda = 'PES'::text)),
  CONSTRAINT "facturas_electronicas_origen_check" CHECK ((((origen_tipo = 'ARREGLO'::text) AND (arreglo_id IS
    NOT NULL) AND (operacion_id IS NULL)) OR ((origen_tipo = 'VENTA'::text) AND (operacion_id IS NOT NULL) AND (arreglo_id IS NULL)))),
  CONSTRAINT "facturas_electronicas_origen_tipo_check" CHECK ((origen_tipo = ANY (ARRAY['ARREGLO'::text, 'VENTA'::text]))),
  CONSTRAINT "facturas_electronicas_pkey" PRIMARY KEY (id),
  CONSTRAINT "facturas_electronicas_documento_asociado_id_fkey" FOREIGN KEY (documento_asociado_id) REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
  CONSTRAINT "facturas_electronicas_punto_venta_check" CHECK ((punto_venta > 0)),
  CONSTRAINT "facturas_electronicas_tipo_comprobante_check" CHECK ((tipo_comprobante = ANY (ARRAY[1, 2, 3, 6, 7, 8, 11, 12, 13, 51, 52, 53, 201, 206, 211]))),
  CONSTRAINT "facturas_electronicas_fce_data_check" CHECK (((tipo_comprobante IN (201,206,211) AND fce_sistema IN ('SCA','ADC') AND fce_cbu ~ '^[0-9]{22}$' AND (fce_estado_manual IS NULL OR fce_estado_manual IN ('PENDIENTE','ACEPTADA','RECHAZADA','CANCELADA','PAGADA','ANULADA'))) OR (tipo_comprobante NOT IN (201,206,211) AND fce_sistema IS NULL AND fce_cbu IS NULL AND fce_estado_manual IS NULL))),
  CONSTRAINT "facturas_electronicas_fce_estado_check" CHECK ((fce_estado_manual IS NULL OR fce_estado_manual IN ('PENDIENTE','ACEPTADA','RECHAZADA','CANCELADA','PAGADA','ANULADA'))),
  CONSTRAINT "facturas_electronicas_total_check" CHECK ((total > (0)::numeric)),
  CONSTRAINT "facturas_electronicas_totales_no_negativos"
    CHECK
    (((importe_neto_gravado >= (0)::numeric) AND (importe_no_gravado >= (0)::numeric) AND (importe_exento >= (0)::numeric) AND (importe_iva >= (0)::numeric) AND (importe_tributos
    >= (0)::numeric) AND (otros_impuestos_nacionales >= (0)::numeric))),
  CONSTRAINT "facturas_electronicas_operacion_id_fkey" FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE RESTRICT,
  CONSTRAINT "facturas_electronicas_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."facturas_electronicas"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX facturas_electronicas_arreglo_idx ON public.facturas_electronicas USING btree (tenant_id, arreglo_id, created_at DESC)
  WHERE (arreglo_id IS NOT NULL);

CREATE INDEX facturas_electronicas_asociado_idx ON public.facturas_electronicas USING btree (documento_asociado_id)
  WHERE (documento_asociado_id IS NOT NULL);

CREATE UNIQUE INDEX facturas_electronicas_factura_arreglo_ambiente_unica ON public.facturas_electronicas USING btree (tenant_id, ambiente, arreglo_id)
  WHERE ((documento_tipo = 'FACTURA'::text) AND (arreglo_id IS NOT NULL));

CREATE UNIQUE INDEX facturas_electronicas_factura_venta_ambiente_unica ON public.facturas_electronicas USING btree (tenant_id, ambiente, operacion_id)
  WHERE ((documento_tipo = 'FACTURA'::text) AND (operacion_id IS NOT NULL));

CREATE UNIQUE INDEX facturas_electronicas_numero_emisor_unico ON public.facturas_electronicas
  USING btree (ambiente, ((emisor_snapshot ->> 'cuit'::text)), punto_venta, tipo_comprobante, numero_comprobante)
  WHERE (numero_comprobante IS NOT NULL);

CREATE INDEX facturas_electronicas_operacion_idx ON public.facturas_electronicas USING btree (tenant_id, operacion_id, created_at DESC)
  WHERE (operacion_id IS NOT NULL);

CREATE INDEX facturas_electronicas_tenant_estado_idx ON public.facturas_electronicas USING btree (tenant_id, estado, created_at DESC);

CREATE INDEX facturas_electronicas_tenant_fecha_idx ON public.facturas_electronicas USING btree (tenant_id, fecha_comprobante DESC, created_at DESC);

CREATE TRIGGER facturacion_snapshot_factura_inmutable
  BEFORE DELETE OR UPDATE ON public.facturas_electronicas
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_snapshot_autorizado();

CREATE TRIGGER facturas_electronicas_set_updated_at
  BEFORE UPDATE ON public.facturas_electronicas
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_set_updated_at();

CREATE POLICY "facturas_electronicas_insert_tenant" ON "public"."facturas_electronicas"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((tenant_id = public.current_tenant_id()));

CREATE POLICY "facturas_electronicas_lectura_tenant" ON "public"."facturas_electronicas"
  FOR SELECT
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()));

CREATE POLICY "facturas_electronicas_update_tenant" ON "public"."facturas_electronicas"
  FOR UPDATE
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturas_electronicas" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturas_electronicas" TO "service_role";

REVOKE ALL ON TABLE "public"."facturas_electronicas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturas_electronicas" TO "postgres";
