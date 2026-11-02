CREATE FUNCTION public.rpc_actualizar_movimiento_cuenta (
  p_operacion_id      uuid,
  p_importe           numeric                  DEFAULT NULL::numeric,
  p_descripcion       text                     DEFAULT NULL::text,
  p_categoria_gasto   text                     DEFAULT NULL::text,
  p_cuenta_id         uuid                     DEFAULT NULL::uuid,
  p_cuenta_origen_id  uuid                     DEFAULT NULL::uuid,
  p_cuenta_destino_id uuid                     DEFAULT NULL::uuid,
  p_fecha             timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_idempotency_key   uuid                     DEFAULT NULL::uuid,
  p_observaciones     text                     DEFAULT NULL::text,
  p_taller_id         uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op record;
  v_omc_count integer;
  v_omc_primaria record;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_id IS NULL THEN RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023'; END IF;

  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('finanzas:edit') THEN
    RAISE EXCEPTION 'permiso finanzas:edit requerido' USING ERRCODE = '42501';
  END IF;

  SELECT id, tipo, monto_total INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_op.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN
    RAISE EXCEPTION 'Un cobro de arreglo no puede modificarse como movimiento manual' USING ERRCODE = '22023';
  END IF;

  IF v_op.tipo NOT IN ('GASTO'::public.tipo_operacion, 'INGRESO'::public.tipo_operacion, 'TRANSFERENCIA'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'Tipo de operación % no admite actualización por esta RPC', v_op.tipo USING ERRCODE = '22023';
  END IF;

  IF p_importe IS NOT NULL AND p_importe <= 0 THEN
    RAISE EXCEPTION 'importe debe ser mayor a 0' USING ERRCODE = '22023';
  END IF;

  IF p_taller_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.talleres WHERE id = p_taller_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Taller no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Actualizar encabezado de la operación
  UPDATE public.operaciones
  SET fecha = COALESCE(p_fecha, fecha),
      observaciones = COALESCE(p_observaciones, observaciones),
      taller_id = COALESCE(p_taller_id, taller_id),
      monto_total = COALESCE(p_importe, monto_total)
  WHERE id = p_operacion_id;

  IF v_op.tipo = 'GASTO'::public.tipo_operacion THEN
    SELECT count(*) INTO v_omc_count
    FROM public.operaciones_movimiento_cuenta
    WHERE operacion_id = p_operacion_id;

    -- Si tiene pagos parciales o más de un pago, no se permite cambiar monto ni cuenta
    SELECT * INTO v_omc_primaria FROM public.operaciones_movimiento_cuenta
    WHERE operacion_id = p_operacion_id ORDER BY created_at, id LIMIT 1;
    IF v_omc_count > 1 OR (v_omc_count = 1 AND ABS(v_omc_primaria.importe) <> v_op.monto_total) THEN
      IF p_importe IS NOT NULL AND p_importe <> v_op.monto_total THEN
        RAISE EXCEPTION 'No se puede cambiar el monto de un gasto con pagos parciales o múltiples' USING ERRCODE = '22023';
      END IF;
      IF p_cuenta_id IS NOT NULL THEN
        RAISE EXCEPTION 'No se puede cambiar la cuenta de un gasto con pagos parciales o múltiples' USING ERRCODE = '22023';
      END IF;
    ELSE
      IF p_cuenta_id IS NOT NULL THEN
        PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
      END IF;
      UPDATE public.operaciones_movimiento_cuenta
      SET cuenta_id = COALESCE(p_cuenta_id, cuenta_id),
          importe = -COALESCE(p_importe, ABS(importe)),
          fecha = COALESCE(p_fecha, fecha),
          descripcion = COALESCE(p_descripcion, descripcion)
      WHERE operacion_id = p_operacion_id;
    END IF;

    UPDATE public.operaciones_gasto
    SET categoria_gasto = COALESCE(p_categoria_gasto, categoria_gasto),
        descripcion = COALESCE(p_descripcion, descripcion)
    WHERE operacion_id = p_operacion_id;

  ELSIF v_op.tipo = 'INGRESO'::public.tipo_operacion THEN
    IF p_cuenta_id IS NOT NULL THEN
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
    END IF;

    UPDATE public.operaciones_ingreso
    SET cuenta_id = COALESCE(p_cuenta_id, cuenta_id),
        concepto = COALESCE(p_descripcion, concepto)
    WHERE operacion_id = p_operacion_id;

    UPDATE public.operaciones_movimiento_cuenta
    SET cuenta_id = COALESCE(p_cuenta_id, cuenta_id),
        importe = COALESCE(p_importe, importe),
        fecha = COALESCE(p_fecha, fecha),
        descripcion = COALESCE(p_descripcion, descripcion)
    WHERE operacion_id = p_operacion_id;

  ELSIF v_op.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN
    IF p_cuenta_origen_id IS NOT NULL AND p_cuenta_destino_id IS NOT NULL AND p_cuenta_origen_id = p_cuenta_destino_id THEN
      RAISE EXCEPTION 'Las cuentas de origen y destino deben ser distintas' USING ERRCODE = '22023';
    END IF;

    IF p_cuenta_origen_id IS NOT NULL THEN
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_origen_id, v_tenant_id, true);
    END IF;
    IF p_cuenta_destino_id IS NOT NULL THEN
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_destino_id, v_tenant_id, true);
    END IF;

    UPDATE public.operaciones_transferencia
    SET cuenta_origen_id = COALESCE(p_cuenta_origen_id, cuenta_origen_id),
        cuenta_destino_id = COALESCE(p_cuenta_destino_id, cuenta_destino_id)
    WHERE operacion_id = p_operacion_id;

    -- Actualizar las 2 OMC
    UPDATE public.operaciones_movimiento_cuenta
    SET cuenta_id = COALESCE(p_cuenta_origen_id, cuenta_id),
        importe = -COALESCE(p_importe, ABS(importe)),
        fecha = COALESCE(p_fecha, fecha)
    WHERE operacion_id = p_operacion_id AND importe < 0;

    UPDATE public.operaciones_movimiento_cuenta
    SET cuenta_id = COALESCE(p_cuenta_destino_id, cuenta_id),
        importe = COALESCE(p_importe, ABS(importe)),
        fecha = COALESCE(p_fecha, fecha)
    WHERE operacion_id = p_operacion_id AND importe > 0;
  END IF;

  RETURN p_operacion_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, text, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, text, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, text, uuid) TO service_role;