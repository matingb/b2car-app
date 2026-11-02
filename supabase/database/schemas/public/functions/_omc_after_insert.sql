CREATE FUNCTION public._omc_after_insert()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  PERFORM public._ledger_insertar(
    NEW.operacion_id,
    NEW.tenant_id,
    NEW.cuenta_id,
    NEW.importe,
    NEW.fecha,
    NEW.id,
    NULL
  );
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public._omc_after_insert() FROM PUBLIC;