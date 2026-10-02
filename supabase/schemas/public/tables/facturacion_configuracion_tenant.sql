CREATE TABLE "public"."facturacion_configuracion_tenant" (
  "tenant_id"               uuid                     NOT NULL,
  "razon_social"            text                     NOT NULL,
  "nombre_fantasia"         text,
  "cuit"                    text                     NOT NULL,
  "domicilio"               text                     NOT NULL,
  "ingresos_brutos"         text,
  "inicio_actividades"      date                     NOT NULL,
  "punto_venta"             integer                  NOT NULL,
  "cert_subdirectory"       text,
  "cert_filename"           text,
  "key_filename"            text,
  "habilitada"              boolean                  NOT NULL DEFAULT true,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "cert_storage_path"       text,
  "key_storage_path"        text,
  "cert_original_filename"  text,
  "key_original_filename"   text,
  "cert_fingerprint_sha256" text,
  "cert_expires_at"         timestamp with time zone,
  "credenciales_updated_at" timestamp with time zone,
  "credenciales_updated_by" uuid,
  CONSTRAINT "facturacion_configuracion_credenciales_storage_completas"
    CHECK
    ((((cert_storage_path IS NULL) AND (key_storage_path IS NULL) AND (cert_original_filename IS NULL) AND (key_original_filename IS NULL) AND (cert_fingerprint_sha256 IS NULL) AND
    (cert_expires_at IS NULL)) OR ((NULLIF(btrim(cert_storage_path), ''::text) IS NOT NULL) AND (NULLIF(btrim(key_storage_path), ''::text) IS
    NOT NULL) AND (NULLIF(btrim(cert_original_filename), ''::text) IS NOT NULL) AND (NULLIF(btrim(key_original_filename), ''::text) IS
    NOT NULL) AND (cert_fingerprint_sha256 ~ '^[A-F0-9:]{95}$'::text) AND (cert_expires_at IS NOT NULL)))),
  CONSTRAINT "facturacion_configuracion_tenant_cert_filename_check" CHECK ((cert_filename ~ '^[A-Za-z0-9._-]+\.(crt|pem)$'::text)),
  CONSTRAINT "facturacion_configuracion_tenant_cert_subdirectory_check" CHECK ((cert_subdirectory ~ '^[A-Za-z0-9._-]+$'::text)),
  CONSTRAINT "facturacion_configuracion_tenant_cuit_check" CHECK ((cuit ~ '^[0-9]{11}$'::text)),
  CONSTRAINT "facturacion_configuracion_tenant_key_filename_check" CHECK ((key_filename ~ '^[A-Za-z0-9._-]+\.key$'::text)),
  CONSTRAINT "facturacion_configuracion_tenant_pkey" PRIMARY KEY (tenant_id),
  CONSTRAINT "facturacion_configuracion_tenant_punto_venta_check" CHECK ((punto_venta > 0)),
  CONSTRAINT "facturacion_configuracion_tenant_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

ALTER TABLE "public"."facturacion_configuracion_tenant"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER facturacion_configuracion_set_updated_at
  BEFORE UPDATE ON public.facturacion_configuracion_tenant
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_set_updated_at();

CREATE POLICY "facturacion_configuracion_lectura_admin" ON "public"."facturacion_configuracion_tenant"
  FOR SELECT
  TO "authenticated"
  USING (((tenant_id = public.current_tenant_id()) AND ((auth.jwt() ->> 'user_role'::text) = 'admin'::text)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_configuracion_tenant" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_configuracion_tenant" TO "service_role";

REVOKE ALL ON TABLE "public"."facturacion_configuracion_tenant" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_configuracion_tenant" TO "postgres";
