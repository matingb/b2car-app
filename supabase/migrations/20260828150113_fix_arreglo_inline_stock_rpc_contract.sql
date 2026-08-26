-- La migración de finanzas cambió rpc_crear_operacion_con_stock para recibir
-- p_tipo text, p_cuenta_id y delta_cantidad explícito. Los helpers de
-- repuestos inline conservaban el contrato anterior (enum + delta implícito),
-- por lo que fallaban al resolver la función o no aumentaban el stock.

DROP FUNCTION IF EXISTS public._crear_repuestos_nuevos_para_arreglo(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.rpc_crear_producto_inline_para_arreglo(
  uuid, uuid, text, text, numeric, numeric, integer, uuid, uuid
);

CREATE FUNCTION public.rpc_crear_producto_inline_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_codigo text,
  p_nombre text,
  p_precio_compra numeric,
  p_precio_venta numeric,
  p_cantidad integer,
  p_categoria_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL
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
    p_cuenta_id := p_cuenta_id
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
  uuid, uuid, text, text, numeric, numeric, integer, uuid, uuid, uuid
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(
  uuid, uuid, text, text, numeric, numeric, integer, uuid, uuid, uuid
) TO authenticated;

CREATE FUNCTION public._crear_repuestos_nuevos_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_repuestos_nuevos jsonb,
  p_cuenta_id uuid DEFAULT NULL
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
      p_cantidad := (v_item ->> 'cantidad')::integer,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid,
      p_cuenta_id := p_cuenta_id
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._crear_repuestos_nuevos_para_arreglo(uuid, uuid, jsonb, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public._crear_repuestos_nuevos_para_arreglo(uuid, uuid, jsonb, uuid)
  TO authenticated;

-- El flujo de reposición de un repuesto existente comparte el mismo contrato
-- de compra: tipo text y delta explícito.
CREATE OR REPLACE FUNCTION public.rpc_asignar_repuesto_existente_con_compra(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_stock_id uuid,
  p_cantidad integer,
  p_monto_unitario numeric,
  p_precio_compra numeric DEFAULT NULL,
  p_categoria_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL
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
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario inválido'; END IF;

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
    IF p_precio_compra IS NULL OR p_precio_compra <= 0 THEN
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
      p_fecha := v_arreglo_fecha
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

-- Conserva la firma pública de creación de arreglos y pasa la cuenta ya
-- validada por la API hacia cada compra inline.
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
  p_idempotency_key uuid DEFAULT NULL
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
  IF COALESCE(p_esta_pago, false) AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para registrar el cobro' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_esta_pago, false) AND p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key requerido para registrar el cobro' USING ERRCODE = '22023';
  END IF;

  p_detalles := COALESCE(p_detalles, '[]'::jsonb);
  p_repuestos := COALESCE(p_repuestos, '[]'::jsonb);
  p_repuestos_nuevos := COALESCE(p_repuestos_nuevos, '[]'::jsonb);

  IF jsonb_typeof(p_detalles) <> 'array' THEN RAISE EXCEPTION 'detalles debe ser array'; END IF;
  IF jsonb_typeof(p_repuestos) <> 'array' THEN RAISE EXCEPTION 'repuestos debe ser array'; END IF;
  IF jsonb_typeof(p_repuestos_nuevos) <> 'array' THEN RAISE EXCEPTION 'repuestos_nuevos debe ser array'; END IF;
  IF jsonb_array_length(p_repuestos_nuevos) > 0 AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para registrar la compra automática' USING ERRCODE = '22023';
  END IF;

  PERFORM public._check_codigos_unicos_en_array(p_repuestos_nuevos);

  v_arreglo_id := public._insert_arreglo_base(
    p_vehiculo_id := p_vehiculo_id,
    p_taller_id := p_taller_id,
    p_estado := p_estado,
    p_descripcion := p_descripcion,
    p_kilometraje_leido := p_kilometraje_leido,
    p_fecha := p_fecha,
    p_observaciones := p_observaciones,
    p_precio_final := p_precio_final,
    p_precio_sin_iva := p_precio_sin_iva,
    p_esta_pago := false,
    p_extra_data := p_extra_data
  );

  PERFORM public._insert_detalles_arreglo(v_arreglo_id, p_detalles);
  PERFORM public._insert_detalle_form_custom(v_arreglo_id, p_detalle_formulario);
  PERFORM public._asignar_repuestos_existentes_a_arreglo(v_arreglo_id, p_taller_id, p_repuestos);
  PERFORM public._crear_repuestos_nuevos_para_arreglo(
    v_arreglo_id,
    p_taller_id,
    p_repuestos_nuevos,
    p_cuenta_id
  );

  UPDATE public.arreglos
  SET precio_final = COALESCE(p_precio_final, precio_final),
      precio_sin_iva = COALESCE(p_precio_sin_iva, precio_sin_iva),
      updated_at = now()
  WHERE id = v_arreglo_id;

  IF COALESCE(p_esta_pago, false) THEN
    PERFORM public.rpc_finanzas_cobrar_arreglo(
      p_arreglo_id := v_arreglo_id,
      p_cuenta_id := p_cuenta_id,
      p_monto := COALESCE(p_precio_final, 0),
      p_fecha_cobro := COALESCE(p_fecha_cobro, p_fecha),
      p_descripcion := 'Cobro inicial del arreglo',
      p_idempotency_key := p_idempotency_key
    );
  END IF;

  RETURN v_arreglo_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
