CREATE TABLE "public"."remitos" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"              uuid                     NOT NULL,
  "ambiente"               text                     NOT NULL,
  "clase"                  text                     NOT NULL,
  "tipo_comprobante"       smallint,
  "punto_emision"          integer                  NOT NULL,
  "numero"                 integer                  NOT NULL,
  "fecha_emision"          date                     NOT NULL,
  "idempotency_key"        uuid                     NOT NULL,
  "arreglo_id"             uuid,
  "factura_id"             uuid,
  "factura_asociada_at"    timestamp with time zone,
  "factura_asociada_by"    uuid,
  "emisor_snapshot"        jsonb                    NOT NULL,
  "destinatario_snapshot"  jsonb                    NOT NULL,
  "transportista_snapshot" jsonb,
  "cai"                    text,
  "cai_vencimiento"        date,
  "impresion_snapshot"     jsonb,
  "observaciones"          text,
  "created_by"             uuid,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "remitos_ambiente_check" CHECK ((ambiente = ANY (ARRAY['HOMOLOGACION'::text, 'PRODUCCION'::text]))),
  CONSTRAINT "remitos_cai_check"
    CHECK
    ((((clase = 'R'::text) AND (cai IS NOT NULL) AND (cai ~ '^[0-9]{14}$'::text) AND (cai_vencimiento IS NOT NULL) AND (cai_vencimiento >= fecha_emision) AND
    (impresion_snapshot IS NOT NULL)) OR ((clase = 'X'::text) AND (cai IS NULL) AND (cai_vencimiento IS NULL) AND (impresion_snapshot IS NULL)))),
  CONSTRAINT "remitos_clase_check" CHECK ((clase = ANY (ARRAY['R'::text, 'X'::text]))),
  CONSTRAINT "remitos_factura_asociada_check" CHECK (((factura_id IS NULL) = (factura_asociada_at IS NULL))),
  CONSTRAINT "remitos_arreglo_id_fkey" FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE RESTRICT,
  CONSTRAINT "remitos_factura_id_fkey" FOREIGN KEY (factura_id) REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
  CONSTRAINT "remitos_idempotencia_unica" UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT "remitos_numero_check" CHECK (((numero >= 1) AND (numero <= 99999999))),
  CONSTRAINT "remitos_numero_unico" UNIQUE (tenant_id, ambiente, clase, punto_emision, numero),
  CONSTRAINT "remitos_observaciones_check" CHECK ((char_length(observaciones) <= 1000)),
  CONSTRAINT "remitos_pkey" PRIMARY KEY (id),
  CONSTRAINT "remitos_punto_emision_check" CHECK (((punto_emision >= 1) AND (punto_emision <= 99999))),
  CONSTRAINT "remitos_snapshots_check"
    CHECK
    (((jsonb_typeof(emisor_snapshot) = 'object'::text) AND (jsonb_typeof(destinatario_snapshot) = 'object'::text) AND ((transportista_snapshot IS NULL) OR
    (jsonb_typeof(transportista_snapshot) = 'object'::text)) AND ((impresion_snapshot IS NULL) OR (jsonb_typeof(impresion_snapshot) = 'object'::text)))),
  CONSTRAINT "remitos_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT "remitos_tipo_comprobante_check"
    CHECK ((((clase = 'R'::text) AND (tipo_comprobante IS NOT NULL) AND (tipo_comprobante = 91)) OR ((clase = 'X'::text) AND (tipo_comprobante IS NULL))))
);

ALTER TABLE "public"."remitos"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX remitos_factura_idx ON public.remitos USING btree (tenant_id, factura_id)
  WHERE (factura_id IS NOT NULL);

CREATE INDEX remitos_arreglo_idx ON public.remitos USING btree (tenant_id, arreglo_id)
  WHERE (arreglo_id IS NOT NULL);

CREATE INDEX remitos_tenant_fecha_idx ON public.remitos USING btree (tenant_id, ambiente, fecha_emision DESC, created_at DESC);

CREATE TRIGGER remitos_inmutable
  BEFORE DELETE OR UPDATE ON public.remitos
  FOR EACH ROW
  EXECUTE FUNCTION public.remitos_bloquear_mutacion();

CREATE POLICY "remitos_select_tenant" ON "public"."remitos"
  FOR SELECT
  TO "authenticated"
  USING (((tenant_id = public.current_tenant_id()) AND ( SELECT public._b2c179_tiene_permiso('facturas:view'::text) AS _b2c179_tiene_permiso)));

GRANT SELECT ON TABLE "public"."remitos" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."remitos" TO "service_role";

REVOKE ALL ON TABLE "public"."remitos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."remitos" TO "postgres";
