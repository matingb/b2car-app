CREATE OR REPLACE FUNCTION public._omc_after_delete()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF OLD.subtipo IN ('GASTO', 'INGRESO', 'APERTURA_CUENTA') THEN
    PERFORM public._ledger_insertar(NULL, OLD.tenant_id, OLD.cuenta_id, -OLD.importe, now());
  ELSIF OLD.subtipo = 'TRANSFERENCIA' THEN
    PERFORM public._ledger_insertar(NULL, OLD.tenant_id, OLD.cuenta_origen_id,  OLD.importe, now());
    PERFORM public._ledger_insertar(NULL, OLD.tenant_id, OLD.cuenta_destino_id, -OLD.importe, now());
  END IF;
  RETURN NULL;
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."_omc_after_delete"() TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_omc_after_delete"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_omc_after_delete"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_omc_after_delete"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_omc_after_delete"() TO "postgres";
