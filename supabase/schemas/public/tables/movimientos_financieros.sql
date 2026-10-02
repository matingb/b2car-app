CREATE TABLE "public"."movimientos_financieros" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"            uuid                     NOT NULL,
  "cuenta_financiera_id" uuid                     NOT NULL,
  "importe"              numeric(14,2)            NOT NULL,
  "fecha"                timestamp with time zone NOT NULL DEFAULT now(),
  "operacion_id"         uuid,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "movimientos_financieros_cuenta_financiera_id_fkey" FOREIGN KEY (cuenta_financiera_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY (id),
  CONSTRAINT "movimientos_financieros_operacion_id_fkey" FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE SET NULL,
  CONSTRAINT "movimientos_financieros_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."movimientos_financieros"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mov_cuenta_fecha ON public.movimientos_financieros USING btree (cuenta_financiera_id, fecha DESC, created_at DESC);

CREATE INDEX idx_mov_operacion ON public.movimientos_financieros USING btree (operacion_id)
  WHERE (operacion_id IS NOT NULL);

CREATE INDEX idx_mov_tenant_fecha ON public.movimientos_financieros USING btree (tenant_id, fecha DESC);

CREATE TRIGGER movimientos_financieros_actualizar_saldo
  AFTER INSERT ON public.movimientos_financieros
  FOR EACH ROW
  EXECUTE FUNCTION public._finanzas_actualizar_saldo_cuenta();

CREATE TRIGGER movimientos_financieros_bloquear_mutacion
  BEFORE DELETE OR UPDATE ON public.movimientos_financieros
  FOR EACH ROW
  EXECUTE FUNCTION public._finanzas_bloquear_mutacion_ledger();

CREATE TRIGGER movimientos_financieros_validar_tenant
  BEFORE INSERT ON public.movimientos_financieros
  FOR EACH ROW
  EXECUTE FUNCTION public._finanzas_validar_movimiento_tenant();

CREATE POLICY "movimientos_financieros_tenant_select" ON "public"."movimientos_financieros"
  FOR SELECT
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movimientos_financieros" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movimientos_financieros" TO "service_role";

REVOKE ALL ON TABLE "public"."movimientos_financieros" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movimientos_financieros" TO "postgres";
