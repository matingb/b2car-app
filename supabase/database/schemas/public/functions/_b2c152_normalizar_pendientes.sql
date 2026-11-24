CREATE FUNCTION public._b2c152_normalizar_pendientes (
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

REVOKE ALL ON FUNCTION public._b2c152_normalizar_pendientes(jsonb, jsonb, uuid, uuid, uuid) FROM PUBLIC;
