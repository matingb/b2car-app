CREATE TABLE "public"."empleado_salarios" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "empleado_id"   uuid                     NOT NULL,
  "taller_id"     uuid                     NOT NULL,
  "salario"       numeric                  NOT NULL,
  "vigente_desde" date                     NOT NULL,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "empleado_salarios_pkey" PRIMARY KEY (id),
  CONSTRAINT "empleado_salarios_salario_nonneg" CHECK ((salario >= (0)::numeric)),
  CONSTRAINT "empleado_salarios_unique_vigencia" UNIQUE (empleado_id, vigente_desde),
  CONSTRAINT "empleado_salarios_empleado_fkey" FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE CASCADE,
  CONSTRAINT "empleado_salarios_taller_fkey" FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE,
  "tenant_id"     uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "empleado_salarios_tenant_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."empleado_salarios"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX empleado_salarios_empleado_id_idx ON public.empleado_salarios USING btree (empleado_id);

CREATE INDEX empleado_salarios_vigente_desde_idx ON public.empleado_salarios USING btree (vigente_desde);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."empleado_salarios" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."empleado_salarios" TO "service_role";

CREATE INDEX empleado_salarios_tenant_id_idx ON public.empleado_salarios USING btree (tenant_id);

CREATE POLICY "tenant_access" ON "public"."empleado_salarios"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."empleado_salarios" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."empleado_salarios" TO "postgres";
