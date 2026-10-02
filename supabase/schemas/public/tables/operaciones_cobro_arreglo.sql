CREATE TABLE "public"."operaciones_cobro_arreglo" (
  "operacion_id" uuid                     NOT NULL,
  "arreglo_id"   uuid                     NOT NULL,
  "tenant_id"    uuid                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "operaciones_cobro_arreglo_arreglo_id_fkey" FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE CASCADE,
  CONSTRAINT "operaciones_cobro_arreglo_operacion_id_fkey" FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT "operaciones_cobro_arreglo_pkey" PRIMARY KEY (operacion_id),
  CONSTRAINT "operaciones_cobro_arreglo_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."operaciones_cobro_arreglo"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_op_cobro_arreglo_id ON public.operaciones_cobro_arreglo USING btree (arreglo_id);

CREATE INDEX idx_op_cobro_tenant ON public.operaciones_cobro_arreglo USING btree (tenant_id);

CREATE POLICY "operaciones_cobro_arreglo_tenant_select" ON "public"."operaciones_cobro_arreglo"
  FOR SELECT
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_cobro_arreglo" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_cobro_arreglo" TO "service_role";

REVOKE ALL ON TABLE "public"."operaciones_cobro_arreglo" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_cobro_arreglo" TO "postgres";
