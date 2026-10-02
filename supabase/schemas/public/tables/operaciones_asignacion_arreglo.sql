CREATE TABLE "public"."operaciones_asignacion_arreglo" (
  "operacion_id" uuid NOT NULL,
  "arreglo_id"   uuid NOT NULL,
  CONSTRAINT "operaciones_asignacion_arreglo_arreglo_id_fkey" FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE CASCADE,
  CONSTRAINT "operaciones_asignacion_arreglo_operacion_id_fkey" FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT "pk_operaciones_asignacion_arreglo" PRIMARY KEY (operacion_id)
);

ALTER TABLE "public"."operaciones_asignacion_arreglo"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_op_asig_arreglo_arreglo_id ON public.operaciones_asignacion_arreglo USING btree (arreglo_id);

CREATE UNIQUE INDEX uq_operaciones_asignacion_arreglo_arreglo_id ON public.operaciones_asignacion_arreglo USING btree (arreglo_id);

CREATE TRIGGER b2c152_guardar_asignacion
  BEFORE INSERT OR UPDATE ON public.operaciones_asignacion_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public._b2c152_guardar_asignacion();

CREATE TRIGGER facturacion_proteger_asignacion_arreglo
  BEFORE INSERT OR DELETE OR UPDATE ON public.operaciones_asignacion_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER trigger_recalcular_precio_asignacion
  AFTER INSERT OR DELETE ON public.operaciones_asignacion_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_asignacion_arreglo" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_asignacion_arreglo" TO "service_role";

CREATE POLICY "tenant_access" ON "public"."operaciones_asignacion_arreglo"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.operaciones o
  WHERE ((o.id = operaciones_asignacion_arreglo.operacion_id) AND (o.tenant_id = public.current_tenant_id())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.operaciones o
  WHERE ((o.id = operaciones_asignacion_arreglo.operacion_id) AND (o.tenant_id = public.current_tenant_id())))));

REVOKE ALL ON TABLE "public"."operaciones_asignacion_arreglo" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_asignacion_arreglo" TO "postgres";
