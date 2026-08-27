-- La API de repuestos pasa la cuenta y la llave de idempotencia cuando hay
-- faltante. La firma anterior no aceptaba esos argumentos y la compra fallaba
-- antes de actualizar la asignacion del arreglo.
DROP FUNCTION IF EXISTS public.rpc_asignar_repuesto_existente_con_compra(
  uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid
);

CREATE FUNCTION public.rpc_asignar_repuesto_existente_con_compra(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_stock_id uuid,
  p_cantidad integer,
  p_monto_unitario numeric,
  p_precio_compra numeric DEFAULT NULL,
  p_categoria_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_arreglo_fecha timestamptz;
  v_stock_cantidad integer;
  v_old_cantidad integer;
  v_delta_diff integer;
  v_faltante integer;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad invalida'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario invalido'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);

  SELECT a.fecha
  INTO v_arreglo_fecha
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
    AND a.taller_id = p_taller_id;

  SELECT s.cantidad
  INTO v_stock_cantidad
  FROM public.stocks AS s
  WHERE s.id = p_stock_id
    AND s.tenant_id = v_tenant_id
    AND s.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id; END IF;

  SELECT abs(l.delta_cantidad)
  INTO v_old_cantidad
  FROM public.operaciones_lineas AS l
  JOIN public.operaciones AS o ON o.id = l.operacion_id
  JOIN public.operaciones_asignacion_arreglo AS oa ON oa.operacion_id = o.id
  WHERE oa.arreglo_id = p_arreglo_id
    AND l.stock_id = p_stock_id
    AND o.tipo = 'ASIGNACION_ARREGLO'
    AND o.tenant_id = v_tenant_id;

  v_old_cantidad := coalesce(v_old_cantidad, 0);
  v_delta_diff := p_cantidad - v_old_cantidad;
  v_faltante := greatest(0, v_delta_diff - v_stock_cantidad);

  IF v_faltante > 0 THEN
    IF p_precio_compra IS NULL OR p_precio_compra <= 0 THEN
      RAISE EXCEPTION 'PRECIO_COMPRA_REQUERIDO faltante=%', v_faltante
        USING ERRCODE = 'P0001';
    END IF;
    IF p_cuenta_id IS NULL THEN
      RAISE EXCEPTION 'CUENTA_FINANCIERA_REQUERIDA' USING ERRCODE = 'P0001';
    END IF;
    IF p_idempotency_key IS NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUERIDA' USING ERRCODE = 'P0001';
    END IF;

    PERFORM public.rpc_crear_operacion_con_stock(
      p_tipo := 'COMPRA'::text,
      p_taller_id := p_taller_id,
      p_lineas := jsonb_build_array(jsonb_build_object(
        'stock_id', p_stock_id,
        'cantidad', v_faltante,
        'monto_unitario', p_precio_compra,
        'delta_cantidad', v_faltante
      )),
      p_arreglo_id := NULL::uuid,
      p_fecha := v_arreglo_fecha,
      p_cuenta_id := p_cuenta_id,
      p_idempotency_key := p_idempotency_key
    );
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
$$;

REVOKE ALL ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(
  uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, uuid, uuid
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(
  uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, uuid, uuid
) TO authenticated;

NOTIFY pgrst, 'reload schema';
