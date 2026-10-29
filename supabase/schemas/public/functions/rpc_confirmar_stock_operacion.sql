DROP FUNCTION IF EXISTS public.rpc_confirmar_stock_operacion(uuid, timestamp with time zone);
DROP FUNCTION IF EXISTS public.rpc_confirmar_stock_operacion(uuid, timestamp with time zone, jsonb);

CREATE OR REPLACE FUNCTION public.rpc_confirmar_stock_operacion (
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
  v_total_pactadas   int := 0;
  v_total_cumplidas  int := 0;
  v_saldo_ant        int;
  v_saldo_post       int;
  v_producto_id      uuid;
  v_nuevo_estado     public.estado_stock_operacion;
BEGIN
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

  IF v_op.estado_stock = 'ENTREGADO' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'operacion_id', p_operacion_id,
      'estado_stock', 'ENTREGADO',
      'unidades_confirmadas', 0,
      'mensaje', 'El stock de esta operación ya se encontraba entregado'
    );
  END IF;

  IF p_lineas IS NULL OR jsonb_array_length(p_lineas) = 0 THEN
    -- Confirmar todo lo pendiente en todas las líneas
    FOR v_linea IN
      SELECT id, stock_id, cantidad, cantidad_cumplida
      FROM public.operaciones_lineas
      WHERE operacion_id = p_operacion_id
      FOR UPDATE
    LOOP
      v_pendiente := v_linea.cantidad - v_linea.cantidad_cumplida;
      IF v_pendiente > 0 THEN
        SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
        FROM public.stocks s
        WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id
        FOR UPDATE;

        IF v_op.tipo = 'COMPRA' THEN
          v_saldo_post := v_saldo_ant + v_pendiente;
          UPDATE public.stocks AS s
          SET cantidad = v_saldo_post,
              cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_pendiente),
              updated_at = now()
          WHERE s.id = v_linea.stock_id;

          PERFORM public._stock_ledger_insertar(
            v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
            'COMPRA', v_pendiente, v_saldo_ant, v_saldo_post,
            COALESCE(p_fecha, now()), 'Recepción diferida de Compra #' || substr(p_operacion_id::text, 1, 8)
          );

        ELSIF v_op.tipo = 'VENTA' THEN
          IF v_saldo_ant < v_pendiente THEN
            RAISE EXCEPTION 'Stock físico insuficiente en taller para entregar la venta diferida' USING ERRCODE = 'P0001';
          END IF;

          v_saldo_post := v_saldo_ant - v_pendiente;
          UPDATE public.stocks AS s
          SET cantidad = v_saldo_post,
              cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_pendiente),
              updated_at = now()
          WHERE s.id = v_linea.stock_id;

          PERFORM public._stock_ledger_insertar(
            v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
            'VENTA', -v_pendiente, v_saldo_ant, v_saldo_post,
            COALESCE(p_fecha, now()), 'Entrega diferida de Venta #' || substr(p_operacion_id::text, 1, 8)
          );
        END IF;

        UPDATE public.operaciones_lineas
        SET cantidad_cumplida = cantidad,
            delta_cantidad = CASE WHEN v_op.tipo = 'VENTA' THEN -cantidad ELSE cantidad END
        WHERE id = v_linea.id;

        v_confirmadas := v_confirmadas + v_pendiente;
      END IF;
    END LOOP;

  ELSE
    -- Confirmación selectiva o parcial por línea
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas)
    LOOP
      v_item_linea_id := NULL;
      v_item_stock_id := NULL;

      IF (v_item->>'linea_id') IS NOT NULL AND (v_item->>'linea_id') <> '' THEN
        v_item_linea_id := (v_item->>'linea_id')::uuid;
      END IF;
      IF (v_item->>'stock_id') IS NOT NULL AND (v_item->>'stock_id') <> '' THEN
        v_item_stock_id := (v_item->>'stock_id')::uuid;
      END IF;

      v_item_cant := COALESCE((v_item->>'cantidad')::int, 0);

      IF v_item_cant < 0 THEN
        RAISE EXCEPTION 'La cantidad a confirmar no puede ser negativa' USING ERRCODE = '22023';
      END IF;

      IF v_item_cant = 0 THEN
        CONTINUE;
      END IF;

      SELECT id, stock_id, cantidad, cantidad_cumplida
      INTO v_linea
      FROM public.operaciones_lineas
      WHERE operacion_id = p_operacion_id
        AND (
          (v_item_linea_id IS NOT NULL AND id = v_item_linea_id) OR
          (v_item_linea_id IS NULL AND v_item_stock_id IS NOT NULL AND stock_id = v_item_stock_id)
        )
      LIMIT 1
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Línea de operación no encontrada' USING ERRCODE = 'P0002';
      END IF;

      v_pendiente := v_linea.cantidad - v_linea.cantidad_cumplida;
      IF v_item_cant > v_pendiente THEN
        RAISE EXCEPTION 'La cantidad a confirmar (%) excede el remanente pendiente (%)', v_item_cant, v_pendiente USING ERRCODE = '22023';
      END IF;

      v_confirmar := v_item_cant;

      SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
      FROM public.stocks s
      WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id
      FOR UPDATE;

      IF v_op.tipo = 'COMPRA' THEN
        v_saldo_post := v_saldo_ant + v_confirmar;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_confirmar),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'COMPRA', v_confirmar, v_saldo_ant, v_saldo_post,
          COALESCE(p_fecha, now()), 'Recepción parcial de Compra #' || substr(p_operacion_id::text, 1, 8)
        );

      ELSIF v_op.tipo = 'VENTA' THEN
        IF v_saldo_ant < v_confirmar THEN
          RAISE EXCEPTION 'Stock físico insuficiente en taller para entregar unidades solicitadas' USING ERRCODE = 'P0001';
        END IF;

        v_saldo_post := v_saldo_ant - v_confirmar;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_confirmar),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'VENTA', -v_confirmar, v_saldo_ant, v_saldo_post,
          COALESCE(p_fecha, now()), 'Entrega parcial de Venta #' || substr(p_operacion_id::text, 1, 8)
        );
      END IF;

      UPDATE public.operaciones_lineas
      SET cantidad_cumplida = cantidad_cumplida + v_confirmar,
          delta_cantidad = CASE WHEN v_op.tipo = 'VENTA' THEN -(cantidad_cumplida + v_confirmar) ELSE (cantidad_cumplida + v_confirmar) END
      WHERE id = v_linea.id;

      v_confirmadas := v_confirmadas + v_confirmar;
    END LOOP;
  END IF;

  -- Recalcular estado_stock de la operación
  SELECT coalesce(sum(cantidad), 0), coalesce(sum(cantidad_cumplida), 0)
  INTO v_total_pactadas, v_total_cumplidas
  FROM public.operaciones_lineas
  WHERE operacion_id = p_operacion_id;

  IF v_total_cumplidas >= v_total_pactadas AND v_total_pactadas > 0 THEN
    v_nuevo_estado := 'ENTREGADO'::public.estado_stock_operacion;
  ELSIF v_total_cumplidas > 0 THEN
    v_nuevo_estado := 'PARCIAL'::public.estado_stock_operacion;
  ELSE
    v_nuevo_estado := 'PENDIENTE'::public.estado_stock_operacion;
  END IF;

  UPDATE public.operaciones
  SET estado_stock = v_nuevo_estado
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'estado_stock', v_nuevo_estado,
    'unidades_confirmadas', v_confirmadas,
    'total_cumplidas', v_total_cumplidas,
    'total_pactadas', v_total_pactadas
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_confirmar_stock_operacion TO "anon", "authenticated", "service_role", "postgres";
