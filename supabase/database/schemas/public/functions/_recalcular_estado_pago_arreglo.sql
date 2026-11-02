CREATE FUNCTION public._recalcular_estado_pago_arreglo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  NEW.esta_pago := COALESCE(NEW.precio_final, 0) > 0 AND COALESCE(NEW.total_cobrado, 0) >= COALESCE(NEW.precio_final, 0);
  RETURN NEW;
END; $function$;

REVOKE ALL ON FUNCTION public._recalcular_estado_pago_arreglo() FROM PUBLIC;