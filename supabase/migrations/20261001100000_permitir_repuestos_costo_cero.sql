-- Migration: 20261001100000_permitir_repuestos_costo_cero.sql
-- Permite compras directas e inline con costo $0 en stock, arreglos y presupuestos

-- 1. rpc_asignar_repuesto_existente_con_compra: permite precio_compra = 0 y condiciona cuenta_id
CREATE OR REPLACE FUNCTION public.rpc_asignar_repuesto_existente_con_compra(
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
    IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN
      RAISE EXCEPTION 'PRECIO_COMPRA_REQUERIDO faltante=%', v_faltante
        USING ERRCODE = 'P0001';
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


-- 2. rpc_crear_operacion_con_stock: evalúa cuenta_id condicionalmente por importe > 0
CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock(
  p_tipo text,
  p_taller_id uuid,
  p_lineas jsonb,
  p_arreglo_id uuid DEFAULT NULL,
  p_fecha timestamptz DEFAULT now(),
  p_cuenta_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo public.tipo_operacion;
  v_operacion_id uuid;
  v_linea jsonb;
  v_stock_id uuid;
  v_cantidad int;
  v_monto_unitario numeric;
  v_delta_cantidad int;
  v_importe numeric := 0;
  v_rowcount int;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_tipo IS NULL OR upper(p_tipo) IN ('MOVIMIENTO_CUENTA', 'GASTO') THEN
    RAISE EXCEPTION 'Use rpc_crear_movimiento_cuenta para operaciones financieras' USING ERRCODE = '22023';
  END IF;

  v_tipo := p_tipo::public.tipo_operacion;
  IF p_taller_id IS NULL THEN
    RAISE EXCEPTION 'taller_id es requerido para operaciones de stock' USING ERRCODE = '22023';
  END IF;

  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;

  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, v_tipo, p_taller_id, COALESCE(p_fecha, now()))
  RETURNING id INTO v_operacion_id;

  IF p_arreglo_id IS NOT NULL AND v_tipo = 'ASIGNACION_ARREGLO' THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  END IF;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) LOOP
    v_stock_id := (v_linea->>'stock_id')::uuid;
    v_cantidad := coalesce((v_linea->>'cantidad')::int, 0);
    v_monto_unitario := coalesce((v_linea->>'monto_unitario')::numeric, 0);
    v_delta_cantidad := coalesce((v_linea->>'delta_cantidad')::int, 0);

    IF v_stock_id IS NULL THEN
      RAISE EXCEPTION 'línea de stock inválida' USING ERRCODE = '22023';
    END IF;

    IF v_tipo IN ('VENTA', 'COMPRA') AND (v_cantidad <= 0 OR v_monto_unitario < 0) THEN
      RAISE EXCEPTION 'línea de stock inválida' USING ERRCODE = '22023';
    ELSIF v_tipo = 'VENTA' AND v_delta_cantidad <> -v_cantidad THEN
      RAISE EXCEPTION 'delta inválido para venta' USING ERRCODE = '22023';
    ELSIF v_tipo = 'COMPRA' AND v_delta_cantidad <> v_cantidad THEN
      RAISE EXCEPTION 'delta inválido para compra' USING ERRCODE = '22023';
    END IF;

    UPDATE public.stocks AS s
    SET cantidad = s.cantidad + v_delta_cantidad,
        updated_at = now()
    WHERE s.id = v_stock_id
      AND s.tenant_id = v_tenant_id
      AND s.taller_id = p_taller_id
      AND (v_delta_cantidad >= 0 OR s.cantidad >= -v_delta_cantidad);

    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.operaciones_lineas (
      operacion_id,
      stock_id,
      cantidad,
      monto_unitario,
      delta_cantidad
    )
    VALUES (
      v_operacion_id,
      v_stock_id,
      v_cantidad,
      v_monto_unitario,
      v_delta_cantidad
    );

    v_importe := v_importe + (v_cantidad * v_monto_unitario);
  END LOOP;

  IF v_tipo IN ('COMPRA', 'VENTA') AND v_importe > 0 AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'CUENTA_FINANCIERA_REQUERIDA: cuenta financiera requerida para compras y ventas con importe > 0'
      USING ERRCODE = '22023';
  END IF;

  IF p_cuenta_id IS NOT NULL AND v_importe <> 0 AND v_tipo IN ('COMPRA', 'VENTA') THEN
    PERFORM public._ledger_insertar(
      v_operacion_id,
      v_tenant_id,
      p_cuenta_id,
      CASE WHEN v_tipo = 'COMPRA' THEN -v_importe ELSE v_importe END,
      COALESCE(p_fecha, now())
    );
  END IF;

  RETURN v_operacion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamptz, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamptz, uuid, uuid) TO authenticated, service_role;


-- 3. rpc_crear_producto_inline_para_arreglo: condiciona cuenta_id solo cuando precio_compra > 0
CREATE OR REPLACE FUNCTION public.rpc_crear_producto_inline_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_codigo text,
  p_nombre text,
  p_precio_compra numeric,
  p_precio_venta numeric,
  p_cantidad integer,
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
  v_stock_id uuid;
  v_arreglo_fecha timestamptz;
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
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
    AND a.taller_id = p_taller_id;

  IF v_arreglo_fecha IS NULL THEN
    RAISE EXCEPTION 'arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002';
  END IF;

  v_stock_id := public._crear_producto_y_stock(
    p_taller_id := p_taller_id,
    p_codigo := v_codigo,
    p_nombre := v_nombre,
    p_precio_compra := p_precio_compra,
    p_precio_venta := p_precio_venta
  );

  PERFORM public.rpc_crear_operacion_con_stock(
    p_tipo := 'COMPRA'::text,
    p_taller_id := p_taller_id,
    p_lineas := jsonb_build_array(jsonb_build_object(
      'stock_id', v_stock_id,
      'cantidad', p_cantidad,
      'monto_unitario', p_precio_compra,
      'delta_cantidad', p_cantidad
    )),
    p_arreglo_id := NULL::uuid,
    p_fecha := v_arreglo_fecha,
    p_cuenta_id := p_cuenta_id,
    p_idempotency_key := p_idempotency_key
  );

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := v_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_precio_venta,
    p_categoria_arreglo_id := p_categoria_arreglo_id,
    p_empleado_id := p_empleado_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(
  uuid, uuid, text, text, numeric, numeric, integer, uuid, uuid, uuid, uuid
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(
  uuid, uuid, text, text, numeric, numeric, integer, uuid, uuid, uuid, uuid
) TO authenticated;


-- 4. rpc_crear_arreglo_completo: exige cuenta solo si algún repuesto nuevo o existente tiene costo > 0
CREATE OR REPLACE FUNCTION public.rpc_crear_arreglo_completo(
  p_vehiculo_id uuid,
  p_taller_id uuid,
  p_estado public.estado_arreglo,
  p_descripcion text,
  p_kilometraje_leido integer,
  p_fecha timestamptz,
  p_observaciones text,
  p_precio_final numeric,
  p_precio_sin_iva numeric,
  p_esta_pago boolean,
  p_extra_data jsonb,
  p_detalles jsonb DEFAULT '[]'::jsonb,
  p_repuestos jsonb DEFAULT '[]'::jsonb,
  p_repuestos_nuevos jsonb DEFAULT '[]'::jsonb,
  p_detalle_formulario jsonb DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_fecha_cobro timestamptz DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL,
  p_combustible_leido integer DEFAULT NULL,
  p_es_facturable boolean DEFAULT false,
  p_iva_rate numeric DEFAULT 0.21
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arreglo_id uuid;
  v_pendientes jsonb;
  v_precio_final numeric;
  v_precio_sin_iva numeric;
BEGIN
  IF p_vehiculo_id IS NULL OR p_taller_id IS NULL OR p_fecha IS NULL THEN
    RAISE EXCEPTION 'vehiculo_id, taller_id y fecha son requeridos' USING ERRCODE = '22023';
  END IF;
  IF p_iva_rate IS NULL OR p_iva_rate < 0 OR p_iva_rate >= 1 THEN
    RAISE EXCEPTION 'iva_rate debe ser un número entre 0 y 1' USING ERRCODE = '22023';
  END IF;
  IF p_combustible_leido IS NOT NULL AND p_combustible_leido NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'combustible_leido debe estar entre 0 y 100' USING ERRCODE = '22023';
  END IF;
  IF p_estado = 'PRESUPUESTO' AND coalesce(p_esta_pago, false) THEN
    RAISE EXCEPTION 'No se puede crear un presupuesto como pagado' USING ERRCODE = '22023';
  END IF;
  p_detalles := coalesce(p_detalles, '[]'::jsonb);
  p_repuestos := coalesce(p_repuestos, '[]'::jsonb);
  p_repuestos_nuevos := coalesce(p_repuestos_nuevos, '[]'::jsonb);
  IF jsonb_typeof(p_detalles) <> 'array' OR jsonb_typeof(p_repuestos) <> 'array'
     OR jsonb_typeof(p_repuestos_nuevos) <> 'array' THEN
    RAISE EXCEPTION 'detalles y repuestos deben ser arrays' USING ERRCODE = '22023';
  END IF;

  IF p_cuenta_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cuentas_financieras c
    WHERE c.id = p_cuenta_id AND c.tenant_id = public.current_tenant_id() AND c.activo
  ) THEN
    RAISE EXCEPTION 'CUENTA_FINANCIERA_REQUERIDA' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public._check_codigos_unicos_en_array(p_repuestos_nuevos);

  v_arreglo_id := public._insert_arreglo_base(
    p_vehiculo_id, p_taller_id, p_estado, p_descripcion, p_kilometraje_leido,
    p_fecha, p_observaciones, p_precio_final, p_precio_sin_iva, false, p_extra_data
  );
  PERFORM public._insert_detalles_arreglo(v_arreglo_id, p_detalles);
  PERFORM public._insert_detalle_form_custom(v_arreglo_id, p_detalle_formulario);

  IF p_estado = 'PRESUPUESTO' THEN
    v_pendientes := public._b2c152_normalizar_pendientes(
      p_repuestos, p_repuestos_nuevos, p_cuenta_id, p_taller_id, public.current_tenant_id()
    );
    UPDATE public.arreglos
    SET repuestos_pendientes = v_pendientes,
        combustible_leido = p_combustible_leido,
        es_facturable = false,
        updated_at = now()
    WHERE id = v_arreglo_id;
    v_precio_final := public.calcular_precio_final_arreglo(v_arreglo_id);
    v_precio_sin_iva := round(v_precio_final / (1 + p_iva_rate), 2);
    UPDATE public.arreglos
    SET precio_final = v_precio_final,
        precio_sin_iva = v_precio_sin_iva
    WHERE id = v_arreglo_id;
    RETURN v_arreglo_id;
  END IF;

  PERFORM public._asignar_repuestos_existentes_a_arreglo(v_arreglo_id, p_taller_id, p_repuestos, p_cuenta_id, p_idempotency_key);
  PERFORM public._crear_repuestos_nuevos_para_arreglo(v_arreglo_id, p_taller_id, p_repuestos_nuevos, p_cuenta_id);
  v_precio_final := public.calcular_precio_final_arreglo(v_arreglo_id);
  v_precio_sin_iva := round(v_precio_final / (1 + p_iva_rate), 2);
  UPDATE public.arreglos
  SET combustible_leido = p_combustible_leido,
      precio_final = v_precio_final,
      precio_sin_iva = v_precio_sin_iva,
      es_facturable = CASE WHEN (SELECT auth.jwt() ->> 'plan_sub') = 'PRO' THEN coalesce(p_es_facturable, false) ELSE false END,
      updated_at = now()
  WHERE id = v_arreglo_id;
  IF coalesce(p_esta_pago, false) THEN
    IF p_cuenta_id IS NULL OR p_idempotency_key IS NULL THEN
      RAISE EXCEPTION 'cuenta_id e idempotency_key requeridos para registrar el cobro' USING ERRCODE = '22023';
    END IF;
    PERFORM public.rpc_finanzas_cobrar_arreglo(v_arreglo_id, p_cuenta_id, v_precio_final, coalesce(p_fecha_cobro, p_fecha), NULL, p_idempotency_key);
  END IF;
  RETURN v_arreglo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_crear_arreglo_completo(
  uuid, uuid, public.estado_arreglo, text, integer, timestamptz, text,
  numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid,
  timestamptz, uuid, integer, boolean, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_arreglo_completo(
  uuid, uuid, public.estado_arreglo, text, integer, timestamptz, text,
  numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid,
  timestamptz, uuid, integer, boolean, numeric
) TO authenticated, service_role;


-- 5. _b2c152_normalizar_pendientes: condiciona cuenta_id e idempotency_key solo para compras con costo > 0
CREATE OR REPLACE FUNCTION public._b2c152_normalizar_pendientes(
  p_repuestos jsonb,
  p_repuestos_nuevos jsonb,
  p_cuenta_id uuid,
  p_taller_id uuid,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_linea jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_repuestos, '[]'::jsonb)) LOOP
    v_linea := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'tipo', 'EXISTENTE',
      'stock_id', v_item ->> 'stock_id',
      'cantidad', (v_item ->> 'cantidad')::integer,
      'monto_unitario', (v_item ->> 'monto_unitario')::numeric,
      'precio_compra', CASE WHEN v_item ? 'precio_compra' THEN (v_item ->> 'precio_compra')::numeric ELSE NULL END,
      'cuenta_id', CASE WHEN v_item ? 'precio_compra' AND (v_item ->> 'precio_compra') IS NOT NULL AND (v_item ->> 'precio_compra')::numeric > 0 THEN p_cuenta_id::text ELSE NULL END,
      'idempotency_key', CASE WHEN v_item ? 'precio_compra' AND (v_item ->> 'precio_compra') IS NOT NULL AND (v_item ->> 'precio_compra')::numeric > 0 THEN gen_random_uuid()::text ELSE NULL END,
      'categoria_arreglo_id', NULLIF(v_item ->> 'categoria_arreglo_id', ''),
      'empleado_id', NULLIF(v_item ->> 'empleado_id', '')
    );
    PERFORM public._b2c152_validar_linea(v_linea, p_taller_id, p_tenant_id);
    IF (v_linea ->> 'precio_compra') IS NOT NULL AND (v_linea ->> 'precio_compra')::numeric > 0 AND p_cuenta_id IS NULL THEN
      RAISE EXCEPTION 'cuenta_id requerido para registrar la compra automatica' USING ERRCODE = '22023';
    END IF;
    v_result := v_result || jsonb_build_array(v_linea);
  END LOOP;
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_repuestos_nuevos, '[]'::jsonb)) LOOP
    v_linea := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'tipo', 'NUEVO',
      'stock_id', NULL,
      'codigo', trim(v_item ->> 'codigo'),
      'nombre', trim(v_item ->> 'nombre'),
      'precio_compra', (v_item ->> 'precio_compra')::numeric,
      'precio_venta', (v_item ->> 'precio_venta')::numeric,
      'monto_unitario', (v_item ->> 'precio_venta')::numeric,
      'cantidad', (v_item ->> 'cantidad')::integer,
      'cuenta_id', CASE WHEN (v_item ->> 'precio_compra')::numeric > 0 THEN p_cuenta_id::text ELSE NULL END,
      'idempotency_key', CASE WHEN (v_item ->> 'precio_compra')::numeric > 0 THEN gen_random_uuid()::text ELSE NULL END,
      'categoria_arreglo_id', NULLIF(v_item ->> 'categoria_arreglo_id', ''),
      'empleado_id', NULLIF(v_item ->> 'empleado_id', '')
    );
    PERFORM public._b2c152_validar_linea(v_linea, p_taller_id, p_tenant_id);
    PERFORM public._check_codigo_no_existe_en_productos(v_linea ->> 'codigo');
    IF (v_linea ->> 'precio_compra')::numeric > 0 AND p_cuenta_id IS NULL THEN
      RAISE EXCEPTION 'cuenta_id requerido para registrar la compra automatica' USING ERRCODE = '22023';
    END IF;
    v_result := v_result || jsonb_build_array(v_linea);
  END LOOP;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public._b2c152_normalizar_pendientes(jsonb, jsonb, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
