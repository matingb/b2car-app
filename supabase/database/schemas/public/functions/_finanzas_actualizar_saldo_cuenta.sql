CREATE FUNCTION public._finanzas_actualizar_saldo_cuenta()
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

REVOKE ALL ON FUNCTION public._finanzas_actualizar_saldo_cuenta() FROM PUBLIC;