CREATE FUNCTION public.rpc_revertir_movimiento_stock_operacion (
  p_operacion_id  uuid,
  p_movimiento_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op        record;
  v_mov       record;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_operacion_id IS NULL OR p_movimiento_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos' USING ERRCODE = '22023';
  END IF;

  SELECT id, tipo, taller_id, estado_stock
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_op.tipo NOT IN ('COMPRA', 'VENTA') THEN
    RAISE EXCEPTION 'Solo se pueden revertir movimientos de stock en compras o ventas' USING ERRCODE = '22023';
  END IF;

  SELECT id, tipo_movimiento, cantidad, stock_id, reversion_de_id, oms_id
  INTO v_mov
  FROM public.movimientos_stock
  WHERE id = p_movimiento_id AND operacion_id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento de stock no encontrado: %', p_movimiento_id USING ERRCODE = 'P0002';
  END IF;

  IF v_mov.reversion_de_id IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede revertir una reversión' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.movimientos_stock
    WHERE reversion_de_id = p_movimiento_id
  ) THEN
    RAISE EXCEPTION 'Este movimiento ya fue revertido' USING ERRCODE = '22023';
  END IF;

  IF v_mov.oms_id IS NULL THEN
    RAISE EXCEPTION 'No se puede revertir un movimiento histórico previo al rediseño' USING ERRCODE = '22023';
  END IF;

  -- Borra la OMS: el trigger _oms_after_delete registra la reversión en kardex y recalcula stock y estado
  DELETE FROM public.operaciones_movimiento_stock
  WHERE id = v_mov.oms_id;

  SELECT estado_stock INTO v_op.estado_stock FROM public.operaciones WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'estado_stock', v_op.estado_stock
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_revertir_movimiento_stock_operacion(uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_revertir_movimiento_stock_operacion(uuid, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_revertir_movimiento_stock_operacion(uuid, uuid) TO service_role;