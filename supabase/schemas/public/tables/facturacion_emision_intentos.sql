CREATE TABLE "public"."facturacion_emision_intentos" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "factura_id"          uuid                     NOT NULL,
  "numero_intento"      integer                  NOT NULL,
  "estado"              text                     NOT NULL,
  "candidato"           jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "request_sanitizado"  jsonb,
  "response_sanitizada" jsonb,
  "error_codigo"        text,
  "error_mensaje"       text,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at"        timestamp with time zone,
  CONSTRAINT "facturacion_emision_intentos_estado_check" CHECK ((estado = ANY (ARRAY['ENVIADO'::text, 'AUTORIZADO'::text, 'RECHAZADO'::text, 'INCIERTO'::text]))),
  CONSTRAINT "facturacion_emision_intentos_numero_intento_check" CHECK ((numero_intento > 0)),
  CONSTRAINT "facturacion_emision_intentos_numero_unico" UNIQUE (factura_id, numero_intento),
  CONSTRAINT "facturacion_emision_intentos_pkey" PRIMARY KEY (id),
  CONSTRAINT "facturacion_emision_intentos_factura_id_fkey" FOREIGN KEY (factura_id) REFERENCES public.facturas_electronicas(id) ON DELETE CASCADE
);

ALTER TABLE "public"."facturacion_emision_intentos"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facturacion_intentos_insert_tenant" ON "public"."facturacion_emision_intentos"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturacion_emision_intentos.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

CREATE POLICY "facturacion_intentos_select_tenant" ON "public"."facturacion_emision_intentos"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturacion_emision_intentos.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

CREATE POLICY "facturacion_intentos_update_tenant" ON "public"."facturacion_emision_intentos"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturacion_emision_intentos.factura_id) AND (f.tenant_id = public.current_tenant_id())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturacion_emision_intentos.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_emision_intentos" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_emision_intentos" TO "service_role";

REVOKE ALL ON TABLE "public"."facturacion_emision_intentos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_emision_intentos" TO "postgres";
