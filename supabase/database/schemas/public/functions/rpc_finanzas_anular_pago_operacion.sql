CREATE FUNCTION public.rpc_finanzas_anular_pago_operacion (
  p_operacion_id uuid,
  p_pago_id      uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id        uuid := public.current_tenant_id();
  v_op               record;
  v_omc              record;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_operacion_id IS NULL OR p_pago_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos' USING ERRCODE = '22023';
  END IF;

  SELECT id, tipo, monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_op.tipo NOT IN ('VENTA'::public.tipo_operacion, 'COMPRA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'La operación de tipo % no admite pagos', v_op.tipo USING ERRCODE = '22023';
  END IF;

  SELECT id, cuenta_id, importe
  INTO v_omc
  FROM public.operaciones_movimiento_cuenta
  WHERE operacion_id = p_operacion_id
    AND tenant_id = v_tenant_id
    AND id = p_pago_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado para esta operación' USING ERRCODE = 'P0002';
  END IF;

  -- Borrar la OMC: el trigger _omc_after_delete genera el contraasiento en el ledger y recalcula total_pagado
  DELETE FROM public.operaciones_movimiento_cuenta
  WHERE id = v_omc.id
    AND tenant_id = v_tenant_id;

  SELECT monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'anulada_pago_id', v_omc.id,
    'importe_anulado', ABS(v_omc.importe),
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_anular_pago_operacion(uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_finanzas_anular_pago_operacion(uuid, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_finanzas_anular_pago_operacion(uuid, uuid) TO service_role;