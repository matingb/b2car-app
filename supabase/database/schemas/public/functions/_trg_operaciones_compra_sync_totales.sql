CREATE FUNCTION public._trg_operaciones_compra_sync_totales()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.precios_incluyen_iva IS DISTINCT FROM OLD.precios_incluyen_iva THEN
    PERFORM public.recalcular_totales_operacion(NEW.operacion_id);
  END IF;
  RETURN NEW;
END;
$function$;
