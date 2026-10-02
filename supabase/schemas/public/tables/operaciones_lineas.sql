CREATE TABLE "public"."operaciones_lineas" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "operacion_id"         uuid                     NOT NULL,
  "cantidad"             integer                  NOT NULL DEFAULT 0,
  "monto_unitario"       numeric(12,2)            NOT NULL DEFAULT 0,
  "delta_cantidad"       integer                  NOT NULL DEFAULT 0,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "stock_id"             uuid                     NOT NULL,
  "categoria_arreglo_id" uuid,
  "empleado_id"          uuid,
  "iva_alicuota_id"      smallint                 NOT NULL DEFAULT 5,
  CONSTRAINT "operaciones_lineas_categoria_arreglo_id_fkey" FOREIGN KEY (categoria_arreglo_id) REFERENCES public.categorias_arreglo(id) ON DELETE SET NULL,
  CONSTRAINT "operaciones_lineas_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE SET NULL,
  CONSTRAINT "operaciones_lineas_iva_alicuota_id_check" CHECK ((iva_alicuota_id = ANY (ARRAY[3, 4, 5, 6, 8, 9]))),
  CONSTRAINT "operaciones_lineas_operacion_id_fkey" FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT "operaciones_lineas_pkey" PRIMARY KEY (id),
  CONSTRAINT "operaciones_lineas_stock_id_fkey" FOREIGN KEY (stock_id) REFERENCES public.stocks(id) ON DELETE CASCADE
);

ALTER TABLE "public"."operaciones_lineas"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_operaciones_lineas_categoria_arreglo_id ON public.operaciones_lineas USING btree (categoria_arreglo_id);

CREATE INDEX idx_operaciones_lineas_empleado_id ON public.operaciones_lineas USING btree (empleado_id);

CREATE INDEX idx_operaciones_lineas_stock_id ON public.operaciones_lineas USING btree (stock_id);

CREATE UNIQUE INDEX uq_operaciones_lineas_operacion_stock ON public.operaciones_lineas USING btree (operacion_id, stock_id);

CREATE TRIGGER facturacion_proteger_lineas_venta_facturada
  BEFORE INSERT OR DELETE OR UPDATE ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada();

CREATE TRIGGER facturacion_proteger_operaciones_lineas
  BEFORE INSERT OR DELETE OR UPDATE ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER operaciones_lineas_sync_derivados
  AFTER INSERT OR DELETE OR UPDATE OF categoria_arreglo_id, empleado_id ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_operaciones_lineas_sync_derivados();

CREATE TRIGGER trigger_recalcular_precio_operaciones_lineas
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_lineas" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_lineas" TO "service_role";

CREATE POLICY "tenant_access" ON "public"."operaciones_lineas"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.operaciones o
  WHERE ((o.id = operaciones_lineas.operacion_id) AND (o.tenant_id = public.current_tenant_id())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.operaciones o
  WHERE ((o.id = operaciones_lineas.operacion_id) AND (o.tenant_id = public.current_tenant_id())))));

REVOKE ALL ON TABLE "public"."operaciones_lineas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_lineas" TO "postgres";
