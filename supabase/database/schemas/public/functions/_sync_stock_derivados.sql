CREATE FUNCTION public._sync_stock_derivados (
  p_stock_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_reservada int;
  v_pendiente int;
  v_cant_actual int;
BEGIN
  IF p_stock_id IS NULL THEN RETURN; END IF;

  -- Serializar antes de leer las reservas de otras transacciones.
  SELECT s.cantidad INTO v_cant_actual FROM public.stocks s WHERE s.id = p_stock_id FOR UPDATE;

  -- Reservada: ventas abiertas
  SELECT COALESCE(SUM(l.cantidad - l.cantidad_cumplida - l.cantidad_cancelada), 0)
  INTO v_reservada
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  WHERE l.stock_id = p_stock_id
    AND o.tipo = 'VENTA'
    AND (l.cantidad - l.cantidad_cumplida - l.cantidad_cancelada) > 0;

  -- Pendiente: compras abiertas
  SELECT COALESCE(SUM(l.cantidad - l.cantidad_cumplida - l.cantidad_cancelada), 0)
  INTO v_pendiente
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  WHERE l.stock_id = p_stock_id
    AND o.tipo = 'COMPRA'
    AND (l.cantidad - l.cantidad_cumplida - l.cantidad_cancelada) > 0;


  IF (v_cant_actual - v_reservada) < 0 THEN
    RAISE EXCEPTION 'STOCK_INSUFICIENTE' USING ERRCODE = '55002';
  END IF;

  PERFORM set_config('app.stock_derivados_write', 'on', true);
  UPDATE public.stocks
  SET cantidad_reservada = v_reservada,
      cantidad_pendiente = v_pendiente,
      updated_at = now()
  WHERE id = p_stock_id
    AND (cantidad_reservada IS DISTINCT FROM v_reservada OR cantidad_pendiente IS DISTINCT FROM v_pendiente);
END;
$function$;

REVOKE ALL ON FUNCTION public._sync_stock_derivados(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public._sync_stock_derivados(uuid) TO service_role;