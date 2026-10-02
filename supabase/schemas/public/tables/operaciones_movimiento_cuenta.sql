CREATE TABLE "public"."operaciones_movimiento_cuenta" (
  "operacion_id"      uuid                     NOT NULL,
  "tenant_id"         uuid                     NOT NULL,
  "subtipo"           text                     NOT NULL,
  "cuenta_id"         uuid,
  "importe"           numeric(14,2),
  "cuenta_origen_id"  uuid,
  "cuenta_destino_id" uuid,
  "categoria_gasto"   text,
  "descripcion"       text,
  "idempotency_key"   uuid,
  "created_by"        uuid,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "omc_categoria_gasto_check"
    CHECK
    (((categoria_gasto IS NULL) OR (categoria_gasto = ANY (ARRAY['ALQUILER'::text, 'SERVICIOS'::text, 'SUELDOS_HONORARIOS'::text, 'IMPUESTOS'::text, 'INSUMOS_REPUESTOS'::text,
    'HERRAMIENTAS_EQUIPAMIENTO'::text,
    'MANTENIMIENTO'::text, 'SEGUROS'::text, 'TRANSPORTE_COMBUSTIBLE'::text, 'MARKETING_PUBLICIDAD'::text, 'COMISIONES_GASTOS_BANCARIOS'::text, 'OTROS'::text])))),
  CONSTRAINT "omc_cuenta_xor" CHECK ((((subtipo = ANY (ARRAY['GASTO'::text, 'INGRESO'::text, 'APERTURA_CUENTA'::text])) AND (cuenta_id IS
    NOT NULL) AND (cuenta_origen_id IS NULL) AND (cuenta_destino_id IS NULL) AND (importe IS
    NOT NULL) AND (importe <> (0)::numeric)) OR ((subtipo = 'TRANSFERENCIA'::text) AND (cuenta_id IS NULL) AND (cuenta_origen_id IS NOT NULL) AND (cuenta_destino_id IS
    NOT NULL) AND (cuenta_origen_id <> cuenta_destino_id) AND (importe IS NOT NULL) AND (importe > (0)::numeric)))),
  CONSTRAINT "omc_subtipo_check" CHECK ((subtipo = ANY (ARRAY['GASTO'::text, 'INGRESO'::text, 'TRANSFERENCIA'::text, 'APERTURA_CUENTA'::text]))),
  CONSTRAINT "operaciones_movimiento_cuenta_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "operaciones_movimiento_cuenta_cuenta_destino_id_fkey" FOREIGN KEY (cuenta_destino_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  CONSTRAINT "operaciones_movimiento_cuenta_cuenta_id_fkey" FOREIGN KEY (cuenta_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  CONSTRAINT "operaciones_movimiento_cuenta_cuenta_origen_id_fkey" FOREIGN KEY (cuenta_origen_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  CONSTRAINT "operaciones_movimiento_cuenta_operacion_id_fkey" FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT "operaciones_movimiento_cuenta_pkey" PRIMARY KEY (operacion_id),
  CONSTRAINT "operaciones_movimiento_cuenta_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."operaciones_movimiento_cuenta"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."operaciones_movimiento_cuenta"
  ADD CONSTRAINT "omc_ingreso_descripcion_check" CHECK (((subtipo <> 'INGRESO'::text) OR (NULLIF(btrim(descripcion), ''::text) IS NOT NULL))) NOT VALID;

CREATE INDEX idx_omc_cuenta_destino ON public.operaciones_movimiento_cuenta USING btree (cuenta_destino_id)
  WHERE (cuenta_destino_id IS NOT NULL);

CREATE INDEX idx_omc_cuenta_origen ON public.operaciones_movimiento_cuenta USING btree (cuenta_origen_id)
  WHERE (cuenta_origen_id IS NOT NULL);

CREATE INDEX idx_omc_cuenta ON public.operaciones_movimiento_cuenta USING btree (cuenta_id)
  WHERE (cuenta_id IS NOT NULL);

CREATE INDEX idx_omc_tenant ON public.operaciones_movimiento_cuenta USING btree (tenant_id);

CREATE UNIQUE INDEX omc_tenant_idempotency_key ON public.operaciones_movimiento_cuenta USING btree (tenant_id, idempotency_key)
  WHERE (idempotency_key IS NOT NULL);

CREATE TRIGGER omc_after_delete
  AFTER DELETE ON public.operaciones_movimiento_cuenta
  FOR EACH ROW
  EXECUTE FUNCTION public._omc_after_delete();

CREATE TRIGGER omc_after_insert
  AFTER INSERT ON public.operaciones_movimiento_cuenta
  FOR EACH ROW
  EXECUTE FUNCTION public._omc_after_insert();

CREATE TRIGGER omc_after_update
  AFTER UPDATE ON public.operaciones_movimiento_cuenta
  FOR EACH ROW
  EXECUTE FUNCTION public._omc_after_update();

CREATE POLICY "omc_tenant_select" ON "public"."operaciones_movimiento_cuenta"
  FOR SELECT
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_movimiento_cuenta" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_movimiento_cuenta" TO "service_role";

REVOKE ALL ON TABLE "public"."operaciones_movimiento_cuenta" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_movimiento_cuenta" TO "postgres";
