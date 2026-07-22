-- v1.10.2 - Enchufa tipo_arreglo_id/empleado_id en el flujo de creacion/edicion
-- de detalles (mano de obra) y repuestos asignados a un arreglo.
--
-- Unico punto real de escritura de operaciones_lineas para un arreglo:
-- rpc_set_asignacion_arreglo_linea (upsert por operacion_id+stock_id). Todo lo
-- demas (rpc_asignar_repuesto_existente_con_compra, rpc_crear_producto_inline_
-- para_arreglo, y los helpers que arman el arreglo completo) solo necesitan
-- recibir y reenviar los dos campos nuevos hasta llegar ahi.

-- ===========================================================================
-- rpc_set_asignacion_arreglo_linea: agrega p_tipo_arreglo_id/p_empleado_id.
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, int, numeric);

CREATE OR REPLACE FUNCTION public.rpc_set_asignacion_arreglo_linea(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_stock_id uuid,
  p_cantidad int,
  p_monto_unitario numeric(12,2) DEFAULT 0,
  p_tipo_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL
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
      operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad, tipo_arreglo_id, empleado_id
    )
    VALUES (
      v_operacion_id, p_stock_id, p_cantidad, p_monto_unitario, v_new_delta, p_tipo_arreglo_id, p_empleado_id
    );
  ELSE
    UPDATE public.operaciones_lineas
    SET cantidad = p_cantidad,
        monto_unitario = p_monto_unitario,
        delta_cantidad = v_new_delta,
        tipo_arreglo_id = p_tipo_arreglo_id,
        empleado_id = p_empleado_id
    WHERE id = v_linea_id;
  END IF;

  RETURN v_operacion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, int, numeric, uuid, uuid) TO authenticated;

-- ===========================================================================
-- rpc_asignar_repuesto_existente_con_compra: agrega y reenvia los 2 campos.
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric);

CREATE OR REPLACE FUNCTION public.rpc_asignar_repuesto_existente_con_compra(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_stock_id uuid,
  p_cantidad int,
  p_monto_unitario numeric(12,2),
  p_precio_compra numeric(12,2) DEFAULT NULL,
  p_tipo_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL
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
    p_monto_unitario := p_monto_unitario,
    p_tipo_arreglo_id := p_tipo_arreglo_id,
    p_empleado_id := p_empleado_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric, uuid, uuid) TO authenticated;

-- ===========================================================================
-- rpc_crear_producto_inline_para_arreglo: agrega y reenvia los 2 campos.
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int);

CREATE OR REPLACE FUNCTION public.rpc_crear_producto_inline_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_codigo text,
  p_nombre text,
  p_precio_compra numeric(12,2),
  p_precio_venta numeric(12,2),
  p_cantidad int,
  p_tipo_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL
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
    p_monto_unitario := p_precio_venta,
    p_tipo_arreglo_id := p_tipo_arreglo_id,
    p_empleado_id := p_empleado_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int, uuid, uuid) TO authenticated;

-- ===========================================================================
-- Helpers de rpc_crear_arreglo_completo: misma firma, ahora leen tipo_arreglo_id
-- /empleado_id de cada item del array jsonb y los reenvian.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._insert_detalles_arreglo(
  p_arreglo_id uuid,
  p_detalles jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_item jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RETURN;
  END IF;

  PERFORM 1 FROM public.arreglos
   WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'arreglo no encontrado';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    INSERT INTO public.detalle_arreglo (
      tenant_id, arreglo_id, descripcion, cantidad, valor, tipo_arreglo_id, empleado_id
    )
    VALUES (
      v_tenant_id, p_arreglo_id,
      trim(coalesce(v_item ->> 'descripcion', '')),
      (v_item ->> 'cantidad')::int,
      (v_item ->> 'valor')::numeric,
      NULLIF(v_item ->> 'tipo_arreglo_id', '')::uuid,
      NULLIF(v_item ->> 'empleado_id', '')::uuid
    );
  END LOOP;
END;
$$;

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
      p_precio_compra := NULLIF(v_item ->> 'precio_compra', '')::numeric,
      p_tipo_arreglo_id := NULLIF(v_item ->> 'tipo_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._crear_repuestos_nuevos_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_repuestos_nuevos jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos_nuevos IS NULL OR jsonb_array_length(p_repuestos_nuevos) = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos_nuevos)
  LOOP
    PERFORM public.rpc_crear_producto_inline_para_arreglo(
      p_arreglo_id := p_arreglo_id,
      p_taller_id := p_taller_id,
      p_codigo := v_item ->> 'codigo',
      p_nombre := v_item ->> 'nombre',
      p_precio_compra := (v_item ->> 'precio_compra')::numeric,
      p_precio_venta := (v_item ->> 'precio_venta')::numeric,
      p_cantidad := (v_item ->> 'cantidad')::int,
      p_tipo_arreglo_id := NULLIF(v_item ->> 'tipo_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid
    );
  END LOOP;
END;
$$;
