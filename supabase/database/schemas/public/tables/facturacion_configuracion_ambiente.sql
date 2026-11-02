CREATE TABLE public.facturacion_configuracion_ambiente (
  tenant_id                 uuid                     NOT NULL,
  ambiente                  text                     NOT NULL,
  razon_social              text                     NOT NULL,
  nombre_fantasia           text,
  cuit                      text                     NOT NULL,
  condicion_iva_emisor      text                     DEFAULT 'MONOTRIBUTISTA'::text NOT NULL,
  domicilio                 text                     NOT NULL,
  ingresos_brutos           text,
  inicio_actividades        date                     NOT NULL,
  punto_venta               integer                  NOT NULL,
  habilitada                boolean                  DEFAULT false NOT NULL,
  cert_storage_path         text,
  key_storage_path          text,
  cert_original_filename    text,
  key_original_filename     text,
  cert_fingerprint_sha256   text,
  cert_expires_at           timestamp with time zone,
  credenciales_updated_at   timestamp with time zone,
  credenciales_updated_by   uuid,
  fce_monto_minimo          numeric(14,2),
  created_at                timestamp with time zone DEFAULT now() NOT NULL,
  updated_at                timestamp with time zone DEFAULT now() NOT NULL,
  fce_cbu                   text,
  fce_sistema               text,
  ingresos_brutos_condicion text
);

CREATE TRIGGER facturacion_config_ambiente_set_updated_at
  BEFORE UPDATE ON public.facturacion_configuracion_ambiente
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_set_updated_at();

CREATE POLICY facturacion_config_ambiente_delete_admin ON public.facturacion_configuracion_ambiente
  FOR DELETE
  TO authenticated
  USING (((tenant_id = public.current_tenant_id()) AND ((auth.jwt() ->> 'user_role'::text) = 'admin'::text)));

CREATE POLICY facturacion_config_ambiente_insert_admin ON public.facturacion_configuracion_ambiente
  FOR INSERT
  TO authenticated
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND ((auth.jwt() ->> 'user_role'::text) = 'admin'::text)));

CREATE POLICY facturacion_config_ambiente_select_tenant ON public.facturacion_configuracion_ambiente
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

CREATE POLICY facturacion_config_ambiente_update_admin ON public.facturacion_configuracion_ambiente
  FOR UPDATE
  TO authenticated
  USING (((tenant_id = public.current_tenant_id()) AND ((auth.jwt() ->> 'user_role'::text) = 'admin'::text)))
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND ((auth.jwt() ->> 'user_role'::text) = 'admin'::text)));

ALTER TABLE public.facturacion_configuracion_ambiente
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_config_ambiente_credenciales_completas
    CHECK
    (cert_storage_path IS NULL AND key_storage_path IS NULL AND cert_original_filename IS NULL AND key_original_filename IS NULL AND cert_fingerprint_sha256 IS NULL AND
    cert_expires_at IS NULL OR NULLIF(btrim(cert_storage_path), ''::text) IS NOT NULL AND NULLIF(btrim(key_storage_path), ''::text) IS
    NOT NULL AND NULLIF(btrim(cert_original_filename), ''::text) IS NOT NULL AND NULLIF(btrim(key_original_filename), ''::text) IS
    NOT NULL AND cert_fingerprint_sha256 ~ '^[A-F0-9:]{95}$'::text AND cert_expires_at IS NOT NULL);

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_ambiente_check CHECK (ambiente = ANY (ARRAY['HOMOLOGACION'::text, 'PRODUCCION'::text]));

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_condicion_iva_emisor_check CHECK (condicion_iva_emisor = ANY (ARRAY['MONOTRIBUTISTA'::text, 'RESPONSABLE_INSCRIPTO'::text]));

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_cuit_check CHECK (cuit ~ '^[0-9]{11}$'::text);

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_fce_cbu_check CHECK (fce_cbu IS NULL OR fce_cbu ~ '^[0-9]{22}$'::text);

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_fce_monto_minimo_check CHECK (fce_monto_minimo IS NULL OR fce_monto_minimo > 0::numeric);

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_fce_sistema_check CHECK (fce_sistema = ANY (ARRAY['SCA'::text, 'ADC'::text]));

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_iibb_condicion_check
    CHECK (ingresos_brutos_condicion IS NULL OR (ingresos_brutos_condicion = ANY (ARRAY['INSCRIPTO'::text, 'EXENTO'::text, 'NO_CONTRIBUYENTE'::text])));

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_iibb_numero_check
    CHECK (ingresos_brutos_condicion IS DISTINCT FROM 'INSCRIPTO'::text OR NULLIF(btrim(ingresos_brutos), ''::text) IS NOT NULL);

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_pkey PRIMARY KEY (tenant_id, ambiente);

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_punto_venta_check CHECK (punto_venta > 0);

ALTER TABLE public.facturacion_configuracion_ambiente
  ADD CONSTRAINT facturacion_configuracion_ambiente_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.facturacion_configuracion_ambiente TO authenticated;

GRANT ALL ON public.facturacion_configuracion_ambiente TO service_role;