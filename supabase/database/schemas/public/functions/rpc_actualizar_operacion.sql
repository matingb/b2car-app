CREATE FUNCTION public.rpc_actualizar_operacion (
  p_operacion_id  uuid,
  p_fecha         timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_observaciones text                     DEFAULT NULL::text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op        record;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT id, tipo, fecha, observaciones
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF public.facturacion_operacion_autorizada(p_operacion_id) THEN
    RAISE EXCEPTION 'No se puede modificar una venta con comprobante fiscal autorizado';
  END IF;

  UPDATE public.operaciones
  SET fecha = COALESCE(p_fecha, fecha),
      observaciones = CASE WHEN p_observaciones IS NOT NULL THEN p_observaciones ELSE observaciones END
  WHERE id = p_operacion_id;

  -- En los tipos instantáneos actualiza también la fecha de sus OMC
  IF p_fecha IS NOT NULL AND v_op.tipo IN ('TRANSFERENCIA', 'INGRESO', 'APERTURA_CUENTA', 'COBRO_ARREGLO') THEN
    UPDATE public.operaciones_movimiento_cuenta
    SET fecha = p_fecha
    WHERE operacion_id = p_operacion_id;
  END IF;

  RETURN jsonb_build_object(
    'id', p_operacion_id,
    'fecha', COALESCE(p_fecha, v_op.fecha),
    'observaciones', CASE WHEN p_observaciones IS NOT NULL THEN p_observaciones ELSE v_op.observaciones END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_actualizar_operacion(uuid, timestamp WITH time zone, text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_actualizar_operacion(uuid, timestamp WITH time zone, text) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_actualizar_operacion(uuid, timestamp WITH time zone, text) TO service_role;