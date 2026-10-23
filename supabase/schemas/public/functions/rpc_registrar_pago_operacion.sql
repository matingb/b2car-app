CREATE OR REPLACE FUNCTION public.rpc_registrar_pago_operacion (
  p_operacion_id       uuid,
  p_cuenta_id          uuid,
  p_monto              numeric,
  p_fecha              timestamp with time zone DEFAULT now(),
  p_descripcion        text                     DEFAULT NULL::text,
  p_idempotency_key    uuid                     DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id          uuid := public.current_tenant_id();
  v_op                 record;
  v_pago_existente     record;
  v_saldo_pendiente    numeric;
  v_pago_operacion_id  uuid;
  v_monto_pago         numeric;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificar una cuenta financiera' USING ERRCODE = '22023';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a 0' USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

  -- Idempotencia
  IF p_idempotency_key IS NOT NULL THEN
    SELECT op.id, op.operacion_id, op.monto
    INTO v_pago_existente
    FROM public.operaciones_pagos op
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = op.operacion_pago_id
    WHERE op.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;

    IF v_pago_existente.id IS NOT NULL THEN
      SELECT monto_total, total_pagado, esta_pago, estado_pago
      INTO v_op FROM public.operaciones WHERE id = p_operacion_id;

      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'total_pagado', v_op.total_pagado,
        'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
        'esta_pago', v_op.esta_pago,
        'estado_pago', v_op.estado_pago
      );
    END IF;
  END IF;

  SELECT id, tipo, monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  v_saldo_pendiente := GREATEST(0, COALESCE(v_op.monto_total, 0) - COALESCE(v_op.total_pagado, 0));
  IF v_saldo_pendiente <= 0 THEN
    RAISE EXCEPTION 'Esta operación ya se encuentra totalmente saldada' USING ERRCODE = '22023';
  END IF;

  IF p_monto > v_saldo_pendiente THEN
    RAISE EXCEPTION 'El monto ingresado ($%) supera el saldo pendiente ($%)', p_monto, v_saldo_pendiente
      USING ERRCODE = '22023';
  END IF;

  v_monto_pago := p_monto;

  -- Crear operación de movimiento financiero de cuenta
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha, now()))
  RETURNING id INTO v_pago_operacion_id;

  INSERT INTO public.operaciones_movimiento_cuenta (
    operacion_id, tenant_id, subtipo, cuenta_id, importe,
    descripcion, idempotency_key, created_by
  )
  VALUES (
    v_pago_operacion_id,
    v_tenant_id,
    CASE WHEN v_op.tipo = 'VENTA' THEN 'INGRESO' ELSE 'GASTO' END,
    p_cuenta_id,
    CASE WHEN v_op.tipo = 'VENTA' THEN v_monto_pago ELSE -v_monto_pago END,
    COALESCE(
      NULLIF(btrim(p_descripcion), ''),
      CASE
        WHEN v_op.tipo = 'VENTA' THEN 'Cobro de venta diferida'
        WHEN v_op.tipo = 'COMPRA' THEN 'Pago de compra diferida'
        ELSE 'Pago de operación'
      END
    ),
    p_idempotency_key,
    auth.uid()
  );

  -- Vincular en operaciones_pagos (el trigger recalcula total_pagado, esta_pago y estado_pago)
  INSERT INTO public.operaciones_pagos (
    tenant_id,
    operacion_id,
    operacion_pago_id,
    cuenta_financiera_id,
    monto,
    fecha,
    descripcion,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_operacion_id,
    v_pago_operacion_id,
    p_cuenta_id,
    v_monto_pago,
    COALESCE(p_fecha, now()),
    NULLIF(btrim(p_descripcion), ''),
    auth.uid()
  );

  -- Leer estado resultante actualizado
  SELECT monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'pago_operacion_id', v_pago_operacion_id,
    'monto_registrado', v_monto_pago,
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_registrar_pago_operacion(uuid, uuid, numeric, timestamp with time zone, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_pago_operacion(uuid, uuid, numeric, timestamp with time zone, text, uuid) TO authenticated, service_role;
