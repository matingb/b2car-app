CREATE TABLE "public"."detalle_arreglo" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "arreglo_id"            uuid                     NOT NULL,
  "descripcion"           text                     NOT NULL,
  "cantidad"              integer                  NOT NULL DEFAULT 1,
  "precio_hora_facturada" numeric(12,2)            NOT NULL,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "categoria_arreglo_id"  uuid,
  "empleado_id"           uuid,
  "iva_alicuota_id"       smallint                 NOT NULL DEFAULT 5,
  "valor_hora_empleado"   numeric(12,2),
  "horas_facturadas"      numeric(6,2)             DEFAULT 1,
  "horas_trabajadas"      numeric(6,2)             DEFAULT 1,
  CONSTRAINT "detalle_arreglo_arreglo_id_fkey" FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE CASCADE,
  CONSTRAINT "detalle_arreglo_cantidad_pos" CHECK ((cantidad > 0)),
  CONSTRAINT "detalle_arreglo_categoria_arreglo_id_fkey" FOREIGN KEY (categoria_arreglo_id) REFERENCES public.categorias_arreglo(id) ON DELETE SET NULL,
  CONSTRAINT "detalle_arreglo_horas_facturadas_check" CHECK ((horas_facturadas >= (0)::numeric)),
  CONSTRAINT "detalle_arreglo_horas_trabajadas_check" CHECK ((horas_trabajadas >= (0)::numeric)),
  CONSTRAINT "detalle_arreglo_iva_alicuota_id_check" CHECK ((iva_alicuota_id = ANY (ARRAY[3, 4, 5, 6, 8, 9]))),
  CONSTRAINT "detalle_arreglo_pkey" PRIMARY KEY (id),
  CONSTRAINT "detalle_arreglo_valor_hora_empleado_check" CHECK (((valor_hora_empleado IS NULL) OR (valor_hora_empleado >= (0)::numeric))),
  CONSTRAINT "detalle_arreglo_valor_nonneg" CHECK ((precio_hora_facturada >= (0)::numeric)),
  CONSTRAINT "detalle_arreglo_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE SET NULL,
  "tenant_id"             uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "detalle_arreglo_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."detalle_arreglo"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_detalle_arreglo_arreglo_id ON public.detalle_arreglo USING btree (arreglo_id);

CREATE TRIGGER detalle_arreglo_set_updated_at
  BEFORE UPDATE ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER detalle_arreglo_snapshot_valores
  BEFORE INSERT OR UPDATE ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public._snapshot_detalle_arreglo_valores();

CREATE TRIGGER detalle_arreglo_sync_derivados
  AFTER INSERT OR DELETE OR UPDATE OF categoria_arreglo_id, empleado_id ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_detalle_arreglo_sync_derivados();

CREATE TRIGGER facturacion_proteger_detalle_arreglo
  BEFORE INSERT OR DELETE OR UPDATE ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER trigger_recalcular_precio_detalle_arreglo
  AFTER INSERT OR DELETE OR UPDATE ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."detalle_arreglo" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."detalle_arreglo" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."detalle_arreglo" TO "service_role";

CREATE INDEX idx_detalle_arreglo_categoria_arreglo_id ON public.detalle_arreglo USING btree (tenant_id, categoria_arreglo_id);

CREATE INDEX idx_detalle_arreglo_empleado_id ON public.detalle_arreglo USING btree (tenant_id, empleado_id);

CREATE INDEX idx_detalle_arreglo_tenant_arreglo ON public.detalle_arreglo USING btree (tenant_id, arreglo_id);

CREATE POLICY "tenant_access" ON "public"."detalle_arreglo"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

COMMENT ON COLUMN "public"."detalle_arreglo"."horas_facturadas" IS 'NULL identifica horas históricas desconocidas; las nuevas líneas reciben default 1.';

REVOKE ALL ("arreglo_id") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("arreglo_id") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("cantidad") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("cantidad") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("categoria_arreglo_id") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("categoria_arreglo_id") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("created_at") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("created_at") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("descripcion") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("descripcion") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("empleado_id") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("empleado_id") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("horas_facturadas") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("horas_facturadas") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("horas_trabajadas") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("horas_trabajadas") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("id") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("id") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("iva_alicuota_id") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("iva_alicuota_id") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("precio_hora_facturada") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("precio_hora_facturada") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ("updated_at") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("updated_at") ON TABLE "public"."detalle_arreglo" TO "authenticated";

REVOKE ALL ON TABLE "public"."detalle_arreglo" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."detalle_arreglo" TO "postgres";

REVOKE ALL ("tenant_id") ON TABLE "public"."detalle_arreglo" FROM "authenticated";

GRANT SELECT ("tenant_id") ON TABLE "public"."detalle_arreglo" TO "authenticated";
