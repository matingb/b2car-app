-- v1.8.4 - Fecha propia para operaciones y propagación desde arreglos.

ALTER TABLE public.operaciones
ADD COLUMN IF NOT EXISTS fecha timestamp with time zone;

UPDATE public.operaciones
SET fecha = created_at
WHERE fecha IS NULL;

ALTER TABLE public.operaciones
ALTER COLUMN fecha SET DEFAULT now(),
ALTER COLUMN fecha SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operaciones_fecha
ON public.operaciones (fecha);

DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock(
  p_tipo       public.tipo_operacion,
  p_taller_id  uuid,
  p_lineas     jsonb,
  p_arreglo_id uuid DEFAULT NULL,
  p_fecha      timestamp with time zone DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
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

  PERFORM 1
  FROM public.stocks s
  WHERE s.id IN (
    SELECT DISTINCT (line_elem ->> 'stock_id')::uuid
    FROM jsonb_array_elements(p_lineas) AS line_elem
  )
  FOR UPDATE;

  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, p_tipo, p_taller_id, COALESCE(p_fecha, now()))
  RETURNING id INTO v_operacion_id;

  IF p_tipo = 'ASIGNACION_ARREGLO' THEN
    IF p_arreglo_id IS NULL THEN
      RAISE EXCEPTION 'arreglo_id requerido para ASIGNACION_ARREGLO';
    END IF;

    PERFORM 1
    FROM public.arreglos a
    WHERE a.id = p_arreglo_id
      AND a.tenant_id = v_tenant_id
      AND a.taller_id = p_taller_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'arreglo no encontrado';
    END IF;

    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  END IF;

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
          COALESCE((l ->> 'delta_cantidad')::int, v_cantidad)
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

CREATE OR REPLACE FUNCTION public.rpc_set_asignacion_arreglo_linea(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_stock_id uuid,
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
  v_arreglo_fecha timestamp with time zone;

  v_linea_id uuid;
  v_old_delta int;
  v_new_delta int;
  v_delta_diff int;

  v_rowcount int;
  v_stock_taller_id uuid;
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
  IF p_stock_id IS NULL THEN
    RAISE EXCEPTION 'stock_id requerido';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'cantidad inválida (%)', p_cantidad;
  END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN
    RAISE EXCEPTION 'monto_unitario inválido (%)', p_monto_unitario;
  END IF;

  SELECT a.fecha
  INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
    AND a.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'arreglo no encontrado';
  END IF;

  SELECT oa.operacion_id
  INTO v_operacion_id
  FROM public.operaciones_asignacion_arreglo oa
  WHERE oa.arreglo_id = p_arreglo_id
  LIMIT 1;

  IF v_operacion_id IS NULL THEN
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
    VALUES (v_tenant_id, 'ASIGNACION_ARREGLO', p_taller_id, v_arreglo_fecha)
    RETURNING id INTO v_operacion_id;

    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);

    v_taller_id := p_taller_id;
  ELSE
    SELECT o.taller_id
    INTO v_taller_id
    FROM public.operaciones o
    WHERE o.id = v_operacion_id
      AND o.tenant_id = v_tenant_id;

    IF v_taller_id IS NULL THEN
      RAISE EXCEPTION 'operación % no encontrada', v_operacion_id;
    END IF;

    IF v_taller_id <> p_taller_id THEN
      RAISE EXCEPTION 'taller_id no coincide (operación %, esperado %, recibido %)', v_operacion_id, v_taller_id, p_taller_id;
    END IF;
  END IF;

  SELECT s.taller_id
  INTO v_stock_taller_id
  FROM public.stocks s
  WHERE s.id = p_stock_id
  FOR UPDATE;

  IF v_stock_taller_id IS NULL THEN
    RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id;
  END IF;
  IF v_stock_taller_id <> v_taller_id THEN
    RAISE EXCEPTION 'stock_id no pertenece al taller (stock %, esperado %, recibido %)', p_stock_id, v_taller_id, v_stock_taller_id;
  END IF;

  SELECT l.id, l.delta_cantidad
  INTO v_linea_id, v_old_delta
  FROM public.operaciones_lineas l
  WHERE l.operacion_id = v_operacion_id
    AND l.stock_id = p_stock_id
  LIMIT 1;

  v_new_delta := -p_cantidad;
  v_delta_diff := v_new_delta - COALESCE(v_old_delta, 0);

  IF v_delta_diff < 0 THEN
    UPDATE public.stocks s
    SET cantidad = s.cantidad + v_delta_diff,
        updated_at = now()
    WHERE s.id = p_stock_id
      AND s.cantidad >= (-v_delta_diff);

    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', p_stock_id;
    END IF;
  ELSIF v_delta_diff > 0 THEN
    UPDATE public.stocks s
    SET cantidad = s.cantidad + v_delta_diff,
        updated_at = now()
    WHERE s.id = p_stock_id;
  END IF;

  IF v_linea_id IS NULL THEN
    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad
    )
    VALUES (
      v_operacion_id, p_stock_id, p_cantidad, p_monto_unitario, v_new_delta
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

CREATE OR REPLACE FUNCTION public.rpc_crear_producto_inline_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_codigo text,
  p_nombre text,
  p_precio_compra numeric(12,2),
  p_precio_venta numeric(12,2),
  p_cantidad int
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_stock_id uuid;
  v_arreglo_fecha timestamp with time zone;
  v_codigo text := trim(coalesce(p_codigo, ''));
  v_nombre text := trim(coalesce(p_nombre, ''));
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF v_codigo = '' THEN RAISE EXCEPTION 'codigo requerido'; END IF;
  IF v_nombre = '' THEN RAISE EXCEPTION 'nombre requerido'; END IF;
  IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN RAISE EXCEPTION 'precio_compra invalido'; END IF;
  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN RAISE EXCEPTION 'precio_venta invalido'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad invalida'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);
  PERFORM public._check_codigo_no_existe_en_productos(v_codigo);

  SELECT a.fecha
  INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
    AND a.taller_id = p_taller_id;

  v_stock_id := public._crear_producto_y_stock(
    p_taller_id := p_taller_id,
    p_codigo := v_codigo,
    p_nombre := v_nombre,
    p_precio_compra := p_precio_compra,
    p_precio_venta := p_precio_venta
  );

  PERFORM public.rpc_crear_operacion_con_stock(
    p_tipo := 'COMPRA'::public.tipo_operacion,
    p_taller_id := p_taller_id,
    p_lineas := jsonb_build_array(jsonb_build_object(
      'stock_id', v_stock_id,
      'cantidad', p_cantidad,
      'monto_unitario', p_precio_compra
    )),
    p_arreglo_id := NULL,
    p_fecha := v_arreglo_fecha
  );

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := v_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_precio_venta
  );
END;
$$;

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
  v_arreglo_fecha timestamp with time zone;
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

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);

  SELECT a.fecha
  INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
    AND a.taller_id = p_taller_id;

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
      p_arreglo_id := NULL,
      p_fecha := v_arreglo_fecha
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

GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, int, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric) TO authenticated;
