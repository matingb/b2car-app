-- Migración: Permitir ventas sin stock físico (Regla 1)
-- Elimina el check que abortaba la transacción si (cantidad_actual - cantidad_reservada) < 0.
-- La protección física permanece en _stock_aplicar_movimiento (no se puede entregar lo que no hay).

CREATE OR REPLACE FUNCTION public._sync_stock_derivados(p_stock_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reservada int;
  v_pendiente int;
BEGIN
  IF p_stock_id IS NULL THEN RETURN; END IF;

  -- Serializar antes de leer las reservas de otras transacciones.
  PERFORM 1 FROM public.stocks WHERE id = p_stock_id FOR UPDATE;

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

  -- Permitir vender sin importar el stock: ya no se lanza STOCK_INSUFICIENTE por reserva.
  PERFORM set_config('app.stock_derivados_write', 'on', true);
  UPDATE public.stocks
  SET cantidad_reservada = v_reservada,
      cantidad_pendiente = v_pendiente,
      updated_at = now()
  WHERE id = p_stock_id
    AND (cantidad_reservada IS DISTINCT FROM v_reservada OR cantidad_pendiente IS DISTINCT FROM v_pendiente);
END;
$function$;

GRANT EXECUTE ON FUNCTION public._sync_stock_derivados(uuid) TO postgres, service_role;

