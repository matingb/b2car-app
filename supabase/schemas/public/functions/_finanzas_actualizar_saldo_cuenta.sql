CREATE OR REPLACE FUNCTION public._finanzas_actualizar_saldo_cuenta()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cuentas_financieras SET saldo = saldo + NEW.importe WHERE id = NEW.cuenta_financiera_id;
  END IF;
  RETURN NULL;
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."_finanzas_actualizar_saldo_cuenta"() TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_actualizar_saldo_cuenta"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_finanzas_actualizar_saldo_cuenta"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_finanzas_actualizar_saldo_cuenta"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_actualizar_saldo_cuenta"() TO "postgres";
