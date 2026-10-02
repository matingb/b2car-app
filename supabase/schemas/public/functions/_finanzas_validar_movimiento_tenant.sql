CREATE OR REPLACE FUNCTION public._finanzas_validar_movimiento_tenant()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE v_cuenta_tenant uuid;
BEGIN
  SELECT c.tenant_id INTO v_cuenta_tenant FROM public.cuentas_financieras AS c WHERE c.id = NEW.cuenta_financiera_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta financiera % no existe', NEW.cuenta_financiera_id USING ERRCODE = 'P0002'; END IF;
  IF v_cuenta_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Cuenta financiera no pertenece al tenant' USING ERRCODE = '28000';
  END IF;
  RETURN NEW;
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."_finanzas_validar_movimiento_tenant"() TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_validar_movimiento_tenant"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_finanzas_validar_movimiento_tenant"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_finanzas_validar_movimiento_tenant"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_validar_movimiento_tenant"() TO "postgres";
