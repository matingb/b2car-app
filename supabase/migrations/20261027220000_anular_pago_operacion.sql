-- Migration: 20261027220000_anular_pago_operacion.sql
-- Permite anular pagos individuales de operaciones (compras o ventas) con reversión contable automática

CREATE OR REPLACE FUNCTION public.rpc_finanzas_anular_pago_operacion (
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
  v_pago             record;
  v_cleanup_previo   text := current_setting('app.finanzas_tenant_cleanup', true);
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_operacion_id IS NULL OR p_pago_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos' USING ERRCODE = '22023';
  END IF;

  -- Bloquear operación para actualización y verificar pertenencia al tenant
  SELECT id, tipo, monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- Buscar el pago vinculado (puede pasarse el id de operaciones_pagos o el operacion_pago_id)
  SELECT id, operacion_pago_id, cuenta_financiera_id, monto
  INTO v_pago
  FROM public.operaciones_pagos
  WHERE operacion_id = p_operacion_id
    AND tenant_id = v_tenant_id
    AND (id = p_pago_id OR operacion_pago_id = p_pago_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado para esta operación' USING ERRCODE = 'P0002';
  END IF;

  -- Si el pago tiene un movimiento de cuenta asociado en operaciones, eliminarlo.
  -- La eliminación del movimiento dispara _omc_after_delete y el cascade de operaciones_pagos
  IF v_pago.operacion_pago_id IS NOT NULL THEN
    PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);
    DELETE FROM public.operaciones
    WHERE id = v_pago.operacion_pago_id
      AND tenant_id = v_tenant_id
      AND tipo = 'MOVIMIENTO_CUENTA';
    PERFORM set_config(
      'app.finanzas_tenant_cleanup',
      COALESCE(NULLIF(v_cleanup_previo, ''), 'off'),
      true
    );
  ELSIF v_pago.cuenta_financiera_id IS NOT NULL THEN
    -- Pago inicial registrado al crear la operación: revertir directamente en el ledger
    IF v_op.tipo = 'VENTA' THEN
      PERFORM public._ledger_insertar(NULL, v_tenant_id, v_pago.cuenta_financiera_id, -v_pago.monto, now());
    ELSIF v_op.tipo = 'COMPRA' THEN
      PERFORM public._ledger_insertar(NULL, v_tenant_id, v_pago.cuenta_financiera_id, v_pago.monto, now());
    END IF;
  END IF;

  -- Asegurarse de eliminar de operaciones_pagos si no cascada automáticamente
  DELETE FROM public.operaciones_pagos
  WHERE id = v_pago.id
    AND tenant_id = v_tenant_id;

  -- Consultar valores actualizados post-triggers
  SELECT monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'anulada_pago_id', v_pago.id,
    'importe_anulado', v_pago.monto,
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_finanzas_anular_pago_operacion(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_finanzas_anular_pago_operacion(uuid, uuid) FROM PUBLIC;
