-- v1.5.1 - Operaciones: actualizar líneas para referenciar stock_id en vez de producto_id

ALTER TABLE public.operaciones_lineas
ADD COLUMN IF NOT EXISTS stock_id uuid NOT NULL;

ALTER TABLE public.operaciones_lineas
ADD CONSTRAINT operaciones_lineas_stock_id_fkey
FOREIGN KEY (stock_id)
REFERENCES public.stocks(id)
ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_operaciones_lineas_stock_id
ON public.operaciones_lineas (stock_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_operaciones_lineas_operacion_stock
ON public.operaciones_lineas (operacion_id, stock_id);

ALTER TABLE public.operaciones_lineas
DROP COLUMN IF EXISTS producto_id;




DROP FUNCTION IF EXISTS public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, int, numeric);

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

  -- lock stock row + validar pertenencia al taller
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

  -- obtener delta anterior (si existe línea)
  SELECT l.id, l.delta_cantidad
  INTO v_linea_id, v_old_delta
  FROM public.operaciones_lineas l
  WHERE l.operacion_id = v_operacion_id
    AND l.stock_id = p_stock_id
  LIMIT 1;

  v_new_delta := -p_cantidad;
  v_delta_diff := v_new_delta - COALESCE(v_old_delta, 0);

  -- aplicar delta_diff al stock (si <0 => consume; si >0 => devuelve)
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

  -- upsert línea
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

-- rpc_delete_asignacion_arreglo_linea: devuelve stock por stock_id
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
  v_stock_id uuid;
  v_cantidad int;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_operacion_linea_id IS NULL THEN
    RAISE EXCEPTION 'operacion_linea_id requerido';
  END IF;

  SELECT l.operacion_id, o.taller_id, l.stock_id, l.cantidad
  INTO v_operacion_id, v_taller_id, v_stock_id, v_cantidad
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
  UPDATE public.stocks s
  SET cantidad = s.cantidad + v_cantidad,
      updated_at = now()
  WHERE s.id = v_stock_id;

  -- si ya no quedan líneas, eliminar operación (cascada elimina vínculo)
  IF NOT EXISTS (
    SELECT 1 FROM public.operaciones_lineas ol WHERE ol.operacion_id = v_operacion_id LIMIT 1
  ) THEN
    DELETE FROM public.operaciones o WHERE o.id = v_operacion_id;
  END IF;

  RETURN v_operacion_id;
END;
$$;

-- rpc_crear_operacion_con_stock: ahora recibe lineas con stock_id
-- lineas: JSONB array de objetos:
--   [
--     {"stock_id":"uuid", "cantidad": 3, "monto_unitario": 1200.50},
--     ...
--   ]
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
        RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id;
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

