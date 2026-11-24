CREATE FUNCTION public._trg_detalle_form_custom_calcular_totales()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.descuento := round(COALESCE(NEW.descuento, 0.00), 2);
  IF NEW.descuento < 0 THEN
    RAISE EXCEPTION 'El descuento no puede ser negativo' USING ERRCODE = '22023';
  END IF;
  NEW.subtotal := round(COALESCE(NEW.costo, 0), 2);
  IF NEW.descuento > NEW.subtotal THEN
    RAISE EXCEPTION 'El descuento (%) no puede superar el subtotal (%)', NEW.descuento, NEW.subtotal USING ERRCODE = '22023';
  END IF;
  NEW.total := NEW.subtotal - NEW.descuento;
  RETURN NEW;
END;
$function$;
