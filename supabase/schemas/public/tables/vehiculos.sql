CREATE TABLE "public"."vehiculos" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "cliente_id"    uuid                     NOT NULL,
  "patente"       text                     NOT NULL,
  "marca"         text                     NOT NULL,
  "modelo"        text                     NOT NULL,
  "created_at"    timestamp with time zone DEFAULT now(),
  "fecha_patente" text,
  "nro_interno"   text,
  "numero_chasis" text                     NOT NULL DEFAULT ''::text,
  "color"         text                     NOT NULL DEFAULT ''::text,
  "numero_motor"  text                     NOT NULL DEFAULT ''::text,
  CONSTRAINT "vehiculos_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE,
  CONSTRAINT "vehiculos_pkey" PRIMARY KEY (id),
  "tenant_id"     uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "fk_vehiculos_tenant" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT "vehiculos_patente_tenant_unique" UNIQUE (patente, tenant_id)
);

ALTER TABLE "public"."vehiculos"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_vehiculos_cliente_id ON public.vehiculos USING btree (cliente_id);

CREATE INDEX idx_vehiculos_patente ON public.vehiculos USING btree (patente);

CREATE TRIGGER facturacion_proteger_vehiculos
  BEFORE UPDATE OF cliente_id ON public.vehiculos
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER trg_sync_vehiculo_cliente_id_to_arreglos
  AFTER UPDATE OF cliente_id ON public.vehiculos
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_vehiculo_cliente_id_to_arreglos();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vehiculos" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vehiculos" TO "service_role";

CREATE INDEX idx_vehiculos_tenant_id ON public.vehiculos USING btree (tenant_id);

CREATE POLICY "tenant_access" ON "public"."vehiculos"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."vehiculos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vehiculos" TO "postgres";
