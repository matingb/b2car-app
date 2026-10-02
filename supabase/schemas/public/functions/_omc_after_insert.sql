CREATE OR REPLACE FUNCTION public._omc_after_insert()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE v_fecha timestamptz;
BEGIN
  SELECT o.fecha INTO v_fecha FROM public.operaciones AS o WHERE o.id = NEW.operacion_id;
  IF NEW.subtipo IN ('GASTO', 'INGRESO', 'APERTURA_CUENTA') THEN
    PERFORM public._ledger_insertar(NEW.operacion_id, NEW.tenant_id, NEW.cuenta_id, NEW.importe, v_fecha);
  ELSIF NEW.subtipo = 'TRANSFERENCIA' THEN
    PERFORM public._ledger_insertar(NEW.operacion_id, NEW.tenant_id, NEW.cuenta_origen_id, -NEW.importe, v_fecha);
    PERFORM public._ledger_insertar(NEW.operacion_id, NEW.tenant_id, NEW.cuenta_destino_id,  NEW.importe, v_fecha);
  END IF;
  RETURN NULL;
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."_omc_after_insert"() TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_omc_after_insert"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_omc_after_insert"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_omc_after_insert"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_omc_after_insert"() TO "postgres";
