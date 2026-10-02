CREATE TABLE "public"."arreglos" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "vehiculo_id"              uuid                     NOT NULL,
  "kilometraje_leido"        integer,
  "fecha"                    timestamp with time zone DEFAULT now(),
  "observaciones"            text,
  "precio_final"             numeric(14,2),
  "precio_sin_iva"           numeric(14,2),
  "esta_pago"                boolean                  DEFAULT false,
  "extra_data"               jsonb,
  "created_at"               timestamp with time zone DEFAULT now(),
  "descripcion"              text,
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "taller_id"                uuid,
  "categorias"               uuid[]                   NOT NULL DEFAULT '{}'::uuid[],
  "empleados"                uuid[]                   NOT NULL DEFAULT '{}'::uuid[],
  "movimiento_financiero_id" uuid,
  "total_cobrado"            numeric(14,2)            NOT NULL DEFAULT 0.00,
  "cliente_id"               uuid,
  "es_facturable"            boolean                  NOT NULL DEFAULT true,
  "combustible_leido"        integer,
  "repuestos_pendientes"     jsonb,
  "numero_orden"             integer                  NOT NULL,
  CONSTRAINT "arreglos_combustible_leido_check" CHECK (((combustible_leido IS NULL) OR ((combustible_leido >= 0) AND (combustible_leido <= 100)))),
  CONSTRAINT "arreglos_pkey" PRIMARY KEY (id),
  CONSTRAINT "arreglos_repuestos_pendientes_array_check" CHECK (((repuestos_pendientes IS NULL) OR (jsonb_typeof(repuestos_pendientes) = 'array'::text))),
  CONSTRAINT "arreglos_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT,
  CONSTRAINT "arreglos_movimiento_financiero_id_fkey" FOREIGN KEY (movimiento_financiero_id) REFERENCES public.movimientos_financieros(id) ON DELETE SET NULL,
  CONSTRAINT "arreglos_taller_id_fkey" FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE SET NULL,
  CONSTRAINT "arreglos_vehiculo_id_fkey" FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE CASCADE,
  "tenant_id"                uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "fk_arreglos_tenant" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT "uq_arreglos_tenant_numero_orden" UNIQUE (tenant_id, numero_orden)
);

ALTER TABLE "public"."arreglos"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."arreglos"
  ADD COLUMN "estado" public.estado_arreglo NOT NULL DEFAULT 'SIN_INICIAR'::public.estado_arreglo;

ALTER TABLE "public"."arreglos"
  ADD CONSTRAINT "arreglos_repuestos_pendientes_estado_check" CHECK (((repuestos_pendientes IS NULL) OR (estado = 'PRESUPUESTO'::public.estado_arreglo)));

CREATE INDEX arreglos_taller_fecha_idx ON public.arreglos USING btree (taller_id, fecha);

CREATE INDEX idx_arreglos_categorias ON public.arreglos USING gin (categorias);

CREATE INDEX idx_arreglos_empleados ON public.arreglos USING gin (empleados);

CREATE INDEX idx_arreglos_estado ON public.arreglos USING btree (estado);

CREATE INDEX idx_arreglos_fecha ON public.arreglos USING btree (fecha);

CREATE INDEX idx_arreglos_taller_id ON public.arreglos USING btree (taller_id);

CREATE INDEX idx_arreglos_updated_at ON public.arreglos USING btree (updated_at);

CREATE INDEX idx_arreglos_vehiculo_id ON public.arreglos USING btree (vehiculo_id);

CREATE TRIGGER b2c152_guardar_estado_arreglo
  BEFORE UPDATE OF estado ON public.arreglos
  FOR EACH ROW
  EXECUTE FUNCTION public._b2c152_guardar_estado_arreglo();

CREATE TRIGGER facturacion_proteger_arreglos
  BEFORE DELETE OR UPDATE ON public.arreglos
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER set_arreglos_updated_at
  BEFORE UPDATE ON public.arreglos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_recalcular_estado_pago
  BEFORE INSERT OR UPDATE OF precio_final, total_cobrado ON public.arreglos
  FOR EACH ROW
  EXECUTE FUNCTION public._recalcular_estado_pago_arreglo();

CREATE TRIGGER trg_set_arreglo_numero_orden
  BEFORE INSERT OR UPDATE ON public.arreglos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_arreglo_numero_orden();

CREATE TRIGGER trg_sync_arreglo_cliente_id
  BEFORE INSERT OR UPDATE OF vehiculo_id ON public.arreglos
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_arreglo_cliente_id();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."arreglos" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."arreglos" TO "service_role";

CREATE INDEX idx_arreglos_tenant_cliente ON public.arreglos USING btree (tenant_id, cliente_id);

CREATE INDEX idx_arreglos_tenant_facturable ON public.arreglos USING btree (tenant_id, es_facturable);

CREATE INDEX idx_arreglos_tenant_id ON public.arreglos USING btree (tenant_id);

CREATE INDEX idx_arreglos_tenant_taller ON public.arreglos USING btree (tenant_id, taller_id);

CREATE POLICY "tenant_access" ON "public"."arreglos"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

COMMENT ON COLUMN "public"."arreglos"."repuestos_pendientes" IS 'B2C-152: NULL = arreglo operativo o presupuesto historico; array = borrador diferido de un presupuesto nuevo.';

REVOKE ALL ON TABLE "public"."arreglos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."arreglos" TO "postgres";
