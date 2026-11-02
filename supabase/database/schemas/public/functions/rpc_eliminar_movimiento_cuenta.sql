CREATE FUNCTION public.rpc_eliminar_movimiento_cuenta (
  p_operacion_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo      public.tipo_operacion;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_id IS NULL THEN RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023'; END IF;

  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('finanzas:edit') THEN
    RAISE EXCEPTION 'permiso finanzas:edit requerido' USING ERRCODE = '42501';
  END IF;

  SELECT tipo INTO v_tipo
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN
    RAISE EXCEPTION 'Un cobro de arreglo no puede eliminarse con esta RPC; use rpc_finanzas_anular_cobro_arreglo' USING ERRCODE = '22023';
  END IF;

  IF v_tipo NOT IN ('GASTO'::public.tipo_operacion, 'INGRESO'::public.tipo_operacion, 'TRANSFERENCIA'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'Tipo de operación % no admite eliminación por esta RPC', v_tipo USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_eliminar_movimiento_cuenta(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_eliminar_movimiento_cuenta(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_eliminar_movimiento_cuenta(uuid) TO service_role;