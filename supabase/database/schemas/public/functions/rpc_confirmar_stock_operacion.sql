CREATE FUNCTION public.rpc_confirmar_stock_operacion (
  p_operacion_id uuid,
  p_fecha        timestamp with time zone DEFAULT now(),
  p_lineas       jsonb                    DEFAULT NULL::jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id        uuid := public.current_tenant_id();
  v_op               record;
  v_linea            record;
  v_item             jsonb;
  v_item_linea_id    uuid;
  v_item_stock_id    uuid;
  v_item_cant        int;
  v_pendiente        int;
  v_confirmar        int;
  v_confirmadas      int := 0;
  v_fecha            timestamp with time zone := COALESCE(p_fecha, now());
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT id, tipo, taller_id, estado_stock
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_op.tipo NOT IN ('COMPRA', 'VENTA') THEN
    RAISE EXCEPTION 'Solo se puede confirmar stock de compras o ventas' USING ERRCODE = '22023';
  END IF;

  -- CASO 1: Confirmación global (entrega total del remanente pendiente)
  IF p_lineas IS NULL OR jsonb_array_length(p_lineas) = 0 THEN
    FOR v_linea IN
      SELECT ol.id, ol.stock_id, ol.cantidad, ol.cantidad_cumplida, ol.cantidad_cancelada, ol.sentido
      FROM public.operaciones_lineas ol
      WHERE ol.operacion_id = p_operacion_id
      ORDER BY ol.stock_id
      FOR UPDATE
    LOOP
      v_pendiente := v_linea.cantidad - v_linea.cantidad_cumplida - v_linea.cantidad_cancelada;
      IF v_pendiente <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant_id, p_operacion_id, v_linea.id, v_linea.stock_id,
        v_linea.sentido * v_pendiente,
        v_fecha,
        CASE WHEN v_op.tipo = 'COMPRA' THEN 'Recepción de Compra' ELSE 'Entrega de Venta' END
      );

      v_confirmadas := v_confirmadas + v_pendiente;
    END LOOP;

  -- CASO 2: Confirmación parcial por líneas
  ELSE
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas)
    LOOP
      v_item_linea_id := (v_item ->> 'linea_id')::uuid;
      v_item_stock_id := (v_item ->> 'stock_id')::uuid;
      v_item_cant     := (v_item ->> 'cantidad')::int;

      IF v_item_cant IS NULL OR v_item_cant <= 0 THEN
        CONTINUE;
      END IF;

      IF v_item_linea_id IS NOT NULL THEN
        SELECT ol.id, ol.stock_id, ol.cantidad, ol.cantidad_cumplida, ol.cantidad_cancelada, ol.sentido
        INTO v_linea
        FROM public.operaciones_lineas ol
        WHERE ol.id = v_item_linea_id AND ol.operacion_id = p_operacion_id
        FOR UPDATE;
      ELSE
        SELECT ol.id, ol.stock_id, ol.cantidad, ol.cantidad_cumplida, ol.cantidad_cancelada, ol.sentido
        INTO v_linea
        FROM public.operaciones_lineas ol
        WHERE ol.stock_id = v_item_stock_id AND ol.operacion_id = p_operacion_id
        ORDER BY ol.id
        LIMIT 1
        FOR UPDATE;
      END IF;

      IF v_linea.id IS NULL THEN
        RAISE EXCEPTION 'Línea de operación no encontrada' USING ERRCODE = 'P0002';
      END IF;

      v_pendiente := v_linea.cantidad - v_linea.cantidad_cumplida - v_linea.cantidad_cancelada;
      v_confirmar := LEAST(v_pendiente, v_item_cant);

      IF v_confirmar <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant_id, p_operacion_id, v_linea.id, v_linea.stock_id,
        v_linea.sentido * v_confirmar,
        v_fecha,
        CASE WHEN v_op.tipo = 'COMPRA' THEN 'Recepción parcial de Compra' ELSE 'Entrega parcial de Venta' END
      );

      v_confirmadas := v_confirmadas + v_confirmar;
    END LOOP;
  END IF;

  SELECT estado_stock INTO v_op.estado_stock FROM public.operaciones WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'estado_stock', v_op.estado_stock,
    'unidades_confirmadas', v_confirmadas
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_confirmar_stock_operacion(uuid, timestamp WITH time zone, jsonb) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_confirmar_stock_operacion(uuid, timestamp WITH time zone, jsonb) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_confirmar_stock_operacion(uuid, timestamp WITH time zone, jsonb) TO service_role;