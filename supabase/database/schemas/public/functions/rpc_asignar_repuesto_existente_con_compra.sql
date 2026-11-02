CREATE FUNCTION public.rpc_asignar_repuesto_existente_con_compra (
  p_arreglo_id           uuid,
  p_taller_id            uuid,
  p_stock_id             uuid,
  p_cantidad             integer,
  p_monto_unitario       numeric,
  p_precio_compra        numeric DEFAULT NULL::numeric,
  p_categoria_arreglo_id uuid    DEFAULT NULL::uuid,
  p_empleado_id          uuid    DEFAULT NULL::uuid,
  p_cuenta_id            uuid    DEFAULT NULL::uuid,
  p_idempotency_key      uuid    DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo_fecha timestamptz;
  v_stock_cantidad integer;
  v_old_cantidad integer;
  v_delta_diff integer;
  v_faltante integer;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('arreglos:edit') THEN
    RAISE EXCEPTION 'permiso arreglos:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad invalida' USING ERRCODE = '22023'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario invalido' USING ERRCODE = '22023'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id;

  IF v_arreglo_fecha IS NULL THEN
    RAISE EXCEPTION 'arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002';
  END IF;

  SELECT s.cantidad INTO v_stock_cantidad
  FROM public.stocks AS s
  WHERE s.id = p_stock_id AND s.tenant_id = v_tenant_id AND s.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id USING ERRCODE = 'P0002';
  END IF;

  SELECT l.cantidad INTO v_old_cantidad
  FROM public.operaciones_lineas AS l
  JOIN public.operaciones_asignacion_arreglo AS oa ON oa.operacion_id = l.operacion_id
  WHERE oa.arreglo_id = p_arreglo_id AND l.stock_id = p_stock_id;

  v_delta_diff := p_cantidad - COALESCE(v_old_cantidad, 0);

  IF v_delta_diff > 0 THEN
    v_faltante := v_delta_diff - v_stock_cantidad;
    IF v_faltante > 0 THEN
      IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('arreglos:repuestos:comprar') THEN
        RAISE EXCEPTION 'permiso arreglos:repuestos:comprar requerido' USING ERRCODE = '42501';
      END IF;
      IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN
        RAISE EXCEPTION 'PRECIO_COMPRA_REQUERIDO faltante=%', v_faltante USING ERRCODE = 'P0001';
      END IF;

      PERFORM public._crear_operacion_con_stock(
        p_tipo := 'COMPRA'::public.tipo_operacion,
        p_taller_id := p_taller_id,
        p_lineas := jsonb_build_array(jsonb_build_object(
          'stock_id', p_stock_id,
          'cantidad', v_faltante,
          'monto_unitario', p_precio_compra
        )),
        p_arreglo_id := NULL::uuid,
        p_fecha := v_arreglo_fecha,
        p_cuenta_id := p_cuenta_id,
        p_idempotency_key := p_idempotency_key
      );
    END IF;
  END IF;

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := p_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_monto_unitario,
    p_categoria_arreglo_id := p_categoria_arreglo_id,
    p_empleado_id := p_empleado_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, uuid, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, uuid, uuid) TO service_role;