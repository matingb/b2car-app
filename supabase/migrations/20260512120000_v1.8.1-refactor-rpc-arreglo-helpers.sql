-- v1.8.2 - Refactor de rpc_crear_arreglo_completo y rpc_crear_producto_inline_para_arreglo
-- divididas en helpers PL/pgSQL para reducir complejidad sin perder transaccionalidad.
-- Las helpers leen tenant_id del JWT internamente para que aunque alguien las invoque
-- directamente, no pueda operar fuera de su tenant.

-- ===========================================================================
-- HELPERS
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._lock_arreglo_del_tenant(
  p_arreglo_id uuid,
  p_taller_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
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
END;
$$;

CREATE OR REPLACE FUNCTION public._check_codigos_unicos_en_array(
  p_repuestos_nuevos jsonb
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_expected int;
  v_distinct int;
BEGIN
  IF p_repuestos_nuevos IS NULL OR jsonb_array_length(p_repuestos_nuevos) = 0 THEN
    RETURN;
  END IF;

  v_expected := (
    SELECT COUNT(*)
    FROM jsonb_array_elements(p_repuestos_nuevos) AS item
    WHERE trim(coalesce(item ->> 'codigo', '')) <> ''
  );
  v_distinct := (
    SELECT COUNT(DISTINCT lower(trim(item ->> 'codigo')))
    FROM jsonb_array_elements(p_repuestos_nuevos) AS item
    WHERE trim(coalesce(item ->> 'codigo', '')) <> ''
  );

  IF v_expected <> jsonb_array_length(p_repuestos_nuevos)
     OR v_expected <> v_distinct THEN
    RAISE EXCEPTION 'PRODUCTO_CODIGO_DUPLICADO'
    USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._check_codigo_no_existe_en_productos(
  p_codigo text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_codigo text := lower(trim(coalesce(p_codigo, '')));
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF v_codigo = '' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.productos p
    WHERE p.tenant_id = v_tenant_id
      AND lower(trim(p.codigo)) = v_codigo
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'PRODUCTO_CODIGO_DUPLICADO (%)', p_codigo
    USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._crear_producto_y_stock(
  p_taller_id uuid,
  p_codigo text,
  p_nombre text,
  p_precio_compra numeric(12,2),
  p_precio_venta numeric(12,2)
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_producto_id uuid;
  v_stock_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  INSERT INTO public.productos (
    tenant_id, codigo, nombre, precio_unitario, costo_unitario, categorias, show_in_stock
  )
  VALUES (
    v_tenant_id, trim(p_codigo), trim(p_nombre),
    p_precio_venta, p_precio_compra, ARRAY[]::text[], false
  )
  RETURNING id INTO v_producto_id;

  INSERT INTO public.stocks (
    tenant_id, taller_id, producto_id, cantidad, stock_minimo, stock_maximo
  )
  VALUES (
    v_tenant_id, p_taller_id, v_producto_id, 0, 0, 0
  )
  RETURNING id INTO v_stock_id;

  RETURN v_stock_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._insert_arreglo_base(
  p_vehiculo_id uuid,
  p_taller_id uuid,
  p_tipo text,
  p_estado public.estado_arreglo,
  p_descripcion text,
  p_kilometraje_leido int,
  p_fecha timestamptz,
  p_observaciones text,
  p_precio_final numeric(10,2),
  p_precio_sin_iva numeric(10,2),
  p_esta_pago boolean,
  p_extra_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_arreglo_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  INSERT INTO public.arreglos (
    tenant_id, vehiculo_id, taller_id, tipo, estado, descripcion,
    kilometraje_leido, fecha, observaciones, precio_final, precio_sin_iva,
    esta_pago, extra_data
  )
  VALUES (
    v_tenant_id, p_vehiculo_id, p_taller_id,
    coalesce(p_tipo, ''),
    coalesce(p_estado, 'SIN_INICIAR'::public.estado_arreglo),
    p_descripcion, coalesce(p_kilometraje_leido, 0),
    p_fecha, p_observaciones,
    coalesce(p_precio_final, 0), coalesce(p_precio_sin_iva, 0),
    coalesce(p_esta_pago, false), p_extra_data
  )
  RETURNING id INTO v_arreglo_id;

  RETURN v_arreglo_id;
END;
$$;

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
      tenant_id, arreglo_id, descripcion, cantidad, valor
    )
    VALUES (
      v_tenant_id, p_arreglo_id,
      trim(coalesce(v_item ->> 'descripcion', '')),
      (v_item ->> 'cantidad')::int,
      (v_item ->> 'valor')::numeric
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._insert_detalle_form_custom(
  p_arreglo_id uuid,
  p_form jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_form IS NULL OR jsonb_typeof(p_form) <> 'object' THEN
    RETURN;
  END IF;

  PERFORM 1 FROM public.arreglos
   WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'arreglo no encontrado';
  END IF;

  INSERT INTO public.detalle_form_custom (
    tenant_id, arreglo_id, config_id, costo, metadata
  )
  VALUES (
    v_tenant_id, p_arreglo_id,
    NULLIF(coalesce(p_form ->> 'formulario_id', p_form ->> 'config_id', ''), '')::uuid,
    COALESCE((p_form ->> 'costo')::numeric, 0),
    COALESCE(p_form -> 'metadata', '[]'::jsonb)
  );
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
    PERFORM public.rpc_set_asignacion_arreglo_linea(
      p_arreglo_id := p_arreglo_id,
      p_taller_id := p_taller_id,
      p_stock_id := (v_item ->> 'stock_id')::uuid,
      p_cantidad := (v_item ->> 'cantidad')::int,
      p_monto_unitario := (v_item ->> 'monto_unitario')::numeric
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
      p_cantidad := (v_item ->> 'cantidad')::int
    );
  END LOOP;
END;
$$;

-- ===========================================================================
-- RPCs PÚBLICAS REFACTORIZADAS
-- ===========================================================================

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
  v_stock_id uuid;
  v_codigo text := trim(coalesce(p_codigo, ''));
  v_nombre text := trim(coalesce(p_nombre, ''));
BEGIN
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF v_codigo = '' THEN RAISE EXCEPTION 'codigo requerido'; END IF;
  IF v_nombre = '' THEN RAISE EXCEPTION 'nombre requerido'; END IF;
  IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN RAISE EXCEPTION 'precio_compra invalido'; END IF;
  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN RAISE EXCEPTION 'precio_venta invalido'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad invalida'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);
  PERFORM public._check_codigo_no_existe_en_productos(v_codigo);

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
    p_arreglo_id := NULL
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

CREATE OR REPLACE FUNCTION public.rpc_crear_arreglo_completo(
  p_vehiculo_id uuid,
  p_taller_id uuid,
  p_tipo text,
  p_estado public.estado_arreglo,
  p_descripcion text,
  p_kilometraje_leido int,
  p_fecha timestamptz,
  p_observaciones text,
  p_precio_final numeric(10,2),
  p_precio_sin_iva numeric(10,2),
  p_esta_pago boolean,
  p_extra_data jsonb,
  p_detalles jsonb DEFAULT '[]'::jsonb,
  p_repuestos jsonb DEFAULT '[]'::jsonb,
  p_repuestos_nuevos jsonb DEFAULT '[]'::jsonb,
  p_detalle_formulario jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_arreglo_id uuid;
BEGIN
  IF p_vehiculo_id IS NULL THEN RAISE EXCEPTION 'vehiculo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF p_fecha IS NULL THEN RAISE EXCEPTION 'fecha requerida'; END IF;

  p_detalles := COALESCE(p_detalles, '[]'::jsonb);
  p_repuestos := COALESCE(p_repuestos, '[]'::jsonb);
  p_repuestos_nuevos := COALESCE(p_repuestos_nuevos, '[]'::jsonb);

  IF jsonb_typeof(p_detalles) <> 'array' THEN RAISE EXCEPTION 'detalles debe ser array'; END IF;
  IF jsonb_typeof(p_repuestos) <> 'array' THEN RAISE EXCEPTION 'repuestos debe ser array'; END IF;
  IF jsonb_typeof(p_repuestos_nuevos) <> 'array' THEN RAISE EXCEPTION 'repuestos_nuevos debe ser array'; END IF;

  PERFORM public._check_codigos_unicos_en_array(p_repuestos_nuevos);

  v_arreglo_id := public._insert_arreglo_base(
    p_vehiculo_id := p_vehiculo_id,
    p_taller_id := p_taller_id,
    p_tipo := p_tipo,
    p_estado := p_estado,
    p_descripcion := p_descripcion,
    p_kilometraje_leido := p_kilometraje_leido,
    p_fecha := p_fecha,
    p_observaciones := p_observaciones,
    p_precio_final := p_precio_final,
    p_precio_sin_iva := p_precio_sin_iva,
    p_esta_pago := p_esta_pago,
    p_extra_data := p_extra_data
  );

  PERFORM public._insert_detalles_arreglo(v_arreglo_id, p_detalles);
  PERFORM public._insert_detalle_form_custom(v_arreglo_id, p_detalle_formulario);
  PERFORM public._asignar_repuestos_existentes_a_arreglo(v_arreglo_id, p_taller_id, p_repuestos);
  PERFORM public._crear_repuestos_nuevos_para_arreglo(v_arreglo_id, p_taller_id, p_repuestos_nuevos);

  UPDATE public.arreglos
  SET precio_final = coalesce(p_precio_final, precio_final),
      precio_sin_iva = coalesce(p_precio_sin_iva, precio_sin_iva),
      updated_at = now()
  WHERE id = v_arreglo_id;

  RETURN v_arreglo_id;
END;
$$;

-- ===========================================================================
-- GRANTS
-- ===========================================================================

GRANT EXECUTE ON FUNCTION public._lock_arreglo_del_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._check_codigos_unicos_en_array(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._check_codigo_no_existe_en_productos(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._crear_producto_y_stock(uuid, text, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public._insert_arreglo_base(uuid, uuid, text, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._insert_detalles_arreglo(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._insert_detalle_form_custom(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._asignar_repuestos_existentes_a_arreglo(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._crear_repuestos_nuevos_para_arreglo(uuid, uuid, jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_crear_arreglo_completo(uuid, uuid, text, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;
