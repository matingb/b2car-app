-- v1.7.3 - Repuestos inline: producto + stock + compra + asignacion atomicos

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
  v_tenant_id uuid;
  v_producto_id uuid;
  v_stock_id uuid;
  v_operacion_id uuid;
  v_codigo text;
  v_nombre text;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  v_codigo := trim(coalesce(p_codigo, ''));
  v_nombre := trim(coalesce(p_nombre, ''));

  IF p_arreglo_id IS NULL THEN
    RAISE EXCEPTION 'arreglo_id requerido';
  END IF;
  IF p_taller_id IS NULL THEN
    RAISE EXCEPTION 'taller_id requerido';
  END IF;
  IF v_codigo = '' THEN
    RAISE EXCEPTION 'codigo requerido';
  END IF;
  IF v_nombre = '' THEN
    RAISE EXCEPTION 'nombre requerido';
  END IF;
  IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN
    RAISE EXCEPTION 'precio_compra invalido';
  END IF;
  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN
    RAISE EXCEPTION 'precio_venta invalido';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'cantidad invalida';
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

  IF EXISTS (
    SELECT 1
    FROM public.productos p
    WHERE p.tenant_id = v_tenant_id
      AND lower(trim(p.codigo)) = lower(v_codigo)
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'PRODUCTO_CODIGO_DUPLICADO (%)', v_codigo
    USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.productos (
    tenant_id, codigo, nombre, precio_unitario, costo_unitario, categorias
  )
  VALUES (
    v_tenant_id, v_codigo, v_nombre, p_precio_venta, p_precio_compra, ARRAY[]::text[]
  )
  RETURNING id INTO v_producto_id;

  INSERT INTO public.stocks (
    tenant_id, taller_id, producto_id, cantidad, stock_minimo, stock_maximo
  )
  VALUES (
    v_tenant_id, p_taller_id, v_producto_id, 0, 0, 0
  )
  RETURNING id INTO v_stock_id;

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

  v_operacion_id := public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := v_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_precio_venta
  );

  RETURN v_operacion_id;
END;
$$;
-- Solo se llama cuando se crea un arreglo con productos nuevos inline
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
  v_tenant_id uuid;
  v_arreglo_id uuid;
  v_repuesto jsonb;
  v_codigo text;
  v_expected_new_codes int;
  v_distinct_new_codes int;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_vehiculo_id IS NULL THEN
    RAISE EXCEPTION 'vehiculo_id requerido';
  END IF;
  IF p_taller_id IS NULL THEN
    RAISE EXCEPTION 'taller_id requerido';
  END IF;
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'fecha requerida';
  END IF;

  p_detalles := COALESCE(p_detalles, '[]'::jsonb);
  p_repuestos := COALESCE(p_repuestos, '[]'::jsonb);
  p_repuestos_nuevos := COALESCE(p_repuestos_nuevos, '[]'::jsonb);

  IF jsonb_typeof(p_detalles) <> 'array' THEN
    RAISE EXCEPTION 'detalles debe ser array';
  END IF;
  IF jsonb_typeof(p_repuestos) <> 'array' THEN
    RAISE EXCEPTION 'repuestos debe ser array';
  END IF;
  IF jsonb_typeof(p_repuestos_nuevos) <> 'array' THEN
    RAISE EXCEPTION 'repuestos_nuevos debe ser array';
  END IF;

  v_expected_new_codes := (
    SELECT COUNT(*)
    FROM jsonb_array_elements(p_repuestos_nuevos) AS item
    WHERE trim(coalesce(item ->> 'codigo', '')) <> ''
  );
  v_distinct_new_codes := (
    SELECT COUNT(DISTINCT lower(trim(item ->> 'codigo')))
    FROM jsonb_array_elements(p_repuestos_nuevos) AS item
    WHERE trim(coalesce(item ->> 'codigo', '')) <> ''
  );

  IF v_expected_new_codes <> jsonb_array_length(p_repuestos_nuevos)
     OR v_expected_new_codes <> v_distinct_new_codes THEN
    RAISE EXCEPTION 'PRODUCTO_CODIGO_DUPLICADO'
    USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.arreglos (
    tenant_id,
    vehiculo_id,
    taller_id,
    tipo,
    estado,
    descripcion,
    kilometraje_leido,
    fecha,
    observaciones,
    precio_final,
    precio_sin_iva,
    esta_pago,
    extra_data
  )
  VALUES (
    v_tenant_id,
    p_vehiculo_id,
    p_taller_id,
    coalesce(p_tipo, ''),
    coalesce(p_estado, 'SIN_INICIAR'::public.estado_arreglo),
    p_descripcion,
    coalesce(p_kilometraje_leido, 0),
    p_fecha,
    p_observaciones,
    coalesce(p_precio_final, 0),
    coalesce(p_precio_sin_iva, 0),
    coalesce(p_esta_pago, false),
    p_extra_data
  )
  RETURNING id INTO v_arreglo_id;

  FOR v_repuesto IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    INSERT INTO public.detalle_arreglo (
      tenant_id, arreglo_id, descripcion, cantidad, valor
    )
    VALUES (
      v_tenant_id,
      v_arreglo_id,
      trim(coalesce(v_repuesto ->> 'descripcion', '')),
      (v_repuesto ->> 'cantidad')::int,
      (v_repuesto ->> 'valor')::numeric
    );
  END LOOP;

  IF p_detalle_formulario IS NOT NULL
     AND jsonb_typeof(p_detalle_formulario) = 'object' THEN
    INSERT INTO public.detalle_form_custom (
      tenant_id, arreglo_id, config_id, costo, metadata
    )
    VALUES (
      v_tenant_id,
      v_arreglo_id,
      NULLIF(coalesce(p_detalle_formulario ->> 'formulario_id', p_detalle_formulario ->> 'config_id', ''), '')::uuid,
      COALESCE((p_detalle_formulario ->> 'costo')::numeric, 0),
      COALESCE(p_detalle_formulario -> 'metadata', '[]'::jsonb)
    );
  END IF;

  FOR v_repuesto IN SELECT * FROM jsonb_array_elements(p_repuestos)
  LOOP
    PERFORM public.rpc_set_asignacion_arreglo_linea(
      p_arreglo_id := v_arreglo_id,
      p_taller_id := p_taller_id,
      p_stock_id := (v_repuesto ->> 'stock_id')::uuid,
      p_cantidad := (v_repuesto ->> 'cantidad')::int,
      p_monto_unitario := (v_repuesto ->> 'monto_unitario')::numeric
    );
  END LOOP;

  FOR v_repuesto IN SELECT * FROM jsonb_array_elements(p_repuestos_nuevos)
  LOOP
    v_codigo := trim(coalesce(v_repuesto ->> 'codigo', ''));
    IF EXISTS (
      SELECT 1
      FROM public.productos p
      WHERE p.tenant_id = v_tenant_id
        AND lower(trim(p.codigo)) = lower(v_codigo)
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'PRODUCTO_CODIGO_DUPLICADO (%)', v_codigo
      USING ERRCODE = 'P0001';
    END IF;

    PERFORM public.rpc_crear_producto_inline_para_arreglo(
      p_arreglo_id := v_arreglo_id,
      p_taller_id := p_taller_id,
      p_codigo := v_codigo,
      p_nombre := v_repuesto ->> 'nombre',
      p_precio_compra := (v_repuesto ->> 'precio_compra')::numeric,
      p_precio_venta := (v_repuesto ->> 'precio_venta')::numeric,
      p_cantidad := (v_repuesto ->> 'cantidad')::int
    );
  END LOOP;

  -- Los triggers recalculan servicios/repuestos. El modal ya calcula el total
  -- incluyendo detalle_form_custom, que hoy no participa del trigger.
  UPDATE public.arreglos
  SET precio_final = coalesce(p_precio_final, precio_final),
      precio_sin_iva = coalesce(p_precio_sin_iva, precio_sin_iva),
      updated_at = now()
  WHERE id = v_arreglo_id;

  RETURN v_arreglo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_crear_arreglo_completo(uuid, uuid, text, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.dashboard_sum_ingresos(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS numeric
LANGUAGE sql
SET search_path TO public
AS $$
  SELECT COALESCE(SUM(d.cantidad * d.valor), 0)::numeric
  FROM public.arreglos a
  JOIN public.detalle_arreglo d ON d.arreglo_id = a.id
  WHERE a.fecha >= p_from
    AND a.fecha < p_to;
$$;
