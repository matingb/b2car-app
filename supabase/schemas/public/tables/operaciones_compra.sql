CREATE TABLE "public"."operaciones_compra" (
  "operacion_id" uuid                     NOT NULL,
  "tenant_id"    uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  "proveedor_id" uuid                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "operaciones_compra_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE RESTRICT,
  CONSTRAINT "operaciones_compra_operacion_id_fkey" FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT "operaciones_compra_pkey" PRIMARY KEY (operacion_id),
  CONSTRAINT "operaciones_compra_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."operaciones_compra"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_op_compra_proveedor ON public.operaciones_compra USING btree (tenant_id, proveedor_id);
CREATE INDEX idx_op_compra_tenant ON public.operaciones_compra USING btree (tenant_id);

CREATE POLICY "tenant_access" ON "public"."operaciones_compra"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_compra" TO "anon", "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_compra" TO "service_role";
REVOKE ALL ON TABLE "public"."operaciones_compra" FROM "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_compra" TO "postgres";
