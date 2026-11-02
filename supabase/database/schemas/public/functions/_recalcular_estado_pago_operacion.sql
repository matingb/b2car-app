CREATE FUNCTION public._recalcular_estado_pago_operacion()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF COALESCE(NEW.monto_total, 0) <= 0 THEN
    NEW.esta_pago := true;
    NEW.estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSIF COALESCE(NEW.total_pagado, 0) >= NEW.monto_total THEN
    NEW.esta_pago := true;
    NEW.estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSIF COALESCE(NEW.total_pagado, 0) > 0 THEN
    NEW.esta_pago := false;
    NEW.estado_pago := 'PARCIAL'::public.estado_pago_operacion;
  ELSE
    NEW.esta_pago := false;
    NEW.estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
  END IF;
  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public._recalcular_estado_pago_operacion() TO anon;

GRANT ALL ON FUNCTION public._recalcular_estado_pago_operacion() TO authenticated;

GRANT ALL ON FUNCTION public._recalcular_estado_pago_operacion() TO service_role;