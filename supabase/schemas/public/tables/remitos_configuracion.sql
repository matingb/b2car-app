CREATE TABLE "public"."remitos_configuracion" (
  "tenant_id"                  uuid                     NOT NULL,
  "ambiente"                   text                     NOT NULL,
  "r_cai"                      text,
  "r_cai_vencimiento"          date,
  "r_punto_emision"            integer,
  "r_numero_desde"             integer,
  "r_numero_hasta"             integer,
  "r_proximo_numero"           integer                  NOT NULL DEFAULT 1,
  "r_inicio_actividades"       date,
  "r_autoimpresor"             boolean                  NOT NULL DEFAULT true,
  "r_imprenta_razon_social"    text,
  "r_imprenta_cuit"            text,
  "r_imprenta_fecha_impresion" date,
  "r_imprenta_habilitacion"    text,
  "x_punto_emision"            integer                  NOT NULL DEFAULT 1,
  "x_proximo_numero"           integer                  NOT NULL DEFAULT 1,
  "created_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by"                 uuid,
  CONSTRAINT "remitos_configuracion_ambiente_check" CHECK ((ambiente = ANY (ARRAY['HOMOLOGACION'::text, 'PRODUCCION'::text]))),
  CONSTRAINT "remitos_configuracion_pkey" PRIMARY KEY (tenant_id, ambiente),
  CONSTRAINT "remitos_configuracion_r_autoimpresor_check" CHECK (r_autoimpresor),
  CONSTRAINT "remitos_configuracion_r_cai_check" CHECK ((r_cai ~ '^[0-9]{14}$'::text)),
  CONSTRAINT "remitos_configuracion_r_imprenta_cuit_check" CHECK ((r_imprenta_cuit ~ '^[0-9]{11}$'::text)),
  CONSTRAINT "remitos_configuracion_r_imprenta_habilitacion_check" CHECK ((char_length(r_imprenta_habilitacion) <= 50)),
  CONSTRAINT "remitos_configuracion_r_imprenta_razon_social_check" CHECK ((char_length(r_imprenta_razon_social) <= 200)),
  CONSTRAINT "remitos_configuracion_r_numero_desde_check" CHECK (((r_numero_desde >= 1) AND (r_numero_desde <= 99999999))),
  CONSTRAINT "remitos_configuracion_r_numero_hasta_check" CHECK (((r_numero_hasta >= 1) AND (r_numero_hasta <= 99999999))),
  CONSTRAINT "remitos_configuracion_r_proximo_numero_check" CHECK (((r_proximo_numero >= 1) AND (r_proximo_numero <= 99999999))),
  CONSTRAINT "remitos_configuracion_r_punto_emision_check" CHECK (((r_punto_emision >= 1) AND (r_punto_emision <= 99999))),
  CONSTRAINT "remitos_configuracion_r_rango_check"
    CHECK (((r_numero_desde IS NULL) OR (r_numero_hasta IS NULL) OR (r_numero_desde <= r_numero_hasta))),
  CONSTRAINT "remitos_configuracion_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT "remitos_configuracion_x_proximo_numero_check" CHECK (((x_proximo_numero >= 1) AND (x_proximo_numero <= 99999999))),
  CONSTRAINT "remitos_configuracion_x_punto_emision_check" CHECK (((x_punto_emision >= 1) AND (x_punto_emision <= 99999)))
);

ALTER TABLE "public"."remitos_configuracion"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER remitos_configuracion_set_updated_at
  BEFORE UPDATE ON public.remitos_configuracion
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_set_updated_at();

CREATE TRIGGER remitos_configuracion_validar_numeracion
  BEFORE INSERT OR UPDATE ON public.remitos_configuracion
  FOR EACH ROW
  EXECUTE FUNCTION public.remitos_configuracion_validar_numeracion();

CREATE POLICY "remitos_configuracion_insert" ON "public"."remitos_configuracion"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND ( SELECT public._b2c179_tiene_permiso('configuracion:edit'::text) AS _b2c179_tiene_permiso) AND ( SELECT public._b2c179_tiene_permiso('facturas:edit'::text) AS _b2c179_tiene_permiso)));

CREATE POLICY "remitos_configuracion_select" ON "public"."remitos_configuracion"
  FOR SELECT
  TO "authenticated"
  USING (((tenant_id = public.current_tenant_id()) AND ( SELECT public._b2c179_tiene_permiso('facturas:view'::text) AS _b2c179_tiene_permiso)));

CREATE POLICY "remitos_configuracion_update" ON "public"."remitos_configuracion"
  FOR UPDATE
  TO "authenticated"
  USING (((tenant_id = public.current_tenant_id()) AND ( SELECT public._b2c179_tiene_permiso('configuracion:edit'::text) AS _b2c179_tiene_permiso) AND ( SELECT public._b2c179_tiene_permiso('facturas:edit'::text) AS _b2c179_tiene_permiso)))
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND ( SELECT public._b2c179_tiene_permiso('configuracion:edit'::text) AS _b2c179_tiene_permiso) AND ( SELECT public._b2c179_tiene_permiso('facturas:edit'::text) AS _b2c179_tiene_permiso)));

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."remitos_configuracion" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."remitos_configuracion" TO "service_role";

REVOKE ALL ON TABLE "public"."remitos_configuracion" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."remitos_configuracion" TO "postgres";
