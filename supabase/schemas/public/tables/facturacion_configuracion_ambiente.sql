CREATE TABLE "public"."facturacion_configuracion_ambiente" (
  "tenant_id"               uuid                     NOT NULL,
  "ambiente"                text                     NOT NULL,
  "razon_social"            text                     NOT NULL,
  "nombre_fantasia"         text,
  "cuit"                    text                     NOT NULL,
  "condicion_iva_emisor"    text                     NOT NULL DEFAULT 'MONOTRIBUTISTA'::text,
  "domicilio"               text                     NOT NULL,
  "ingresos_brutos"         text,
  "inicio_actividades"      date                     NOT NULL,
  "punto_venta"             integer                  NOT NULL,
  "habilitada"              boolean                  NOT NULL DEFAULT false,
  "cert_storage_path"       text,
  "key_storage_path"        text,
  "cert_original_filename"  text,
  "key_original_filename"   text,
  "cert_fingerprint_sha256" text,
  "cert_expires_at"         timestamp with time zone,
  "credenciales_updated_at" timestamp with time zone,
  "credenciales_updated_by" uuid,
  "fce_monto_minimo"        numeric(14,2),
  "fce_cbu"                 text,
  "fce_sistema"             text,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "facturacion_config_ambiente_credenciales_completas"
    CHECK
    ((((cert_storage_path IS NULL) AND (key_storage_path IS NULL) AND (cert_original_filename IS NULL) AND (key_original_filename IS NULL) AND (cert_fingerprint_sha256 IS NULL) AND
    (cert_expires_at IS NULL)) OR ((NULLIF(btrim(cert_storage_path), ''::text) IS NOT NULL) AND (NULLIF(btrim(key_storage_path), ''::text) IS
    NOT NULL) AND (NULLIF(btrim(cert_original_filename), ''::text) IS NOT NULL) AND (NULLIF(btrim(key_original_filename), ''::text) IS
    NOT NULL) AND (cert_fingerprint_sha256 ~ '^[A-F0-9:]{95}$'::text) AND (cert_expires_at IS NOT NULL)))),
  CONSTRAINT "facturacion_configuracion_ambiente_ambiente_check" CHECK ((ambiente = ANY (ARRAY['HOMOLOGACION'::text, 'PRODUCCION'::text]))),
  CONSTRAINT "facturacion_configuracion_ambiente_condicion_iva_emisor_check" CHECK ((condicion_iva_emisor = ANY (ARRAY['MONOTRIBUTISTA'::text, 'RESPONSABLE_INSCRIPTO'::text]))),
  CONSTRAINT "facturacion_configuracion_ambiente_cuit_check" CHECK ((cuit ~ '^[0-9]{11}$'::text)),
  CONSTRAINT "facturacion_configuracion_ambiente_fce_sistema_check" CHECK ((fce_sistema = ANY (ARRAY['SCA'::text, 'ADC'::text]))),
  CONSTRAINT "facturacion_configuracion_ambiente_fce_cbu_check" CHECK ((fce_cbu IS NULL OR fce_cbu ~ '^[0-9]{22}$'::text)),
  CONSTRAINT "facturacion_configuracion_ambiente_fce_monto_minimo_check" CHECK (((fce_monto_minimo IS NULL) OR (fce_monto_minimo > (0)::numeric))),
  CONSTRAINT "facturacion_configuracion_ambiente_pkey" PRIMARY KEY (tenant_id, ambiente),
  CONSTRAINT "facturacion_configuracion_ambiente_punto_venta_check" CHECK ((punto_venta > 0)),
  CONSTRAINT "facturacion_configuracion_ambiente_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

ALTER TABLE "public"."facturacion_configuracion_ambiente"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER facturacion_config_ambiente_set_updated_at
  BEFORE UPDATE ON public.facturacion_configuracion_ambiente
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_set_updated_at();

CREATE POLICY "facturacion_config_ambiente_delete_admin" ON "public"."facturacion_configuracion_ambiente"
  FOR DELETE
  TO "authenticated"
  USING (((tenant_id = public.current_tenant_id()) AND ((auth.jwt() ->> 'user_role'::text) = 'admin'::text)));

CREATE POLICY "facturacion_config_ambiente_insert_admin" ON "public"."facturacion_configuracion_ambiente"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND ((auth.jwt() ->> 'user_role'::text) = 'admin'::text)));

CREATE POLICY "facturacion_config_ambiente_select_tenant" ON "public"."facturacion_configuracion_ambiente"
  FOR SELECT
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()));

CREATE POLICY "facturacion_config_ambiente_update_admin" ON "public"."facturacion_configuracion_ambiente"
  FOR UPDATE
  TO "authenticated"
  USING (((tenant_id = public.current_tenant_id()) AND ((auth.jwt() ->> 'user_role'::text) = 'admin'::text)))
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND ((auth.jwt() ->> 'user_role'::text) = 'admin'::text)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_configuracion_ambiente" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_configuracion_ambiente" TO "service_role";

REVOKE ALL ON TABLE "public"."facturacion_configuracion_ambiente" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_configuracion_ambiente" TO "postgres";
