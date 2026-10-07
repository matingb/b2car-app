CREATE TABLE "public"."remitos_lineas" (
  "id"               uuid          NOT NULL DEFAULT gen_random_uuid(),
  "remito_id"        uuid          NOT NULL,
  "ordinal"          smallint      NOT NULL,
  "codigo"           text,
  "descripcion"      text          NOT NULL,
  "observaciones"    text,
  "cantidad"         numeric(14,4) NOT NULL,
  "factura_linea_id" uuid,
  CONSTRAINT "remitos_lineas_cantidad_check" CHECK ((cantidad > (0)::numeric)),
  CONSTRAINT "remitos_lineas_codigo_check" CHECK ((char_length(codigo) <= 100)),
  CONSTRAINT "remitos_lineas_descripcion_check" CHECK (((char_length(btrim(descripcion)) >= 1) AND (char_length(btrim(descripcion)) <= 500))),
  CONSTRAINT "remitos_lineas_factura_linea_id_fkey" FOREIGN KEY (factura_linea_id) REFERENCES public.facturas_electronicas_lineas(id) ON DELETE RESTRICT,
  CONSTRAINT "remitos_lineas_observaciones_check" CHECK ((char_length(observaciones) <= 500)),
  CONSTRAINT "remitos_lineas_ordinal_check" CHECK ((ordinal > 0)),
  CONSTRAINT "remitos_lineas_ordinal_unico" UNIQUE (remito_id, ordinal),
  CONSTRAINT "remitos_lineas_pkey" PRIMARY KEY (id),
  CONSTRAINT "remitos_lineas_remito_id_fkey" FOREIGN KEY (remito_id) REFERENCES public.remitos(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."remitos_lineas"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX remitos_lineas_factura_linea_unica ON public.remitos_lineas USING btree (factura_linea_id, remito_id)
  WHERE (factura_linea_id IS NOT NULL);

CREATE TRIGGER remitos_lineas_inmutables
  BEFORE DELETE OR UPDATE ON public.remitos_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.remitos_bloquear_mutacion();

CREATE POLICY "remitos_lineas_select_tenant" ON "public"."remitos_lineas"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.remitos r
  WHERE ((r.id = remitos_lineas.remito_id) AND (r.tenant_id = public.current_tenant_id()) AND ( SELECT public._b2c179_tiene_permiso('facturas:view'::text) AS _b2c179_tiene_permiso)))));

GRANT SELECT ON TABLE "public"."remitos_lineas" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."remitos_lineas" TO "service_role";

REVOKE ALL ON TABLE "public"."remitos_lineas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."remitos_lineas" TO "postgres";
