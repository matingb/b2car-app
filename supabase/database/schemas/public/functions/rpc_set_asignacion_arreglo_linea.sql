CREATE FUNCTION public.rpc_set_asignacion_arreglo_linea (
  p_arreglo_id           uuid,
  p_taller_id            uuid,
  p_stock_id             uuid,
  p_cantidad             integer,
  p_monto_unitario       numeric DEFAULT 0,
  p_categoria_arreglo_id uuid    DEFAULT NULL::uuid,
  p_empleado_id          uuid    DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion_id uuid;
  v_arreglo_fecha timestamp with time zone;
  v_linea_id uuid;
  v_linea_cant integer;
  v_stock_taller_id uuid;
  v_diff integer;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('arreglos:edit') THEN
    RAISE EXCEPTION 'permiso arreglos:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida (%)', p_cantidad USING ERRCODE = '22023'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario inválido (%)', p_monto_unitario USING ERRCODE = '22023'; END IF;

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;

  SELECT s.taller_id INTO v_stock_taller_id
  FROM public.stocks s WHERE s.id = p_stock_id FOR UPDATE;

  IF v_stock_taller_id IS NULL THEN RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id USING ERRCODE = 'P0002'; END IF;
  IF v_stock_taller_id <> p_taller_id THEN RAISE EXCEPTION 'stock_id no pertenece al taller' USING ERRCODE = '22023'; END IF;

  -- Buscar o crear la operación de ASIGNACION_ARREGLO
  SELECT oa.operacion_id INTO v_operacion_id
  FROM public.operaciones_asignacion_arreglo oa
  WHERE oa.arreglo_id = p_arreglo_id LIMIT 1;

  IF v_operacion_id IS NULL THEN
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, monto_total)
    VALUES (v_tenant_id, 'ASIGNACION_ARREGLO', p_taller_id, COALESCE(v_arreglo_fecha, now()), 0)
    RETURNING id INTO v_operacion_id;

    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, tenant_id, arreglo_id)
    VALUES (v_operacion_id, v_tenant_id, p_arreglo_id);
  END IF;

  -- Buscar línea existente
  SELECT l.id, l.cantidad INTO v_linea_id, v_linea_cant
  FROM public.operaciones_lineas l
  WHERE l.operacion_id = v_operacion_id AND l.stock_id = p_stock_id
  FOR UPDATE;

  IF v_linea_id IS NULL THEN
    -- Alta de línea
    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, sentido,
      categoria_arreglo_id, empleado_id
    ) VALUES (
      v_operacion_id, p_stock_id, p_cantidad, p_monto_unitario, -1,
      p_categoria_arreglo_id, p_empleado_id
    ) RETURNING id INTO v_linea_id;

    INSERT INTO public.operaciones_movimiento_stock (
      tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
    ) VALUES (
      v_tenant_id, v_operacion_id, v_linea_id, p_stock_id,
      -p_cantidad, COALESCE(v_arreglo_fecha, now()), 'Asignación a arreglo'
    );
  ELSE
    -- Modificación de línea
    IF p_cantidad > v_linea_cant THEN
      v_diff := p_cantidad - v_linea_cant;
      UPDATE public.operaciones_lineas
      SET cantidad = p_cantidad,
          monto_unitario = p_monto_unitario,
          categoria_arreglo_id = p_categoria_arreglo_id,
          empleado_id = p_empleado_id
      WHERE id = v_linea_id;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant_id, v_operacion_id, v_linea_id, p_stock_id,
        -v_diff, COALESCE(v_arreglo_fecha, now()), 'Aumento de asignación a arreglo'
      );
    ELSIF p_cantidad < v_linea_cant THEN
      -- Al bajar la cantidad, primero la devolución (borrado/reemplazo de OMS) y después baja la cantidad
      DELETE FROM public.operaciones_movimiento_stock WHERE operacion_linea_id = v_linea_id;

      UPDATE public.operaciones_lineas
      SET cantidad = p_cantidad,
          monto_unitario = p_monto_unitario,
          categoria_arreglo_id = p_categoria_arreglo_id,
          empleado_id = p_empleado_id
      WHERE id = v_linea_id;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant_id, v_operacion_id, v_linea_id, p_stock_id,
        -p_cantidad, COALESCE(v_arreglo_fecha, now()), 'Reajuste de asignación a arreglo'
      );
    ELSE
      UPDATE public.operaciones_lineas
      SET monto_unitario = p_monto_unitario,
          categoria_arreglo_id = p_categoria_arreglo_id,
          empleado_id = p_empleado_id
      WHERE id = v_linea_id;
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, integer, numeric, uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, integer, numeric, uuid, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, integer, numeric, uuid, uuid) TO service_role;