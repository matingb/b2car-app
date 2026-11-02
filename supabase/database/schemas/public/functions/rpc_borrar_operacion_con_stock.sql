CREATE FUNCTION public.rpc_borrar_operacion_con_stock (
  p_operacion_id uuid,
  p_unused       uuid DEFAULT NULL::uuid
)
  RETURNS boolean
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

  SELECT id, tipo, taller_id
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

  -- Al borrar la operación:
  -- - La cascada borra hijas, líneas, OMS y OMC.
  -- - Los triggers de OMS generan reversas en kardex y recalculan stock.
  -- - Los triggers de OMC generan contraasientos en el ledger financiero.
  DELETE FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) TO service_role;