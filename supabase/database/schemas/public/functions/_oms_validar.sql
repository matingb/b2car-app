CREATE FUNCTION public._oms_validar()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_linea record;
  v_op record;
BEGIN
  SELECT l.id, l.operacion_id, l.stock_id, l.sentido, l.cantidad, l.cantidad_cumplida, l.cantidad_cancelada
  INTO v_linea
  FROM public.operaciones_lineas l
  WHERE l.id = NEW.operacion_linea_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Línea de operación no encontrada: %', NEW.operacion_linea_id USING ERRCODE = '22023';
  END IF;

  IF v_linea.operacion_id <> NEW.operacion_id OR v_linea.stock_id <> NEW.stock_id THEN
    RAISE EXCEPTION 'Línea de operación no coincide con operacion_id o stock_id' USING ERRCODE = '22023';
  END IF;

  SELECT o.id, o.tenant_id, o.fecha, o.tipo, o.taller_id
  INTO v_op
  FROM public.operaciones o
  WHERE o.id = NEW.operacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', NEW.operacion_id USING ERRCODE = '22023';
  END IF;

  IF v_op.tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'tenant_id no coincide con el de la operación' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stocks s WHERE s.id = NEW.stock_id
    AND s.tenant_id = v_op.tenant_id AND (v_op.taller_id IS NULL OR s.taller_id = v_op.taller_id)) THEN
    RAISE EXCEPTION 'Stock ajeno al tenant o taller de la operación' USING ERRCODE = '22023';
  END IF;

  NEW.fecha := COALESCE(NEW.fecha, v_op.fecha, now());

  IF (v_linea.sentido * NEW.cantidad) <= 0 THEN
    RAISE EXCEPTION 'El impacto de stock debe tener el mismo signo que el sentido de la línea' USING ERRCODE = '22023';
  END IF;

  IF (v_linea.cantidad_cumplida + (v_linea.sentido * NEW.cantidad)) > (v_linea.cantidad - v_linea.cantidad_cancelada) THEN
    RAISE EXCEPTION 'El impacto de stock excede la cantidad pendiente de la línea' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public._oms_validar() TO anon;

GRANT ALL ON FUNCTION public._oms_validar() TO authenticated;

GRANT ALL ON FUNCTION public._oms_validar() TO service_role;