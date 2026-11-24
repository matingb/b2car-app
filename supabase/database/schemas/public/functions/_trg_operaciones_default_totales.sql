CREATE FUNCTION public._trg_operaciones_default_totales()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo NOT IN ('VENTA', 'COMPRA', 'ASIGNACION_ARREGLO', 'AJUSTE') THEN
    NEW.descuento := 0.00;
    NEW.subtotal := COALESCE(NEW.monto_total, 0.00);
  ELSIF TG_OP = 'INSERT' AND NEW.subtotal = 0.00 AND NEW.descuento = 0.00 AND NEW.monto_total <> 0.00 THEN
    NEW.subtotal := NEW.monto_total;
  END IF;
  RETURN NEW;
END;
$function$;
