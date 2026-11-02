CREATE FUNCTION public._crear_apertura_cuenta (
  p_tenant_id  uuid,
  p_cuenta_id  uuid,
  p_saldo      numeric,
  p_fecha      timestamp with time zone,
  p_created_by uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_operacion_id uuid;
BEGIN
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, monto_total)
  VALUES (p_tenant_id, 'APERTURA_CUENTA'::public.tipo_operacion, NULL, COALESCE(p_fecha, now()), ABS(p_saldo))
  RETURNING id INTO v_operacion_id;

  INSERT INTO public.operaciones_apertura_cuenta (operacion_id, tenant_id, cuenta_id)
  VALUES (v_operacion_id, p_tenant_id, p_cuenta_id);

  INSERT INTO public.operaciones_movimiento_cuenta (
    operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, created_by
  )
  VALUES (
    v_operacion_id, p_tenant_id, p_cuenta_id, p_saldo, COALESCE(p_fecha, now()), 'Apertura de cuenta', p_created_by
  );

  RETURN v_operacion_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._crear_apertura_cuenta(uuid, uuid, numeric, timestamp WITH time zone, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public._crear_apertura_cuenta(uuid, uuid, numeric, timestamp WITH time zone, uuid) TO service_role;