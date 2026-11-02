CREATE FUNCTION public.rpc_registrar_pago_operacion (
  p_operacion_id    uuid,
  p_cuenta_id       uuid,
  p_monto           numeric,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_descripcion     text                     DEFAULT NULL::text,
  p_idempotency_key uuid                     DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id          uuid := public.current_tenant_id();
  v_op                 record;
  v_pago_existente     uuid;
  v_saldo_pendiente    numeric;
  v_pago_id            uuid;
  v_importe_signado    numeric;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

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

  -- Idempotencia en OMC
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':pago:' || p_idempotency_key::text));

    SELECT omc.id
    INTO v_pago_existente
    FROM public.operaciones_movimiento_cuenta AS omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;

    IF v_pago_existente IS NOT NULL THEN
      SELECT monto_total, total_pagado, esta_pago, estado_pago
      INTO v_op FROM public.operaciones WHERE id = p_operacion_id AND tenant_id = v_tenant_id;

      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'operacion_id', p_operacion_id,
        'pago_id', v_pago_existente,
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

  IF v_op.tipo NOT IN ('VENTA'::public.tipo_operacion, 'COMPRA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'La operación de tipo % no admite pagos', v_op.tipo USING ERRCODE = '22023';
  END IF;

  v_saldo_pendiente := GREATEST(0, COALESCE(v_op.monto_total, 0) - COALESCE(v_op.total_pagado, 0));
  IF v_saldo_pendiente <= 0 THEN
    RAISE EXCEPTION 'Esta operación ya se encuentra totalmente saldada' USING ERRCODE = '22023';
  END IF;

  IF p_monto > v_saldo_pendiente THEN
    RAISE EXCEPTION 'El monto ingresado ($%) supera el saldo pendiente ($%)', p_monto, v_saldo_pendiente
      USING ERRCODE = '22023';
  END IF;

  v_importe_signado := CASE WHEN v_op.tipo = 'VENTA'::public.tipo_operacion THEN p_monto ELSE -p_monto END;

  -- Insertar OMC (el trigger genera el asiento en el ledger y recalcula total_pagado)
  INSERT INTO public.operaciones_movimiento_cuenta (
    tenant_id,
    operacion_id,
    cuenta_id,
    importe,
    fecha,
    descripcion,
    idempotency_key,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_operacion_id,
    p_cuenta_id,
    v_importe_signado,
    COALESCE(p_fecha, now()),
    COALESCE(
      NULLIF(btrim(p_descripcion), ''),
      CASE
        WHEN v_op.tipo = 'VENTA'::public.tipo_operacion THEN 'Cobro de venta'
        WHEN v_op.tipo = 'COMPRA'::public.tipo_operacion THEN 'Pago de compra'
        ELSE 'Pago de gasto'
      END
    ),
    p_idempotency_key,
    auth.uid()
  )
  RETURNING id INTO v_pago_id;

  -- Leer estado resultante actualizado
  SELECT monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'pago_id', v_pago_id,
    'monto_registrado', p_monto,
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_registrar_pago_operacion(uuid, uuid, numeric, timestamp WITH time zone, text, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_registrar_pago_operacion(uuid, uuid, numeric, timestamp WITH time zone, text, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_registrar_pago_operacion(uuid, uuid, numeric, timestamp WITH time zone, text, uuid) TO service_role;