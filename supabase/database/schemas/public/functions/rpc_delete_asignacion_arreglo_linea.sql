CREATE FUNCTION public.rpc_delete_asignacion_arreglo_linea (
  p_operacion_linea_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion_id uuid;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('arreglos:edit') THEN
    RAISE EXCEPTION 'permiso arreglos:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_linea_id IS NULL THEN RAISE EXCEPTION 'operacion_linea_id requerido' USING ERRCODE = '22023'; END IF;

  SELECT l.operacion_id INTO v_operacion_id
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  WHERE l.id = p_operacion_linea_id
    AND o.tenant_id = v_tenant_id
    AND o.tipo = 'ASIGNACION_ARREGLO'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'línea no encontrada (%)', p_operacion_linea_id USING ERRCODE = 'P0002';
  END IF;

  -- Borrar la línea (la cascada borra OMS y el trigger _oms_after_delete revierte en kardex)
  DELETE FROM public.operaciones_lineas WHERE id = p_operacion_linea_id;

  -- Si la operación no tiene más líneas, se borra (cascada elimina el vínculo con el arreglo)
  IF NOT EXISTS (SELECT 1 FROM public.operaciones_lineas WHERE operacion_id = v_operacion_id) THEN
    DELETE FROM public.operaciones WHERE id = v_operacion_id;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_delete_asignacion_arreglo_linea(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_delete_asignacion_arreglo_linea(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_delete_asignacion_arreglo_linea(uuid) TO service_role;