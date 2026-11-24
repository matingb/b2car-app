CREATE FUNCTION public.rpc_actualizar_descuentos_operacion (
  p_operacion_id uuid,
  p_lineas       jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op record;
  v_item jsonb;
  v_linea_id uuid;
  v_desc numeric;
  v_linea record;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF public.facturacion_operacion_autorizada(p_operacion_id) THEN
    RAISE EXCEPTION 'No se pueden modificar descuentos de una operacion facturada';
  END IF;

  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' THEN
    RAISE EXCEPTION 'p_lineas debe ser un array' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_linea_id := (v_item ->> 'id')::uuid;
    v_desc := (v_item ->> 'descuento')::numeric;

    IF v_linea_id IS NULL OR v_desc IS NULL OR v_desc < 0 THEN
      RAISE EXCEPTION 'linea_id y descuento válido requeridos' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_linea
    FROM public.operaciones_lineas
    WHERE id = v_linea_id AND operacion_id = p_operacion_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Línea % no pertenece a la operación', v_linea_id USING ERRCODE = 'P0002';
    END IF;

    IF v_desc > v_linea.subtotal THEN
      RAISE EXCEPTION 'El descuento no puede superar el subtotal de la línea' USING ERRCODE = '22023';
    END IF;

    UPDATE public.operaciones_lineas
    SET descuento = v_desc
    WHERE id = v_linea_id;
  END LOOP;

  -- Releer operación recalculada por los triggers
  SELECT * INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  IF COALESCE(v_op.total_pagado, 0) > 0 AND v_op.monto_total < v_op.total_pagado THEN
    RAISE EXCEPTION 'El nuevo total (%) no puede ser menor a lo ya pagado (%)', v_op.monto_total, v_op.total_pagado USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'id', v_op.id,
    'subtotal', v_op.subtotal,
    'descuento', v_op.descuento,
    'monto_total', v_op.monto_total,
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, COALESCE(v_op.monto_total, 0) - COALESCE(v_op.total_pagado, 0)),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_actualizar_descuentos_operacion(uuid, jsonb) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_actualizar_descuentos_operacion(uuid, jsonb) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_actualizar_descuentos_operacion(uuid, jsonb) TO service_role;
