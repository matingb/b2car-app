CREATE TABLE "public"."turnos" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "fecha"         date                     NOT NULL,
  "hora"          time without time zone   NOT NULL,
  "duracion"      integer,
  "vehiculo_id"   uuid,
  "cliente_id"    uuid,
  "tipo"          text,
  "descripcion"   text,
  "observaciones" text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "titulo"        text                     NOT NULL,
  "taller_id"     uuid                     NOT NULL,
  CONSTRAINT "turnos_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL,
  CONSTRAINT "turnos_pkey" PRIMARY KEY (id),
  CONSTRAINT "turnos_taller_id_fkey" FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE,
  CONSTRAINT "turnos_vehiculo_id_fkey" FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE SET NULL,
  "tenant_id"     uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "turnos_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."turnos"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."turnos"
  ADD COLUMN "estado" public.turno_estado NOT NULL DEFAULT 'pendiente'::public.turno_estado;

CREATE INDEX idx_turnos_cliente ON public.turnos USING btree (cliente_id);

CREATE INDEX idx_turnos_estado ON public.turnos USING btree (estado);

CREATE INDEX idx_turnos_fecha ON public.turnos USING btree (fecha);

CREATE INDEX idx_turnos_taller_fecha_hora ON public.turnos USING btree (taller_id, fecha, hora);

CREATE INDEX idx_turnos_vehiculo ON public.turnos USING btree (vehiculo_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turnos" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turnos" TO "service_role";

CREATE POLICY "tenant_access" ON "public"."turnos"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."turnos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turnos" TO "postgres";
