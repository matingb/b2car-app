CREATE FUNCTION public._oms_after_insert()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_op record;
  v_stock record;
  v_tipo_mov text;
  v_motivo_ajuste text;
BEGIN
  SELECT o.id, o.tipo, o.taller_id, o.tenant_id
  INTO v_op
  FROM public.operaciones o
  WHERE o.id = NEW.operacion_id;

  SELECT s.id, s.taller_id, s.producto_id
  INTO v_stock
  FROM public.stocks s
  WHERE s.id = NEW.stock_id;

  IF v_op.tipo = 'COMPRA' THEN
    v_tipo_mov := 'COMPRA';
  ELSIF v_op.tipo = 'VENTA' THEN
    v_tipo_mov := 'VENTA';
  ELSIF v_op.tipo = 'ASIGNACION_ARREGLO' THEN
    v_tipo_mov := 'ASIGNACION_ARREGLO';
  ELSIF v_op.tipo = 'AJUSTE' THEN
    SELECT motivo INTO v_motivo_ajuste
    FROM public.operaciones_ajuste
    WHERE operacion_id = NEW.operacion_id;

    IF v_motivo_ajuste = 'INICIAL' THEN
      v_tipo_mov := 'INICIAL';
    ELSIF v_motivo_ajuste = 'DEVOLUCION_NC' THEN
      v_tipo_mov := 'DEVOLUCION_NC';
    ELSE
      v_tipo_mov := 'AJUSTE';
    END IF;
  ELSE
    v_tipo_mov := 'AJUSTE';
  END IF;

  INSERT INTO public.movimientos_stock (
    tenant_id,
    taller_id,
    producto_id,
    stock_id,
    operacion_id,
    oms_id,
    tipo_movimiento,
    cantidad,
    saldo_anterior,
    saldo_posterior,
    fecha,
    motivo,
    created_by
  ) VALUES (
    NEW.tenant_id,
    COALESCE(v_op.taller_id, v_stock.taller_id),
    v_stock.producto_id,
    NEW.stock_id,
    NEW.operacion_id,
    NEW.id,
    v_tipo_mov,
    NEW.cantidad,
    0,
    0,
    NEW.fecha,
    NEW.motivo,
    NEW.created_by
  );

  UPDATE public.operaciones_lineas
  SET cantidad_cumplida = (
    SELECT COALESCE(SUM(l.sentido * oms.cantidad), 0)
    FROM public.operaciones_movimiento_stock oms
    JOIN public.operaciones_lineas l ON l.id = oms.operacion_linea_id
    WHERE oms.operacion_linea_id = NEW.operacion_linea_id
  )
  WHERE id = NEW.operacion_linea_id;

  PERFORM public._sync_operacion_estado_stock(NEW.operacion_id);
  PERFORM public._sync_stock_derivados(NEW.stock_id);

  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public._oms_after_insert() TO anon;

GRANT ALL ON FUNCTION public._oms_after_insert() TO authenticated;

GRANT ALL ON FUNCTION public._oms_after_insert() TO service_role;