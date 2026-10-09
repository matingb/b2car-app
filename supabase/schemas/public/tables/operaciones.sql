CREATE TABLE "public"."operaciones" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "taller_id"  uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "fecha"      timestamp with time zone NOT NULL DEFAULT now(),
  "cliente_id" uuid,
  CONSTRAINT "operaciones_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT,
  CONSTRAINT "operaciones_pkey" PRIMARY KEY (id),
  CONSTRAINT "operaciones_taller_id_fkey" FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE,
  "tenant_id"  uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "operaciones_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."operaciones"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."operaciones"
  ADD COLUMN "tipo" public.tipo_operacion NOT NULL;

ALTER TABLE "public"."operaciones"
  ADD COLUMN "observaciones" text;

ALTER TABLE "public"."operaciones"
  ADD CONSTRAINT "operaciones_taller_requerido" CHECK (((taller_id IS NOT NULL) OR ((tipo)::text = 'MOVIMIENTO_CUENTA'::text)));

CREATE INDEX idx_operaciones_fecha ON public.operaciones USING btree (fecha);

CREATE TRIGGER facturacion_proteger_operaciones
  BEFORE DELETE ON public.operaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER facturacion_proteger_venta_facturada
  BEFORE DELETE OR UPDATE ON public.operaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones" TO "service_role";

CREATE INDEX idx_operaciones_tenant_fecha_created_id ON public.operaciones USING btree (tenant_id, fecha DESC, created_at DESC, id DESC);

CREATE INDEX idx_operaciones_tenant_taller ON public.operaciones USING btree (tenant_id, taller_id);

CREATE INDEX idx_operaciones_tenant_tipo_created ON public.operaciones USING btree (tenant_id, tipo, created_at DESC);

CREATE INDEX idx_operaciones_tenant ON public.operaciones USING btree (tenant_id);

CREATE INDEX operaciones_cliente_idx ON public.operaciones USING btree (tenant_id, cliente_id)
  WHERE (cliente_id IS NOT NULL);

CREATE POLICY "tenant_access" ON "public"."operaciones"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."operaciones" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones" TO "postgres";
