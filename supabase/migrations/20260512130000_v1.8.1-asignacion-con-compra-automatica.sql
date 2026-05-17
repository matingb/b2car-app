-- v1.8.3 - Asignación de repuesto existente con compra automática del faltante.
-- Si la cantidad pedida supera el stock disponible, crea primero una operación
-- de COMPRA por el faltante y luego asigna al arreglo. Todo atómico.

CREATE OR REPLACE FUNCTION public.rpc_asignar_repuesto_existente_con_compra(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_stock_id uuid,
  p_cantidad int,
  p_monto_unitario numeric(12,2),
  p_precio_compra numeric(12,2) DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_stock_cantidad int;
  v_old_cantidad int;
  v_delta_diff int;
  v_faltante int;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario inválido'; END IF;

  -- Valida que el arreglo pertenezca al tenant + taller indicados (y lockea).
  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);

  SELECT s.cantidad
  INTO v_stock_cantidad
  FROM public.stocks s
  WHERE s.id = p_stock_id
    AND s.tenant_id = v_tenant_id
    AND s.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id;
  END IF;

  -- Cantidad ya asignada por este arreglo a este stock (si es edición).
  SELECT abs(l.delta_cantidad)
  INTO v_old_cantidad
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
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

    PERFORM public.rpc_crear_operacion_con_stock(
      p_tipo := 'COMPRA'::public.tipo_operacion,
      p_taller_id := p_taller_id,
      p_lineas := jsonb_build_array(jsonb_build_object(
        'stock_id', p_stock_id,
        'cantidad', v_faltante,
        'monto_unitario', p_precio_compra
      )),
      p_arreglo_id := NULL
    );
  END IF;

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := p_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_monto_unitario
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric) TO authenticated;

-- v1.8.4 - Usa compra automatica de faltante tambien al crear un arreglo completo.
-- El modal de creacion envia precio_compra en p_repuestos cuando el stock existente
-- no alcanza. Esta helper delega en el mismo RPC atomico usado por el detalle.

CREATE OR REPLACE FUNCTION public._asignar_repuestos_existentes_a_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_repuestos jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos IS NULL OR jsonb_array_length(p_repuestos) = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos)
  LOOP
    PERFORM public.rpc_asignar_repuesto_existente_con_compra(
      p_arreglo_id := p_arreglo_id,
      p_taller_id := p_taller_id,
      p_stock_id := (v_item ->> 'stock_id')::uuid,
      p_cantidad := (v_item ->> 'cantidad')::int,
      p_monto_unitario := (v_item ->> 'monto_unitario')::numeric,
      p_precio_compra := NULLIF(v_item ->> 'precio_compra', '')::numeric
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public._asignar_repuestos_existentes_a_arreglo(uuid, uuid, jsonb) TO authenticated;

