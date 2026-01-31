-- v1.5.0 - Repuestos por arreglo (0..1 operación) + RPCs con stock

-- Enforce: un arreglo puede tener 0..1 operación de asignación
-- Nota: esto fallará si hoy existen múltiples operaciones por arreglo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_operaciones_asignacion_arreglo_arreglo_id
ON public.operaciones_asignacion_arreglo (arreglo_id);

-- RPC: crea (si no existe) la operación ASIGNACION_ARREGLO para el arreglo
-- y hace upsert de UNA línea (producto) ajustando stock por delta.
CREATE OR REPLACE FUNCTION public.rpc_set_asignacion_arreglo_linea(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_producto_id uuid,
  p_cantidad int,
  p_monto_unitario numeric(12,2) DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_operacion_id uuid;
  v_taller_id uuid;

  v_linea_id uuid;
  v_old_delta int;
  v_new_delta int;
  v_delta_diff int;

  v_rowcount int;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_arreglo_id IS NULL THEN
    RAISE EXCEPTION 'arreglo_id requerido';
  END IF;
  IF p_taller_id IS NULL THEN
    RAISE EXCEPTION 'taller_id requerido';
  END IF;
  IF p_producto_id IS NULL THEN
    RAISE EXCEPTION 'producto_id requerido';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'cantidad inválida (%)', p_cantidad;
  END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN
    RAISE EXCEPTION 'monto_unitario inválido (%)', p_monto_unitario;
  END IF;

  -- buscar operación existente por arreglo (0..1)
  SELECT oa.operacion_id
  INTO v_operacion_id
  FROM public.operaciones_asignacion_arreglo oa
  WHERE oa.arreglo_id = p_arreglo_id
  LIMIT 1;

  IF v_operacion_id IS NULL THEN
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id)
    VALUES (v_tenant_id, 'ASIGNACION_ARREGLO', p_taller_id)
    RETURNING id INTO v_operacion_id;

    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);

    v_taller_id := p_taller_id;
  ELSE
    SELECT o.taller_id
    INTO v_taller_id
    FROM public.operaciones o
    WHERE o.id = v_operacion_id;

    IF v_taller_id IS NULL THEN
      RAISE EXCEPTION 'operación % no encontrada', v_operacion_id;
    END IF;

    IF v_taller_id <> p_taller_id THEN
      RAISE EXCEPTION 'taller_id no coincide (operación %, esperado %, recibido %)', v_operacion_id, v_taller_id, p_taller_id;
    END IF;
  END IF;

  -- lock stock row (si existe)
  PERFORM 1
  FROM public.stocks s
  WHERE s.taller_id = v_taller_id
    AND s.producto_id = p_producto_id
  FOR UPDATE;

  -- obtener delta anterior (si existe línea)
  SELECT l.id, l.delta_cantidad
  INTO v_linea_id, v_old_delta
  FROM public.operaciones_lineas l
  WHERE l.operacion_id = v_operacion_id
    AND l.producto_id = p_producto_id
  LIMIT 1;

  v_new_delta := -p_cantidad;
  v_delta_diff := v_new_delta - COALESCE(v_old_delta, 0);

  -- aplicar delta_diff al stock (si <0 => consume; si >0 => devuelve)
  IF v_delta_diff < 0 THEN
    UPDATE public.stocks s
    SET cantidad = s.cantidad + v_delta_diff,
        updated_at = now()
    WHERE s.taller_id = v_taller_id
      AND s.producto_id = p_producto_id
      AND s.cantidad >= (-v_delta_diff);

    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      RAISE EXCEPTION 'STOCK_INSUFICIENTE (producto %)', p_producto_id;
    END IF;
  ELSIF v_delta_diff > 0 THEN
    INSERT INTO public.stocks (tenant_id, taller_id, producto_id, cantidad)
    VALUES (v_tenant_id, v_taller_id, p_producto_id, v_delta_diff)
    ON CONFLICT (taller_id, producto_id)
    DO UPDATE SET
      cantidad = public.stocks.cantidad + EXCLUDED.cantidad,
      updated_at = now();
  END IF;

  -- upsert línea
  IF v_linea_id IS NULL THEN
    INSERT INTO public.operaciones_lineas (
      operacion_id, producto_id, cantidad, monto_unitario, delta_cantidad
    )
    VALUES (
      v_operacion_id, p_producto_id, p_cantidad, p_monto_unitario, v_new_delta
    );
  ELSE
    UPDATE public.operaciones_lineas
    SET cantidad = p_cantidad,
        monto_unitario = p_monto_unitario,
        delta_cantidad = v_new_delta
    WHERE id = v_linea_id;
  END IF;

  RETURN v_operacion_id;
END;
$$;

-- RPC: borra una línea de asignación (por ID) y devuelve el stock.
-- Si la operación queda sin líneas, elimina la operación (y el vínculo al arreglo).
CREATE OR REPLACE FUNCTION public.rpc_delete_asignacion_arreglo_linea(
  p_operacion_linea_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_operacion_id uuid;
  v_taller_id uuid;
  v_producto_id uuid;
  v_cantidad int;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_operacion_linea_id IS NULL THEN
    RAISE EXCEPTION 'operacion_linea_id requerido';
  END IF;

  SELECT l.operacion_id, o.taller_id, l.producto_id, l.cantidad
  INTO v_operacion_id, v_taller_id, v_producto_id, v_cantidad
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  WHERE l.id = p_operacion_linea_id
    AND o.tipo = 'ASIGNACION_ARREGLO';

  IF v_operacion_id IS NULL THEN
    RAISE EXCEPTION 'línea no encontrada (%).', p_operacion_linea_id;
  END IF;

  -- borrar la línea primero
  DELETE FROM public.operaciones_lineas
  WHERE id = p_operacion_linea_id;

  -- devolver stock (+cantidad)
  INSERT INTO public.stocks (tenant_id, taller_id, producto_id, cantidad)
  VALUES (v_tenant_id, v_taller_id, v_producto_id, v_cantidad)
  ON CONFLICT (taller_id, producto_id)
  DO UPDATE SET
    cantidad = public.stocks.cantidad + EXCLUDED.cantidad,
    updated_at = now();

  -- si ya no quedan líneas, eliminar operación (cascada elimina vínculo)
  IF NOT EXISTS (
    SELECT 1 FROM public.operaciones_lineas ol WHERE ol.operacion_id = v_operacion_id LIMIT 1
  ) THEN
    DELETE FROM public.operaciones o WHERE o.id = v_operacion_id;
  END IF;

  RETURN v_operacion_id;
END;
$$;

