CREATE TABLE "public"."empleados" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "taller_id"     uuid                     NOT NULL,
  "nombre"        text                     NOT NULL,
  "apellido"      text                     NOT NULL,
  "dni"           text                     NOT NULL,
  "email"         text,
  "telefono"      text,
  "cumpleanos"    date,
  "salario"       numeric,
  "fecha_ingreso" date,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "valor_hora"    numeric(12,2),
  CONSTRAINT "empleados_pkey" PRIMARY KEY (id),
  CONSTRAINT "empleados_salario_nonneg" CHECK (((salario IS NULL) OR (salario >= (0)::numeric))),
  CONSTRAINT "empleados_valor_hora_check" CHECK (((valor_hora IS NULL) OR (valor_hora >= (0)::numeric))),
  CONSTRAINT "empleados_taller_id_fkey" FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE,
  "tenant_id"     uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "empleados_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."empleados"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX empleados_taller_id_idx ON public.empleados USING btree (taller_id);

CREATE TRIGGER empleados_proteger_valor_hora
  BEFORE INSERT OR UPDATE OF valor_hora ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public._b2c179_proteger_valor_hora_empleado();

CREATE TRIGGER empleados_set_updated_at
  BEFORE UPDATE ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."empleados" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."empleados" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."empleados" TO "service_role";

CREATE INDEX empleados_tenant_id_idx ON public.empleados USING btree (tenant_id);

CREATE INDEX empleados_tenant_taller_idx ON public.empleados USING btree (tenant_id, taller_id);

CREATE POLICY "tenant_access" ON "public"."empleados"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ("apellido") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("apellido") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("created_at") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("created_at") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("cumpleanos") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("cumpleanos") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("dni") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("dni") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("email") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("email") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("fecha_ingreso") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("fecha_ingreso") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("id") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("id") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("nombre") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("nombre") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("salario") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("salario") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("taller_id") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("taller_id") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("telefono") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("telefono") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ("updated_at") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("updated_at") ON TABLE "public"."empleados" TO "authenticated";

REVOKE ALL ON TABLE "public"."empleados" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."empleados" TO "postgres";

REVOKE ALL ("tenant_id") ON TABLE "public"."empleados" FROM "authenticated";

GRANT SELECT ("tenant_id") ON TABLE "public"."empleados" TO "authenticated";
