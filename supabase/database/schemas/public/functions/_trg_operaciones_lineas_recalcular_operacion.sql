CREATE FUNCTION public._trg_operaciones_lineas_recalcular_operacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_operacion_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_operacion_id := OLD.operacion_id;
  ELSE
    v_operacion_id := NEW.operacion_id;
  END IF;
  IF v_operacion_id IS NOT NULL THEN
    PERFORM public.recalcular_totales_operacion(v_operacion_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;
