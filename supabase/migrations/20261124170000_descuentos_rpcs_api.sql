-- ==============================================================================
-- Migración: Actualización de RPCs y funciones para Descuentos, Subtotales y Totales
-- ==============================================================================

-- 1. _insert_detalles_arreglo: persiste 'descuento' (trg calcula subtotal y total)
CREATE OR REPLACE FUNCTION public._insert_detalles_arreglo (
  p_arreglo_id uuid,
  p_detalles   jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_item jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN RETURN; END IF;

  PERFORM 1 FROM public.arreglos WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles) LOOP
    INSERT INTO public.detalle_arreglo (
      tenant_id, arreglo_id, descripcion, cantidad, precio_hora_facturada,
      horas_facturadas, horas_trabajadas, valor_hora_empleado,
      categoria_arreglo_id, empleado_id, descuento
    ) VALUES (
      v_tenant_id, p_arreglo_id, trim(coalesce(v_item ->> 'descripcion', '')),
      COALESCE(NULLIF(v_item ->> 'cantidad', '')::numeric, 1),
      NULLIF(v_item ->> 'precio_hora_facturada', '')::numeric,
      COALESCE(NULLIF(v_item ->> 'horas_facturadas', '')::numeric, 1),
      COALESCE(NULLIF(v_item ->> 'horas_trabajadas', '')::numeric, 1),
      NULLIF(v_item ->> 'valor_hora_empleado', '')::numeric,
      NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      NULLIF(v_item ->> 'empleado_id', '')::uuid,
      COALESCE(NULLIF(v_item ->> 'descuento', '')::numeric, 0)
    );
  END LOOP;
END;
$function$;

-- 2. _insert_detalle_form_custom: persiste 'descuento'
CREATE OR REPLACE FUNCTION public._insert_detalle_form_custom (
  p_arreglo_id uuid,
  p_form       jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
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
    tenant_id, arreglo_id, config_id, costo, metadata, descuento
  )
  VALUES (
    v_tenant_id, p_arreglo_id,
    NULLIF(coalesce(p_form ->> 'formulario_id', p_form ->> 'config_id', ''), '')::uuid,
    COALESCE((p_form ->> 'costo')::numeric, 0),
    COALESCE(p_form -> 'metadata', '[]'::jsonb),
    COALESCE(NULLIF(p_form ->> 'descuento', '')::numeric, 0)
  );
END;
$function$;

-- 3. rpc_set_asignacion_arreglo_linea con p_descuento numeric DEFAULT 0
DROP FUNCTION IF EXISTS public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, integer, numeric, uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_set_asignacion_arreglo_linea (
  p_arreglo_id           uuid,
  p_taller_id            uuid,
  p_stock_id             uuid,
  p_cantidad             integer,
  p_monto_unitario       numeric DEFAULT 0,
  p_categoria_arreglo_id uuid    DEFAULT NULL::uuid,
  p_empleado_id          uuid    DEFAULT NULL::uuid,
  p_descuento            numeric DEFAULT 0
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion_id uuid;
  v_arreglo_fecha timestamp with time zone;
  v_linea_id uuid;
  v_linea_cant integer;
  v_stock_taller_id uuid;
  v_diff integer;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('arreglos:edit') THEN
    RAISE EXCEPTION 'permiso arreglos:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida (%)', p_cantidad USING ERRCODE = '22023'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario inválido (%)', p_monto_unitario USING ERRCODE = '22023'; END IF;
  IF p_descuento IS NULL OR p_descuento < 0 THEN RAISE EXCEPTION 'descuento inválido (%)', p_descuento USING ERRCODE = '22023'; END IF;

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;

  SELECT s.taller_id INTO v_stock_taller_id
  FROM public.stocks s WHERE s.id = p_stock_id FOR UPDATE;

  IF v_stock_taller_id IS NULL THEN RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id USING ERRCODE = 'P0002'; END IF;
  IF v_stock_taller_id <> p_taller_id THEN RAISE EXCEPTION 'stock_id no pertenece al taller' USING ERRCODE = '22023'; END IF;

  -- Buscar o crear la operación de ASIGNACION_ARREGLO
  SELECT oa.operacion_id INTO v_operacion_id
  FROM public.operaciones_asignacion_arreglo oa
  WHERE oa.arreglo_id = p_arreglo_id LIMIT 1;

  IF v_operacion_id IS NULL THEN
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, monto_total)
    VALUES (v_tenant_id, 'ASIGNACION_ARREGLO', p_taller_id, COALESCE(v_arreglo_fecha, now()), 0)
    RETURNING id INTO v_operacion_id;

    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, tenant_id, arreglo_id)
    VALUES (v_operacion_id, v_tenant_id, p_arreglo_id);
  END IF;

  -- Buscar línea existente
  SELECT l.id, l.cantidad INTO v_linea_id, v_linea_cant
  FROM public.operaciones_lineas l
  WHERE l.operacion_id = v_operacion_id AND l.stock_id = p_stock_id
  FOR UPDATE;

  IF v_linea_id IS NULL THEN
    -- Alta de línea
    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, sentido,
      categoria_arreglo_id, empleado_id, descuento
    ) VALUES (
      v_operacion_id, p_stock_id, p_cantidad, p_monto_unitario, -1,
      p_categoria_arreglo_id, p_empleado_id, COALESCE(p_descuento, 0)
    ) RETURNING id INTO v_linea_id;

    INSERT INTO public.operaciones_movimiento_stock (
      tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
    ) VALUES (
      v_tenant_id, v_operacion_id, v_linea_id, p_stock_id,
      -p_cantidad, COALESCE(v_arreglo_fecha, now()), 'Asignación a arreglo'
    );
  ELSE
    -- Modificación de línea
    IF p_cantidad > v_linea_cant THEN
      v_diff := p_cantidad - v_linea_cant;
      UPDATE public.operaciones_lineas
      SET cantidad = p_cantidad,
          monto_unitario = p_monto_unitario,
          categoria_arreglo_id = p_categoria_arreglo_id,
          empleado_id = p_empleado_id,
          descuento = COALESCE(p_descuento, descuento)
      WHERE id = v_linea_id;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant_id, v_operacion_id, v_linea_id, p_stock_id,
        -v_diff, COALESCE(v_arreglo_fecha, now()), 'Aumento de asignación a arreglo'
      );
    ELSIF p_cantidad < v_linea_cant THEN
      DELETE FROM public.operaciones_movimiento_stock WHERE operacion_linea_id = v_linea_id;

      UPDATE public.operaciones_lineas
      SET cantidad = p_cantidad,
          monto_unitario = p_monto_unitario,
          categoria_arreglo_id = p_categoria_arreglo_id,
          empleado_id = p_empleado_id,
          descuento = COALESCE(p_descuento, descuento)
      WHERE id = v_linea_id;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant_id, v_operacion_id, v_linea_id, p_stock_id,
        -p_cantidad, COALESCE(v_arreglo_fecha, now()), 'Reajuste de asignación a arreglo'
      );
    ELSE
      UPDATE public.operaciones_lineas
      SET monto_unitario = p_monto_unitario,
          categoria_arreglo_id = p_categoria_arreglo_id,
          empleado_id = p_empleado_id,
          descuento = COALESCE(p_descuento, descuento)
      WHERE id = v_linea_id;
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, integer, numeric, uuid, uuid, numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, integer, numeric, uuid, uuid, numeric) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, integer, numeric, uuid, uuid, numeric) TO service_role;

-- 4. rpc_asignar_repuesto_existente_con_compra con p_descuento
DROP FUNCTION IF EXISTS public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_asignar_repuesto_existente_con_compra (
  p_arreglo_id           uuid,
  p_taller_id            uuid,
  p_stock_id             uuid,
  p_cantidad             integer,
  p_monto_unitario       numeric,
  p_precio_compra        numeric DEFAULT NULL::numeric,
  p_categoria_arreglo_id uuid    DEFAULT NULL::uuid,
  p_empleado_id          uuid    DEFAULT NULL::uuid,
  p_cuenta_id            uuid    DEFAULT NULL::uuid,
  p_idempotency_key      uuid    DEFAULT NULL::uuid,
  p_descuento            numeric DEFAULT 0
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo_fecha timestamptz;
  v_stock_cantidad integer;
  v_old_cantidad integer;
  v_delta_diff integer;
  v_faltante integer;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('arreglos:edit') THEN
    RAISE EXCEPTION 'permiso arreglos:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad invalida' USING ERRCODE = '22023'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario invalido' USING ERRCODE = '22023'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id;

  IF v_arreglo_fecha IS NULL THEN
    RAISE EXCEPTION 'arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002';
  END IF;

  SELECT s.cantidad INTO v_stock_cantidad
  FROM public.stocks AS s
  WHERE s.id = p_stock_id AND s.tenant_id = v_tenant_id AND s.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id USING ERRCODE = 'P0002';
  END IF;

  SELECT l.cantidad INTO v_old_cantidad
  FROM public.operaciones_lineas AS l
  JOIN public.operaciones_asignacion_arreglo AS oa ON oa.operacion_id = l.operacion_id
  WHERE oa.arreglo_id = p_arreglo_id AND l.stock_id = p_stock_id;

  v_delta_diff := p_cantidad - COALESCE(v_old_cantidad, 0);

  IF v_delta_diff > 0 THEN
    v_faltante := v_delta_diff - v_stock_cantidad;
    IF v_faltante > 0 THEN
      IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('arreglos:repuestos:comprar') THEN
        RAISE EXCEPTION 'permiso arreglos:repuestos:comprar requerido' USING ERRCODE = '42501';
      END IF;
      IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN
        RAISE EXCEPTION 'PRECIO_COMPRA_REQUERIDO faltante=%', v_faltante USING ERRCODE = 'P0001';
      END IF;

      PERFORM public._crear_operacion_con_stock(
        p_tipo := 'COMPRA'::public.tipo_operacion,
        p_taller_id := p_taller_id,
        p_lineas := jsonb_build_array(jsonb_build_object(
          'stock_id', p_stock_id,
          'cantidad', v_faltante,
          'monto_unitario', p_precio_compra
        )),
        p_arreglo_id := NULL::uuid,
        p_fecha := v_arreglo_fecha,
        p_cuenta_id := p_cuenta_id,
        p_idempotency_key := p_idempotency_key
      );
    END IF;
  END IF;

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := p_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_monto_unitario,
    p_categoria_arreglo_id := p_categoria_arreglo_id,
    p_empleado_id := p_empleado_id,
    p_descuento := p_descuento
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, uuid, uuid, numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, uuid, uuid, numeric) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, uuid, uuid, numeric) TO service_role;

-- 5. rpc_crear_producto_inline_para_arreglo con p_descuento
DROP FUNCTION IF EXISTS public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, integer, uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_crear_producto_inline_para_arreglo (
  p_arreglo_id           uuid,
  p_taller_id            uuid,
  p_codigo               text,
  p_nombre               text,
  p_precio_compra        numeric,
  p_precio_venta         numeric,
  p_cantidad             integer,
  p_categoria_arreglo_id uuid    DEFAULT NULL::uuid,
  p_empleado_id          uuid    DEFAULT NULL::uuid,
  p_cuenta_id            uuid    DEFAULT NULL::uuid,
  p_idempotency_key      uuid    DEFAULT NULL::uuid,
  p_descuento            numeric DEFAULT 0
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_stock_id uuid;
  v_arreglo_fecha timestamptz;
  v_codigo text := trim(coalesce(p_codigo, ''));
  v_nombre text := trim(coalesce(p_nombre, ''));
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('arreglos:repuestos:comprar') THEN
    RAISE EXCEPTION 'permiso arreglos:repuestos:comprar requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF v_codigo = '' THEN RAISE EXCEPTION 'codigo requerido' USING ERRCODE = '22023'; END IF;
  IF v_nombre = '' THEN RAISE EXCEPTION 'nombre requerido' USING ERRCODE = '22023'; END IF;
  IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN RAISE EXCEPTION 'precio_compra invalido' USING ERRCODE = '22023'; END IF;
  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN RAISE EXCEPTION 'precio_venta invalido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad invalida' USING ERRCODE = '22023'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);
  PERFORM public._check_codigo_no_existe_en_productos(v_codigo);

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id;

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

  PERFORM public._crear_operacion_con_stock(
    p_tipo := 'COMPRA'::public.tipo_operacion,
    p_taller_id := p_taller_id,
    p_lineas := jsonb_build_array(jsonb_build_object(
      'stock_id', v_stock_id,
      'cantidad', p_cantidad,
      'monto_unitario', p_precio_compra
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
    p_empleado_id := p_empleado_id,
    p_descuento := p_descuento
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, integer, uuid, uuid, uuid, uuid, numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, integer, uuid, uuid, uuid, uuid, numeric) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, integer, uuid, uuid, uuid, uuid, numeric) TO service_role;

-- 6. _asignar_repuestos_existentes_a_arreglo: pasa descuento
CREATE OR REPLACE FUNCTION public._asignar_repuestos_existentes_a_arreglo (
  p_arreglo_id      uuid,
  p_taller_id       uuid,
  p_repuestos       jsonb,
  p_cuenta_id       uuid  DEFAULT NULL::uuid,
  p_idempotency_key uuid  DEFAULT NULL::uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos IS NULL OR jsonb_array_length(p_repuestos) = 0 THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos) LOOP
    PERFORM public.rpc_asignar_repuesto_existente_con_compra(
      p_arreglo_id := p_arreglo_id, p_taller_id := p_taller_id,
      p_stock_id := (v_item ->> 'stock_id')::uuid, p_cantidad := (v_item ->> 'cantidad')::int,
      p_monto_unitario := (v_item ->> 'monto_unitario')::numeric,
      p_precio_compra := NULLIF(v_item ->> 'precio_compra', '')::numeric,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid,
      p_cuenta_id := p_cuenta_id,
      p_idempotency_key := p_idempotency_key,
      p_descuento := COALESCE(NULLIF(v_item ->> 'descuento', '')::numeric, 0)
    );
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public._asignar_repuestos_existentes_a_arreglo (
  p_arreglo_id uuid,
  p_taller_id  uuid,
  p_repuestos  jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos IS NULL OR jsonb_array_length(p_repuestos) = 0 THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos) LOOP
    PERFORM public.rpc_asignar_repuesto_existente_con_compra(
      p_arreglo_id := p_arreglo_id, p_taller_id := p_taller_id,
      p_stock_id := (v_item ->> 'stock_id')::uuid, p_cantidad := (v_item ->> 'cantidad')::int,
      p_monto_unitario := (v_item ->> 'monto_unitario')::numeric,
      p_precio_compra := NULLIF(v_item ->> 'precio_compra', '')::numeric,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid,
      p_descuento := COALESCE(NULLIF(v_item ->> 'descuento', '')::numeric, 0)
    );
  END LOOP;
END;
$function$;

-- 7. _crear_repuestos_nuevos_para_arreglo: pasa descuento
CREATE OR REPLACE FUNCTION public._crear_repuestos_nuevos_para_arreglo (
  p_arreglo_id       uuid,
  p_taller_id        uuid,
  p_repuestos_nuevos jsonb,
  p_cuenta_id        uuid  DEFAULT NULL::uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
      p_cantidad := (v_item ->> 'cantidad')::integer,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid,
      p_cuenta_id := p_cuenta_id,
      p_descuento := COALESCE(NULLIF(v_item ->> 'descuento', '')::numeric, 0)
    );
  END LOOP;
END;
$function$;

-- 8. _b2c152_normalizar_pendientes: preserva descuento, subtotal y total
CREATE OR REPLACE FUNCTION public._b2c152_normalizar_pendientes (
  p_repuestos        jsonb,
  p_repuestos_nuevos jsonb,
  p_cuenta_id        uuid,
  p_taller_id        uuid,
  p_tenant_id        uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_linea jsonb;
  v_cant integer;
  v_unit numeric;
  v_sub numeric;
  v_desc numeric;
  v_tot numeric;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_repuestos, '[]'::jsonb)) LOOP
    v_cant := (v_item ->> 'cantidad')::integer;
    v_unit := (v_item ->> 'monto_unitario')::numeric;
    v_sub := coalesce(v_cant * v_unit, 0);
    v_desc := COALESCE(NULLIF(v_item ->> 'descuento', '')::numeric, 0);
    v_tot := GREATEST(0, v_sub - v_desc);

    v_linea := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'tipo', 'EXISTENTE',
      'stock_id', v_item ->> 'stock_id',
      'cantidad', v_cant,
      'monto_unitario', v_unit,
      'subtotal', v_sub,
      'descuento', v_desc,
      'total', v_tot,
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
    v_cant := (v_item ->> 'cantidad')::integer;
    v_unit := (v_item ->> 'precio_venta')::numeric;
    v_sub := coalesce(v_cant * v_unit, 0);
    v_desc := COALESCE(NULLIF(v_item ->> 'descuento', '')::numeric, 0);
    v_tot := GREATEST(0, v_sub - v_desc);

    v_linea := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'tipo', 'NUEVO',
      'stock_id', NULL,
      'codigo', trim(v_item ->> 'codigo'),
      'nombre', trim(v_item ->> 'nombre'),
      'precio_compra', (v_item ->> 'precio_compra')::numeric,
      'precio_venta', v_unit,
      'monto_unitario', v_unit,
      'subtotal', v_sub,
      'descuento', v_desc,
      'total', v_tot,
      'cantidad', v_cant,
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
$function$;

-- 9. _b2c152_validar_linea: valida descuento
CREATE OR REPLACE FUNCTION public._b2c152_validar_linea (
  p_linea     jsonb,
  p_taller_id uuid,
  p_tenant_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tipo text;
  v_id uuid;
  v_stock_id uuid;
  v_cantidad integer;
  v_monto numeric;
  v_precio_compra numeric;
  v_codigo text;
  v_nombre text;
  v_descuento numeric;
BEGIN
  IF p_linea IS NULL OR jsonb_typeof(p_linea) <> 'object' THEN
    RAISE EXCEPTION 'repuesto pendiente invalido' USING ERRCODE = '22023';
  END IF;
  BEGIN v_id := (p_linea ->> 'id')::uuid; EXCEPTION WHEN invalid_text_representation THEN v_id := NULL; END;
  IF v_id IS NULL THEN RAISE EXCEPTION 'id de repuesto pendiente invalido' USING ERRCODE = '22023'; END IF;
  v_tipo := upper(trim(coalesce(p_linea ->> 'tipo', '')));
  v_cantidad := (p_linea ->> 'cantidad')::integer;
  v_monto := (p_linea ->> 'monto_unitario')::numeric;
  v_descuento := COALESCE((p_linea ->> 'descuento')::numeric, 0);

  IF v_cantidad IS NULL OR v_cantidad <= 0 OR v_monto IS NULL OR v_monto < 0 THEN
    RAISE EXCEPTION 'cantidad o monto de repuesto pendiente invalido' USING ERRCODE = '22023';
  END IF;

  IF v_descuento < 0 OR v_descuento > (v_cantidad * v_monto) THEN
    RAISE EXCEPTION 'descuento de repuesto pendiente invalido' USING ERRCODE = '22023';
  END IF;

  IF v_tipo = 'EXISTENTE' THEN
    BEGIN v_stock_id := (p_linea ->> 'stock_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN v_stock_id := NULL; END;
    IF v_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id de repuesto pendiente invalido' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.stocks s
      WHERE s.id = v_stock_id AND s.tenant_id = p_tenant_id AND s.taller_id = p_taller_id
    ) THEN
      RAISE EXCEPTION 'stock_id no pertenece al taller' USING ERRCODE = 'P0001';
    END IF;
    IF p_linea ? 'precio_compra' AND (p_linea ->> 'precio_compra') IS NOT NULL THEN
      v_precio_compra := (p_linea ->> 'precio_compra')::numeric;
      IF v_precio_compra < 0 THEN RAISE EXCEPTION 'precio_compra invalido' USING ERRCODE = '22023'; END IF;
    END IF;
  ELSIF v_tipo = 'NUEVO' THEN
    v_codigo := trim(coalesce(p_linea ->> 'codigo', ''));
    v_nombre := trim(coalesce(p_linea ->> 'nombre', ''));
    v_precio_compra := (p_linea ->> 'precio_compra')::numeric;
    IF v_codigo = '' OR v_nombre = '' OR v_precio_compra IS NULL OR v_precio_compra < 0 THEN
      RAISE EXCEPTION 'producto nuevo pendiente invalido' USING ERRCODE = '22023';
    END IF;
    IF (p_linea ->> 'precio_venta')::numeric IS NULL OR (p_linea ->> 'precio_venta')::numeric < 0 THEN
      RAISE EXCEPTION 'precio_venta invalido' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'tipo de repuesto pendiente invalido' USING ERRCODE = '22023';
  END IF;
END;
$function$;

-- 10. _b2c152_publicar_pendientes: expone descuento, subtotal y total
CREATE OR REPLACE FUNCTION public._b2c152_publicar_pendientes (
  p_pendientes jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  SELECT CASE WHEN p_pendientes IS NULL THEN NULL ELSE coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', x ->> 'id', 'tipo', x ->> 'tipo', 'stock_id', x ->> 'stock_id',
      'codigo', x ->> 'codigo', 'nombre', x ->> 'nombre',
      'precio_compra', x ->> 'precio_compra', 'precio_venta', x ->> 'precio_venta',
      'monto_unitario', x ->> 'monto_unitario', 'cantidad', x ->> 'cantidad',
      'subtotal', x ->> 'subtotal', 'descuento', x ->> 'descuento', 'total', x ->> 'total',
      'categoria_arreglo_id', x ->> 'categoria_arreglo_id', 'empleado_id', x ->> 'empleado_id'
    )) ORDER BY (x ->> 'id')
  ), '[]'::jsonb) END
  FROM jsonb_array_elements(coalesce(p_pendientes, '[]'::jsonb)) x;
$function$;

-- 11. rpc_activar_presupuesto: pasa p_descuento al materializar repuestos
CREATE OR REPLACE FUNCTION public.rpc_activar_presupuesto (
  p_arreglo_id   uuid,
  p_nuevo_estado public.estado_arreglo
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo public.arreglos;
  v_linea jsonb;
  v_pendientes jsonb;
  v_tipo text;
BEGIN
  IF p_nuevo_estado IS NULL OR p_nuevo_estado = 'PRESUPUESTO' THEN
    RAISE EXCEPTION 'Estado de activacion invalido' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_arreglo FROM public.arreglos
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_arreglo.estado <> 'PRESUPUESTO' THEN
    IF v_arreglo.estado = p_nuevo_estado THEN RETURN true; END IF;
    RAISE EXCEPTION 'El arreglo ya fue activado y no admite esta transicion' USING ERRCODE = 'P0001';
  END IF;

  IF v_arreglo.repuestos_pendientes IS NOT NULL THEN
    v_pendientes := v_arreglo.repuestos_pendientes;
    FOR v_linea IN SELECT x FROM jsonb_array_elements(v_pendientes) x ORDER BY x ->> 'id' LOOP
      PERFORM public._b2c152_validar_linea(v_linea, v_arreglo.taller_id, v_tenant_id);
    END LOOP;
    -- Vaciar primero el borrador para que los triggers de asignacion no sumen
    -- la misma linea pendiente junto con la linea ya materializada.
    UPDATE public.arreglos
    SET repuestos_pendientes = NULL, updated_at = now()
    WHERE id = p_arreglo_id;
    PERFORM set_config('b2c152.activation', 'on', true);
    FOR v_linea IN SELECT x FROM jsonb_array_elements(v_pendientes) x ORDER BY x ->> 'id' LOOP
      v_tipo := upper(v_linea ->> 'tipo');
      IF v_tipo = 'EXISTENTE' THEN
        PERFORM public.rpc_asignar_repuesto_existente_con_compra(
          p_arreglo_id := p_arreglo_id,
          p_taller_id := v_arreglo.taller_id,
          p_stock_id := (v_linea ->> 'stock_id')::uuid,
          p_cantidad := (v_linea ->> 'cantidad')::integer,
          p_monto_unitario := (v_linea ->> 'monto_unitario')::numeric,
          p_precio_compra := NULLIF(v_linea ->> 'precio_compra', '')::numeric,
          p_categoria_arreglo_id := NULLIF(v_linea ->> 'categoria_arreglo_id', '')::uuid,
          p_empleado_id := NULLIF(v_linea ->> 'empleado_id', '')::uuid,
          p_cuenta_id := NULLIF(v_linea ->> 'cuenta_id', '')::uuid,
          p_idempotency_key := NULLIF(v_linea ->> 'idempotency_key', '')::uuid,
          p_descuento := COALESCE((v_linea ->> 'descuento')::numeric, 0)
        );
      ELSE
        PERFORM public.rpc_crear_producto_inline_para_arreglo(
          p_arreglo_id := p_arreglo_id,
          p_taller_id := v_arreglo.taller_id,
          p_codigo := v_linea ->> 'codigo',
          p_nombre := v_linea ->> 'nombre',
          p_precio_compra := (v_linea ->> 'precio_compra')::numeric,
          p_precio_venta := (v_linea ->> 'precio_venta')::numeric,
          p_cantidad := (v_linea ->> 'cantidad')::integer,
          p_categoria_arreglo_id := NULLIF(v_linea ->> 'categoria_arreglo_id', '')::uuid,
          p_empleado_id := NULLIF(v_linea ->> 'empleado_id', '')::uuid,
          p_cuenta_id := NULLIF(v_linea ->> 'cuenta_id', '')::uuid,
          p_idempotency_key := NULLIF(v_linea ->> 'idempotency_key', '')::uuid,
          p_descuento := COALESCE((v_linea ->> 'descuento')::numeric, 0)
        );
      END IF;
    END LOOP;
    UPDATE public.arreglos
    SET estado = p_nuevo_estado,
        precio_final = public.calcular_precio_final_arreglo(id),
        updated_at = now()
    WHERE id = p_arreglo_id;
  ELSE
    -- Presupuesto historico: sus asignaciones ya existen y no deben duplicarse.
    PERFORM set_config('b2c152.activation', 'on', true);
    UPDATE public.arreglos SET estado = p_nuevo_estado, updated_at = now() WHERE id = p_arreglo_id;
  END IF;
  RETURN true;
END;
$function$;

-- 12. rpc_get_arreglo_detalle: expone subtotal, descuento, total en todas las entidades
CREATE OR REPLACE FUNCTION public.rpc_get_arreglo_detalle (
  p_arreglo_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo jsonb;
  v_detalles jsonb;
  v_asignaciones jsonb;
  v_cobros jsonb;
  v_puede_ver_costos boolean := public._b2c179_tiene_permiso('empleados:view');
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  SELECT jsonb_build_object(
    'id', a.id, 'numero_orden', a.numero_orden, 'vehiculo', to_jsonb(v), 'taller_id', a.taller_id, 'taller', to_jsonb(t),
    'categoria', coalesce((SELECT string_agg(ca.nombre, ', ') FROM unnest(a.categorias) c_id JOIN public.categorias_arreglo ca ON ca.id = c_id), ''),
    'categorias', a.categorias, 'empleados', a.empleados,
    'empleados_detallados', public.arreglos_empleados_detallados(a),
    'estado', a.estado, 'descripcion', a.descripcion, 'kilometraje_leido', a.kilometraje_leido,
    'combustible_leido', a.combustible_leido, 'fecha', a.fecha, 'observaciones', a.observaciones,
    'subtotal', a.subtotal, 'descuento', a.descuento,
    'precio_final', a.precio_final, 'precio_sin_iva', a.precio_sin_iva, 'esta_pago', a.esta_pago,
    'precios_incluyen_iva', a.precios_incluyen_iva, 'tasa_iva', a.tasa_iva,
    'total_cobrado', a.total_cobrado,
    'saldo_pendiente', greatest(0, coalesce(a.precio_final, 0) - coalesce(a.total_cobrado, 0)),
    'extra_data', a.extra_data, 'cliente_id', a.cliente_id, 'es_facturable', a.es_facturable,
    'repuestos_pendientes', public._b2c152_publicar_pendientes(a.repuestos_pendientes)
  ) INTO v_arreglo
  FROM public.arreglos a
  JOIN public.vehiculos v ON v.id = a.vehiculo_id
  LEFT JOIN public.talleres t ON t.id = a.taller_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id;
  IF v_arreglo IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'arreglo_id', d.arreglo_id, 'descripcion', d.descripcion,
    'cantidad', d.cantidad, 'precio_hora_facturada', d.precio_hora_facturada,
    'horas_facturadas', d.horas_facturadas, 'horas_trabajadas', d.horas_trabajadas,
    'valor_hora_empleado', CASE WHEN v_puede_ver_costos THEN d.valor_hora_empleado ELSE NULL END,
    'subtotal', d.subtotal, 'descuento', d.descuento, 'total', d.total,
    'categoria_arreglo_id', d.categoria_arreglo_id, 'empleado_id', d.empleado_id,
    'created_at', d.created_at, 'updated_at', d.updated_at
  ) ORDER BY d.created_at), '[]'::jsonb) INTO v_detalles
  FROM public.detalle_arreglo d
  WHERE d.arreglo_id = p_arreglo_id AND d.tenant_id = v_tenant_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'tipo', o.tipo, 'taller_id', o.taller_id, 'created_at', o.created_at,
    'lineas', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id, 'cantidad', l.cantidad,
      'monto_unitario', l.monto_unitario, 'subtotal', l.subtotal, 'descuento', l.descuento, 'total', l.total,
      'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at,
      'categoria_arreglo_id', l.categoria_arreglo_id, 'empleado_id', l.empleado_id,
      'producto', jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre,
        'precio_unitario', p.precio_unitario, 'costo_unitario', p.costo_unitario,
        'categorias', coalesce(p.categorias, ARRAY[]::text[]))
    ) ORDER BY l.created_at) FROM public.operaciones_lineas l
      JOIN public.stocks s ON s.id = l.stock_id JOIN public.productos p ON p.id = s.producto_id
      WHERE l.operacion_id = o.id), '[]'::jsonb)
  ) ORDER BY o.created_at), '[]'::jsonb) INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oa
  JOIN public.operaciones o ON o.id = oa.operacion_id
  WHERE oa.arreglo_id = p_arreglo_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', omc.operacion_id, 'operacion_id', omc.operacion_id, 'importe', omc.importe,
    'cuenta_id', omc.cuenta_id, 'cuenta_nombre', cf.nombre, 'descripcion', omc.descripcion,
    'fecha', o.fecha, 'created_at', omc.created_at
  ) ORDER BY o.fecha ASC, omc.created_at ASC), '[]'::jsonb) INTO v_cobros
  FROM public.operaciones_cobro_arreglo oca
  JOIN public.operaciones o ON o.id = oca.operacion_id
  JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = oca.operacion_id
  JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
  WHERE oca.arreglo_id = p_arreglo_id AND oca.tenant_id = v_tenant_id;
  RETURN jsonb_build_object(
    'arreglo', v_arreglo,
    'detalles', v_detalles,
    'asignaciones', v_asignaciones,
    'cobros', v_cobros
  );
END;
$function$;

-- 13. _crear_operacion_con_stock y rpc_crear_operacion_con_stock: descuento en líneas, cargos y p_precios_incluyen_iva
DROP FUNCTION IF EXISTS public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb, boolean);

DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb, boolean);

CREATE OR REPLACE FUNCTION public._crear_operacion_con_stock (
  p_tipo                 public.tipo_operacion,
  p_taller_id            uuid,
  p_lineas               jsonb,
  p_arreglo_id           uuid                     DEFAULT NULL::uuid,
  p_cuenta_id            uuid                     DEFAULT NULL::uuid,
  p_pagos                jsonb                    DEFAULT NULL::jsonb,
  p_fecha                timestamp with time zone DEFAULT now(),
  p_idempotency_key      uuid                     DEFAULT NULL::uuid,
  p_observaciones        text                     DEFAULT NULL::text,
  p_estado_pago          text                     DEFAULT NULL::text,
  p_monto_inicial        numeric                  DEFAULT NULL::numeric,
  p_mover_stock          boolean                  DEFAULT true,
  p_proveedor_id         uuid                     DEFAULT NULL::uuid,
  p_cliente_id           uuid                     DEFAULT NULL::uuid,
  p_cargos               jsonb                    DEFAULT NULL::jsonb,
  p_precios_incluyen_iva boolean                  DEFAULT true
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id          uuid := public.current_tenant_id();
  v_operacion_id       uuid;
  v_linea              jsonb;
  v_linea_id           uuid;
  v_stock_id           uuid;
  v_cantidad           integer;
  v_monto_unitario     numeric(12,2);
  v_descuento          numeric(14,2);
  v_sentido            smallint;
  v_monto_total        numeric(12,2) := 0;
  v_total_pagos        numeric(14,2) := 0;
  v_pago_elem          jsonb;
  v_pago_cuenta_id     uuid;
  v_pago_monto         numeric(14,2);
  v_pago_fecha         timestamp with time zone;
  v_pago_desc          text;
  v_pago_idemp         uuid;
  v_signo              numeric;
  v_categoria_arreglo  uuid;
  v_empleado_id        uuid;
  v_iva_alicuota       smallint;
  v_cantidad_cumpl     integer;
  v_fecha              timestamp with time zone := COALESCE(p_fecha, now());
  v_total_cargos       numeric := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_cuenta_id IS NOT NULL THEN
    SELECT operacion_id INTO v_operacion_id
    FROM public.operaciones_movimiento_cuenta
    WHERE tenant_id = v_tenant_id AND idempotency_key = p_idempotency_key;
    IF v_operacion_id IS NOT NULL THEN
      RETURN v_operacion_id;
    END IF;
  END IF;

  IF p_tipo NOT IN ('COMPRA', 'VENTA', 'ASIGNACION_ARREGLO', 'AJUSTE') THEN
    RAISE EXCEPTION 'Tipo de operación inválido para operaciones con stock: %', p_tipo USING ERRCODE = '22023';
  END IF;

  -- Cargos: se validan antes de crear nada para no dejar operaciones a medias.
  IF p_cargos IS NOT NULL THEN
    v_total_cargos := public._validar_y_sumar_cargos_operacion(p_cargos);
    IF v_total_cargos > 0 AND p_tipo <> 'COMPRA' THEN
      RAISE EXCEPTION 'Solo las compras admiten cargos' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_sentido := CASE WHEN p_tipo = 'COMPRA' THEN 1::smallint ELSE -1::smallint END;

  IF p_lineas IS NOT NULL AND jsonb_array_length(p_lineas) > 0 THEN
    SELECT COALESCE(SUM(
      ((elem ->> 'cantidad')::integer * (elem ->> 'monto_unitario')::numeric) - COALESCE((elem ->> 'descuento')::numeric, 0)
    ), 0)
    INTO v_monto_total
    FROM jsonb_array_elements(p_lineas) AS elem;
  END IF;

  v_monto_total := v_monto_total + v_total_cargos;

  INSERT INTO public.operaciones (
    tenant_id, taller_id, tipo, fecha, monto_total, observaciones
  ) VALUES (
    v_tenant_id, p_taller_id, p_tipo, v_fecha, v_monto_total, p_observaciones
  ) RETURNING id INTO v_operacion_id;

  IF p_tipo = 'VENTA' THEN
    INSERT INTO public.operaciones_venta (operacion_id, tenant_id, cliente_id)
    VALUES (v_operacion_id, v_tenant_id, p_cliente_id);
  ELSIF p_tipo = 'COMPRA' THEN
    INSERT INTO public.operaciones_compra (operacion_id, tenant_id, proveedor_id, precios_incluyen_iva)
    VALUES (v_operacion_id, v_tenant_id, p_proveedor_id, COALESCE(p_precios_incluyen_iva, true));
  ELSIF p_tipo = 'ASIGNACION_ARREGLO' THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, tenant_id, arreglo_id)
    VALUES (v_operacion_id, v_tenant_id, p_arreglo_id);
  END IF;

  IF v_total_cargos > 0 THEN
    PERFORM public._guardar_cargos_operacion(v_tenant_id, v_operacion_id, p_cargos);
  END IF;

  -- Insertar líneas ordenadas por stock_id (Lock ordering)
  IF p_lineas IS NOT NULL AND jsonb_array_length(p_lineas) > 0 THEN
    FOR v_linea IN
      SELECT elem
      FROM jsonb_array_elements(p_lineas) AS elem
      ORDER BY (elem ->> 'stock_id')::uuid
    LOOP
      v_stock_id := (v_linea ->> 'stock_id')::uuid;
      v_cantidad := (v_linea ->> 'cantidad')::integer;
      v_monto_unitario := COALESCE((v_linea ->> 'monto_unitario')::numeric, 0);
      v_descuento := COALESCE((v_linea ->> 'descuento')::numeric, 0);
      v_categoria_arreglo := (v_linea ->> 'categoria_arreglo_id')::uuid;
      v_empleado_id := (v_linea ->> 'empleado_id')::uuid;
      v_iva_alicuota := COALESCE((v_linea ->> 'iva_alicuota_id')::smallint, 5::smallint);

      INSERT INTO public.operaciones_lineas (
        operacion_id, stock_id, cantidad, monto_unitario, sentido,
        categoria_arreglo_id, empleado_id, iva_alicuota_id, descuento
      ) VALUES (
        v_operacion_id, v_stock_id, v_cantidad, v_monto_unitario, v_sentido,
        v_categoria_arreglo, v_empleado_id, v_iva_alicuota, v_descuento
      ) RETURNING id INTO v_linea_id;

      -- Determinar cantidad a cumplir físicamente
      IF v_linea ? 'cantidad_cumplida' AND (v_linea ->> 'cantidad_cumplida') IS NOT NULL THEN
        v_cantidad_cumpl := GREATEST(0, LEAST(v_cantidad, (v_linea ->> 'cantidad_cumplida')::integer));
      ELSIF COALESCE(p_mover_stock, true) THEN
        v_cantidad_cumpl := v_cantidad;
      ELSE
        v_cantidad_cumpl := 0;
      END IF;

      IF v_cantidad_cumpl > 0 THEN
        INSERT INTO public.operaciones_movimiento_stock (
          tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
        ) VALUES (
          v_tenant_id, v_operacion_id, v_linea_id, v_stock_id,
          v_sentido * v_cantidad_cumpl,
          v_fecha,
          CASE WHEN p_tipo = 'COMPRA' THEN 'Recepción inicial' ELSE 'Entrega inicial' END
        );
      END IF;
    END LOOP;
  END IF;

  -- Manejo de pagos en OMC
  v_signo := CASE WHEN p_tipo = 'VENTA' THEN 1 ELSE -1 END;

  IF p_pagos IS NOT NULL AND jsonb_array_length(p_pagos) > 0 THEN
    FOR v_pago_elem IN SELECT * FROM jsonb_array_elements(p_pagos)
    LOOP
      v_pago_cuenta_id := (v_pago_elem ->> 'cuenta_id')::uuid;
      v_pago_monto := (v_pago_elem ->> 'monto')::numeric;
      v_pago_fecha := COALESCE((v_pago_elem ->> 'fecha')::timestamptz, v_fecha);
      v_pago_desc := v_pago_elem ->> 'descripcion';
      v_pago_idemp := (v_pago_elem ->> 'idempotency_key')::uuid;

      IF v_pago_monto IS NOT NULL AND v_pago_monto > 0 AND v_pago_cuenta_id IS NOT NULL THEN
        INSERT INTO public.operaciones_movimiento_cuenta (
          tenant_id, operacion_id, cuenta_id, importe, fecha, descripcion, idempotency_key
        ) VALUES (
          v_tenant_id, v_operacion_id, v_pago_cuenta_id,
          v_signo * v_pago_monto,
          v_pago_fecha,
          COALESCE(v_pago_desc, 'Pago de ' || p_tipo::text),
          v_pago_idemp
        );
      END IF;
    END LOOP;
  ELSIF p_cuenta_id IS NOT NULL
        AND COALESCE(upper(p_estado_pago), '') <> 'PENDIENTE'
        AND (p_monto_inicial IS NOT NULL OR v_monto_total > 0) THEN
    IF upper(p_estado_pago) = 'PARCIAL' THEN
      v_total_pagos := COALESCE(p_monto_inicial, 0);
    ELSE
      v_total_pagos := COALESCE(p_monto_inicial, v_monto_total);
    END IF;
    IF v_total_pagos > 0 THEN
      INSERT INTO public.operaciones_movimiento_cuenta (
        tenant_id, operacion_id, cuenta_id, importe, fecha, descripcion, idempotency_key
      ) VALUES (
        v_tenant_id, v_operacion_id, p_cuenta_id,
        v_signo * v_total_pagos,
        v_fecha,
        'Pago de ' || p_tipo::text,
        p_idempotency_key
      );
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock (
  p_tipo                 public.tipo_operacion,
  p_taller_id            uuid,
  p_lineas               jsonb,
  p_arreglo_id           uuid                     DEFAULT NULL::uuid,
  p_cuenta_id            uuid                     DEFAULT NULL::uuid,
  p_pagos                jsonb                    DEFAULT NULL::jsonb,
  p_fecha                timestamp with time zone DEFAULT now(),
  p_idempotency_key      uuid                     DEFAULT NULL::uuid,
  p_observaciones        text                     DEFAULT NULL::text,
  p_estado_pago          text                     DEFAULT NULL::text,
  p_monto_inicial        numeric                  DEFAULT NULL::numeric,
  p_mover_stock          boolean                  DEFAULT true,
  p_proveedor_id         uuid                     DEFAULT NULL::uuid,
  p_cliente_id           uuid                     DEFAULT NULL::uuid,
  p_cargos               jsonb                    DEFAULT NULL::jsonb,
  p_precios_incluyen_iva boolean                  DEFAULT true
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  RETURN public._crear_operacion_con_stock(
    p_tipo := p_tipo,
    p_taller_id := p_taller_id,
    p_lineas := p_lineas,
    p_arreglo_id := p_arreglo_id,
    p_cuenta_id := p_cuenta_id,
    p_pagos := p_pagos,
    p_fecha := p_fecha,
    p_idempotency_key := p_idempotency_key,
    p_observaciones := p_observaciones,
    p_estado_pago := p_estado_pago,
    p_monto_inicial := p_monto_inicial,
    p_mover_stock := p_mover_stock,
    p_proveedor_id := p_proveedor_id,
    p_cliente_id := p_cliente_id,
    p_cargos := p_cargos,
    p_precios_incluyen_iva := p_precios_incluyen_iva
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb, boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb, boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb, boolean) TO service_role;

-- 14. Nueva RPC: rpc_actualizar_descuentos_operacion
CREATE OR REPLACE FUNCTION public.rpc_actualizar_descuentos_operacion (
  p_operacion_id uuid,
  p_lineas       jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op record;
  v_item jsonb;
  v_linea_id uuid;
  v_desc numeric;
  v_linea record;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF public.facturacion_operacion_autorizada(p_operacion_id) THEN
    RAISE EXCEPTION 'No se pueden modificar descuentos de una operacion facturada';
  END IF;

  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' THEN
    RAISE EXCEPTION 'p_lineas debe ser un array' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_linea_id := (v_item ->> 'id')::uuid;
    v_desc := (v_item ->> 'descuento')::numeric;

    IF v_linea_id IS NULL OR v_desc IS NULL OR v_desc < 0 THEN
      RAISE EXCEPTION 'linea_id y descuento válido requeridos' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_linea
    FROM public.operaciones_lineas
    WHERE id = v_linea_id AND operacion_id = p_operacion_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Línea % no pertenece a la operación', v_linea_id USING ERRCODE = 'P0002';
    END IF;

    IF v_desc > v_linea.subtotal THEN
      RAISE EXCEPTION 'El descuento no puede superar el subtotal de la línea' USING ERRCODE = '22023';
    END IF;

    UPDATE public.operaciones_lineas
    SET descuento = v_desc
    WHERE id = v_linea_id;
  END LOOP;

  -- Releer operación recalculada por los triggers
  SELECT * INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  IF COALESCE(v_op.total_pagado, 0) > 0 AND v_op.monto_total < v_op.total_pagado THEN
    RAISE EXCEPTION 'El nuevo total (%) no puede ser menor a lo ya pagado (%)', v_op.monto_total, v_op.total_pagado USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'id', v_op.id,
    'subtotal', v_op.subtotal,
    'descuento', v_op.descuento,
    'monto_total', v_op.monto_total,
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, COALESCE(v_op.monto_total, 0) - COALESCE(v_op.total_pagado, 0)),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_actualizar_descuentos_operacion(uuid, jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rpc_actualizar_descuentos_operacion(uuid, jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_actualizar_descuentos_operacion(uuid, jsonb) TO service_role;

-- 15. rpc_listar_operaciones_con_gastos: agrega subtotal, descuento, total en lineas y en operacion
DROP FUNCTION IF EXISTS public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer);

CREATE OR REPLACE FUNCTION public.rpc_listar_operaciones_con_gastos (
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_tipos     text[]                   DEFAULT NULL::text[],
  p_page      integer                  DEFAULT 1,
  p_page_size integer                  DEFAULT 50
)
  RETURNS TABLE (
    id                       uuid,
    tipo                     text,
    taller_id                uuid,
    fecha                    timestamp with time zone,
    created_at               timestamp with time zone,
    lineas                   jsonb,
    gasto_id                 uuid,
    descripcion              text,
    categoria_gasto          text,
    cuenta_financiera_id     uuid,
    cuenta_financiera_nombre text,
    monto                    numeric,
    subtotal                 numeric,
    descuento                numeric,
    monto_total              numeric,
    total_pagado             numeric,
    saldo_pendiente          numeric,
    esta_pago                boolean,
    estado_pago              text,
    estado_stock             text,
    arreglo_id               uuid,
    total_count              bigint,
    observaciones            text,
    proveedor_id             uuid,
    proveedor_nombre         text,
    cliente_id               uuid,
    cliente_nombre           text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  WITH rows AS (
    SELECT
      o.id,
      o.tipo::text AS tipo,
      o.taller_id,
      o.fecha,
      o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id,
          'cantidad', l.cantidad, 'cantidad_cumplida', l.cantidad_cumplida,
          'monto_unitario', l.monto_unitario, 'subtotal', l.subtotal,
          'descuento', l.descuento, 'total', l.total,
          'delta_cantidad', l.delta_cantidad,
          'created_at', l.created_at, 'nombre', p.nombre, 'codigo', p.codigo
        ) ORDER BY l.created_at, l.id)
        FROM public.operaciones_lineas AS l
        LEFT JOIN public.stocks AS s ON s.id = l.stock_id
        LEFT JOIN public.productos AS p ON p.id = s.producto_id
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb) AS lineas,
      CASE WHEN o.tipo = 'GASTO'::public.tipo_operacion THEN o.id ELSE NULL END AS gasto_id,
      CASE
        WHEN o.tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion AND v.id IS NOT NULL THEN
          'Asignación · ' || TRIM(v.marca || ' ' || v.modelo) || ' (' || v.patente || ')'
        WHEN o.tipo = 'AJUSTE'::public.tipo_operacion AND oaj.motivo = 'DEVOLUCION_NC' THEN
          'Devolución por NC · ' || COALESCE((
            SELECT 'NC ' || COALESCE(n.numero_comprobante::text, n.id::text)
              || ' · Factura ' || COALESCE(f.numero_comprobante::text, f.id::text)
            FROM public.facturacion_nc_devoluciones d
            JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id
            JOIN public.facturas_electronicas f ON f.id = n.documento_asociado_id
            WHERE d.operacion_ajuste_id = o.id LIMIT 1
          ), '')
        WHEN o.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN
          'Transferencia de ' || COALESCE(c_orig.nombre, '') || ' a ' || COALESCE(c_dest.nombre, '')
        WHEN o.tipo = 'INGRESO'::public.tipo_operacion THEN
          COALESCE(oi.concepto, 'Ingreso a ' || COALESCE(c_ing.nombre, ''))
        WHEN o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN
          'Apertura de cuenta ' || COALESCE(c_aper.nombre, '')
        WHEN o.tipo = 'AJUSTE_FINANCIERO'::public.tipo_operacion THEN oaf.descripcion
        WHEN o.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN
          'Cobro arreglo ' || COALESCE(v_cob.patente, '')
        ELSE COALESCE(og.descripcion, o.observaciones)
      END AS descripcion,
      og.categoria_gasto,
      COALESCE(oi.cuenta_id, oap.cuenta_id, ot.cuenta_origen_id, oaf.cuenta_id) AS cuenta_financiera_id,
      COALESCE(c_ing.nombre, c_aper.nombre, c_orig.nombre, c_ajuste.nombre) AS cuenta_financiera_nombre,
      o.monto_total AS monto,
      o.subtotal,
      o.descuento,
      o.monto_total,
      o.total_pagado,
      GREATEST(0, COALESCE(o.monto_total, 0) - COALESCE(o.total_pagado, 0)) AS saldo_pendiente,
      o.esta_pago,
      o.estado_pago::text AS estado_pago,
      o.estado_stock::text AS estado_stock,
      COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id,
      o.observaciones,
      oc.proveedor_id,
      prov.nombre AS proveedor_nombre,
      ov.cliente_id,
      CASE
        WHEN cl.tipo_cliente = 'empresa' THEN emp.nombre
        WHEN cl.tipo_cliente = 'particular' THEN TRIM(part.nombre || ' ' || part.apellido)
        ELSE NULL
      END AS cliente_nombre
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_gasto og ON og.operacion_id = o.id
    LEFT JOIN public.operaciones_ingreso oi ON oi.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_ing ON c_ing.id = oi.cuenta_id
    LEFT JOIN public.operaciones_transferencia ot ON ot.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_orig ON c_orig.id = ot.cuenta_origen_id
    LEFT JOIN public.cuentas_financieras c_dest ON c_dest.id = ot.cuenta_destino_id
    LEFT JOIN public.operaciones_apertura_cuenta oap ON oap.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_aper ON c_aper.id = oap.cuenta_id
    LEFT JOIN public.operaciones_ajuste_financiero oaf ON oaf.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_ajuste ON c_ajuste.id = oaf.cuenta_id
    LEFT JOIN public.operaciones_ajuste oaj ON oaj.operacion_id = o.id
    LEFT JOIN public.operaciones_cobro_arreglo oca ON oca.operacion_id = o.id
    LEFT JOIN public.arreglos a_cob ON a_cob.id = oca.arreglo_id
    LEFT JOIN public.vehiculos v_cob ON v_cob.id = a_cob.vehiculo_id
    LEFT JOIN public.operaciones_asignacion_arreglo oaa ON oaa.operacion_id = o.id
    LEFT JOIN public.arreglos a ON a.id = oaa.arreglo_id
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    LEFT JOIN public.operaciones_compra oc ON oc.operacion_id = o.id
    LEFT JOIN public.proveedores prov ON prov.id = oc.proveedor_id
    LEFT JOIN public.operaciones_venta ov ON ov.operacion_id = o.id
    LEFT JOIN public.clientes cl ON cl.id = ov.cliente_id
    LEFT JOIN public.empresas emp ON emp.id = ov.cliente_id
    LEFT JOIN public.particulares part ON part.id = ov.cliente_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
      AND (
        COALESCE(cardinality(p_tipos), 0) = 0
        OR o.tipo::text = ANY(p_tipos)
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM rows
  )
  SELECT
    r.id, r.tipo, r.taller_id, r.fecha, r.created_at, r.lineas, r.gasto_id,
    r.descripcion, r.categoria_gasto, r.cuenta_financiera_id, r.cuenta_financiera_nombre,
    r.monto, r.subtotal, r.descuento, r.monto_total, r.total_pagado, r.saldo_pendiente, r.esta_pago,
    r.estado_pago, r.estado_stock, r.arreglo_id, c.total AS total_count,
    r.observaciones, r.proveedor_id, r.proveedor_nombre, r.cliente_id, r.cliente_nombre
  FROM rows r
  CROSS JOIN counted c
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 500)
  OFFSET GREATEST((COALESCE(p_page, 1) - 1) * COALESCE(p_page_size, 50), 0);
$function$;

REVOKE ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) TO anon;
GRANT ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) TO service_role;

-- 16. Dashboard SQL: dashboard_facturacion_por_empleado y dashboard_facturacion_por_categoria usan totales post-descuento
CREATE OR REPLACE FUNCTION public.dashboard_facturacion_por_empleado (
  top         integer                  DEFAULT 6,
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label    text,
    cantidad integer,
    monto    numeric
  )
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  WITH lineas AS (
    SELECT a.id AS arreglo_id, d.empleado_id AS empleado_id,
      public.importe_comercial_arreglo(d.total, a.precios_incluyen_iva, a.tasa_iva)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    UNION ALL
    SELECT a.id AS arreglo_id, ol.empleado_id AS empleado_id,
      public.importe_comercial_arreglo(ol.total, a.precios_incluyen_iva, a.tasa_iva)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    UNION ALL
    SELECT a.id AS arreglo_id, NULL::uuid AS empleado_id,
      public.importe_comercial_arreglo(c.total, a.precios_incluyen_iva, a.tasa_iva) AS monto
    FROM public.arreglos a
    CROSS JOIN LATERAL (
      SELECT total FROM public.detalle_form_custom WHERE arreglo_id = a.id
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) c
    WHERE a.tasa_iva IS NOT NULL
      AND (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
  ),
  agg AS (
    SELECT
      COALESCE(e.nombre || ' ' || e.apellido, 'Sin empleado')::text AS label,
      COUNT(DISTINCT (l.arreglo_id, l.empleado_id))::int AS cantidad,
      COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.empleados e ON e.id = l.empleado_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto,
           ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn
    FROM agg
  ),
  top_rows AS (
    SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto
    FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.label, s.cantidad, s.monto
  FROM (
    SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows
    UNION ALL
    SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_facturacion_por_categoria (
  top         integer                  DEFAULT 6,
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label    text,
    cantidad integer,
    monto    numeric
  )
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  WITH lineas AS (
    SELECT a.id AS arreglo_id, d.categoria_arreglo_id AS cat_id,
      public.importe_comercial_arreglo(d.total, a.precios_incluyen_iva, a.tasa_iva)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    UNION ALL
    SELECT a.id AS arreglo_id, ol.categoria_arreglo_id AS cat_id,
      public.importe_comercial_arreglo(ol.total, a.precios_incluyen_iva, a.tasa_iva)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    UNION ALL
    SELECT a.id AS arreglo_id, NULL::uuid AS cat_id,
      public.importe_comercial_arreglo(c.total, a.precios_incluyen_iva, a.tasa_iva) AS monto
    FROM public.arreglos a
    CROSS JOIN LATERAL (
      SELECT total FROM public.detalle_form_custom WHERE arreglo_id = a.id
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) c
    WHERE a.tasa_iva IS NOT NULL
      AND (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
  ),
  agg AS (
    SELECT
      COALESCE(c.nombre, 'Sin categoría')::text AS label,
      COUNT(DISTINCT l.arreglo_id)::int AS cantidad,
      COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.categorias_arreglo c ON c.id = l.cat_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto,
           ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn
    FROM agg
  ),
  top_rows AS (
    SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto
    FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.label, s.cantidad, s.monto
  FROM (
    SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows
    UNION ALL
    SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$function$;
