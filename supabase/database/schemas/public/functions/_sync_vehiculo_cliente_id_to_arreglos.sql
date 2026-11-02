CREATE FUNCTION public._sync_vehiculo_cliente_id_to_arreglos()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
    UPDATE public.arreglos
    SET cliente_id = NEW.cliente_id
    WHERE vehiculo_id = NEW.id;
  END IF;
  RETURN NEW;
END; $function$;

REVOKE ALL ON FUNCTION public._sync_vehiculo_cliente_id_to_arreglos() FROM PUBLIC;