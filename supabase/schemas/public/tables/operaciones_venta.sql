CREATE TABLE "public"."operaciones_venta" (
  "operacion_id" uuid                     NOT NULL,
  "tenant_id"    uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  "cliente_id"   uuid                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "operaciones_venta_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT,
  CONSTRAINT "operaciones_venta_operacion_id_fkey" FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT "operaciones_venta_pkey" PRIMARY KEY (operacion_id),
  CONSTRAINT "operaciones_venta_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."operaciones_venta"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_op_venta_cliente ON public.operaciones_venta USING btree (tenant_id, cliente_id);
CREATE INDEX idx_op_venta_tenant ON public.operaciones_venta USING btree (tenant_id);

CREATE POLICY "tenant_access" ON "public"."operaciones_venta"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_venta" TO "anon", "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_venta" TO "service_role";
REVOKE ALL ON TABLE "public"."operaciones_venta" FROM "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_venta" TO "postgres";
