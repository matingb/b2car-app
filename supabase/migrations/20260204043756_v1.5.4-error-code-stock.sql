CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock(
  p_tipo       public.tipo_operacion,
  p_taller_id  uuid,
  p_lineas     jsonb,
  p_arreglo_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid;
  v_operacion_id uuid;

  l jsonb;
  v_stock_id uuid;
  v_cantidad int;
  v_monto numeric(12,2);
  v_delta int;

  v_rowcount int;
  v_expected_ids int;
  v_found_ids int;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_lineas IS NULL
     OR jsonb_typeof(p_lineas) <> 'array'
     OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'lineas debe ser un array no vacío';
  END IF;

  -- Validar existencia de stocks (y que correspondan al taller)
  v_expected_ids := (
    SELECT COUNT(DISTINCT (line_elem ->> 'stock_id')::uuid)
    FROM jsonb_array_elements(p_lineas) AS line_elem
  );

  v_found_ids := (
    SELECT COUNT(*)
    FROM public.stocks s
    WHERE s.id IN (
      SELECT DISTINCT (line_elem ->> 'stock_id')::uuid
      FROM jsonb_array_elements(p_lineas) AS line_elem
    )
  );

  IF v_expected_ids <> v_found_ids THEN
    RAISE EXCEPTION 'Algún stock_id no existe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stocks s
    WHERE s.id IN (
      SELECT DISTINCT (line_elem ->> 'stock_id')::uuid
      FROM jsonb_array_elements(p_lineas) AS line_elem
    )
      AND s.taller_id <> p_taller_id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Algún stock_id no pertenece al taller';
  END IF;

  -- Lock de stocks involucrados (serializa consumo/devolución)
  PERFORM 1
  FROM public.stocks s
  WHERE s.id IN (
    SELECT DISTINCT (line_elem ->> 'stock_id')::uuid
    FROM jsonb_array_elements(p_lineas) AS line_elem
  )
  FOR UPDATE;

  -- Crear operación
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id)
  VALUES (v_tenant_id, p_tipo, p_taller_id)
  RETURNING id INTO v_operacion_id;

  -- Vínculo con arreglo
  IF p_tipo = 'ASIGNACION_ARREGLO' THEN
    IF p_arreglo_id IS NULL THEN
      RAISE EXCEPTION 'arreglo_id requerido para ASIGNACION_ARREGLO';
    END IF;
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  END IF;

  -- líneas + aplicar stock
  FOR l IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_stock_id := (l ->> 'stock_id')::uuid;
    v_cantidad := (l ->> 'cantidad')::int;
    v_monto := COALESCE((l ->> 'monto_unitario')::numeric, 0);

    IF v_stock_id IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'linea inválida (stock_id %, cantidad %)', v_stock_id, v_cantidad;
    END IF;

    v_delta :=
      CASE p_tipo
        WHEN 'COMPRA' THEN  v_cantidad
        WHEN 'VENTA' THEN  -v_cantidad
        WHEN 'ASIGNACION_ARREGLO' THEN -v_cantidad
        WHEN 'AJUSTE' THEN
          COALESCE((l ->> 'delta_cantidad')::int, v_cantidad) -- TODO: definir ajuste correctamente
        ELSE 0
      END;

    IF v_delta = 0 THEN
      RAISE EXCEPTION 'delta inválido para stock %', v_stock_id;
    END IF;

    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad
    )
    VALUES (
      v_operacion_id, v_stock_id, v_cantidad, v_monto, v_delta
    );

    -- aplicar stock
    IF v_delta < 0 THEN
      UPDATE public.stocks s
      SET cantidad = s.cantidad + v_delta,
          updated_at = now()
      WHERE s.id = v_stock_id
        AND s.cantidad >= (-v_delta);

      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id
        USING ERRCODE = 'P0001';
      END IF;
    ELSE
      UPDATE public.stocks s
      SET cantidad = s.cantidad + v_delta,
          updated_at = now()
      WHERE s.id = v_stock_id;

      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'stock no encontrado (%)', v_stock_id;
      END IF;
    END IF;
  END LOOP;

  RETURN v_operacion_id;
END;
$$;

