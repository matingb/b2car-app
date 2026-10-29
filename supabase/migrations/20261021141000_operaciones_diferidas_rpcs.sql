-- Migración: RPCs para Operaciones Diferidas (Stock y Pagos Desacoplados)
-- 1. Actualizar rpc_crear_operacion_con_stock
-- 2. Crear rpc_confirmar_stock_operacion
-- 3. Crear rpc_registrar_pago_operacion
-- 4. Actualizar rpc_borrar_operacion_con_stock
-- 5. Actualizar rpc_listar_operaciones_con_gastos

-- ============================================================================
-- 1. rpc_crear_operacion_con_stock
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean);

CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock (
  p_tipo            text,
  p_taller_id       uuid,
  p_lineas          jsonb,
  p_arreglo_id      uuid                     DEFAULT NULL::uuid,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_idempotency_key uuid                     DEFAULT NULL::uuid,
  p_observaciones   text                     DEFAULT NULL::text,
  p_estado_pago     text                     DEFAULT NULL::text,
  p_monto_inicial   numeric                  DEFAULT NULL::numeric,
  p_mover_stock     boolean                  DEFAULT true
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id        uuid := public.current_tenant_id();
  v_tipo             public.tipo_operacion;
  v_operacion_id     uuid;
  v_linea            jsonb;
  v_stock_id         uuid;
  v_cantidad         int;
  v_monto_unitario   numeric;
  v_delta_cantidad   int;
  v_cantidad_cumpl   int;
  v_importe          numeric := 0;
  v_rowcount         int;
  v_mover_stock      boolean := COALESCE(p_mover_stock, true);
  v_estado_pago      public.estado_pago_operacion;
  v_monto_pago       numeric := 0;
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

  -- Resolver estado de pago inicial
  IF p_estado_pago IS NOT NULL THEN
    v_estado_pago := upper(p_estado_pago)::public.estado_pago_operacion;
  ELSIF p_cuenta_id IS NOT NULL THEN
    v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSE
    v_estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
  END IF;

  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;

  -- Insertar operación inicial
  INSERT INTO public.operaciones (
    tenant_id, tipo, taller_id, fecha, observaciones,
    estado_pago,
    estado_stock
  )
  VALUES (
    v_tenant_id, v_tipo, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''),
    v_estado_pago,
    CASE
      WHEN v_tipo NOT IN ('COMPRA', 'VENTA') THEN 'ENTREGADO'::public.estado_stock_operacion
      WHEN v_mover_stock THEN 'ENTREGADO'::public.estado_stock_operacion
      ELSE 'PENDIENTE'::public.estado_stock_operacion
    END
  )
  RETURNING id INTO v_operacion_id;

  IF p_arreglo_id IS NOT NULL AND v_tipo = 'ASIGNACION_ARREGLO' THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  END IF;

  -- Procesar líneas de producto
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

    -- Movimientos de stock según tipo y diferimiento
    IF v_tipo = 'COMPRA' THEN
      IF v_mover_stock THEN
        v_cantidad_cumpl := v_cantidad;
        UPDATE public.stocks AS s
        SET cantidad = s.cantidad + v_cantidad,
            updated_at = now()
        WHERE s.id = v_stock_id
          AND s.tenant_id = v_tenant_id
          AND s.taller_id = p_taller_id;
      ELSE
        -- Compra diferida: queda en camino (pendiente)
        v_cantidad_cumpl := 0;
        UPDATE public.stocks AS s
        SET cantidad_pendiente = s.cantidad_pendiente + v_cantidad,
            updated_at = now()
        WHERE s.id = v_stock_id
          AND s.tenant_id = v_tenant_id
          AND s.taller_id = p_taller_id;
      END IF;

    ELSIF v_tipo = 'VENTA' THEN
      IF v_mover_stock THEN
        v_cantidad_cumpl := v_cantidad;
        UPDATE public.stocks AS s
        SET cantidad = s.cantidad - v_cantidad,
            updated_at = now()
        WHERE s.id = v_stock_id
          AND s.tenant_id = v_tenant_id
          AND s.taller_id = p_taller_id
          AND s.cantidad >= v_cantidad;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount = 0 THEN
          RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
        END IF;
      ELSE
        -- Venta diferida: queda reservada en taller
        v_cantidad_cumpl := 0;
        UPDATE public.stocks AS s
        SET cantidad_reservada = s.cantidad_reservada + v_cantidad,
            updated_at = now()
        WHERE s.id = v_stock_id
          AND s.tenant_id = v_tenant_id
          AND s.taller_id = p_taller_id
          AND (s.cantidad - s.cantidad_reservada) >= v_cantidad;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount = 0 THEN
          RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
        END IF;
      END IF;

    ELSE
      -- ASIGNACION_ARREGLO u otros movimientos directos
      v_cantidad_cumpl := v_cantidad;
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
    END IF;

    INSERT INTO public.operaciones_lineas (
      operacion_id,
      stock_id,
      cantidad,
      cantidad_cumplida,
      monto_unitario,
      delta_cantidad
    )
    VALUES (
      v_operacion_id,
      v_stock_id,
      v_cantidad,
      v_cantidad_cumpl,
      v_monto_unitario,
      CASE WHEN v_mover_stock THEN v_delta_cantidad ELSE 0 END
    );

    v_importe := v_importe + (v_cantidad * v_monto_unitario);
  END LOOP;

  -- Actualizar monto total en la operación
  UPDATE public.operaciones
  SET monto_total = v_importe
  WHERE id = v_operacion_id;

  -- Validaciones financieras según estado_pago
  IF v_tipo IN ('COMPRA', 'VENTA') AND v_importe > 0 THEN
    IF v_estado_pago = 'PAGADO' THEN
      IF p_cuenta_id IS NULL THEN
        RAISE EXCEPTION 'CUENTA_FINANCIERA_REQUERIDA: cuenta financiera requerida para compras y ventas con pago inmediato'
          USING ERRCODE = '22023';
      END IF;
      v_monto_pago := v_importe;

    ELSIF v_estado_pago = 'PARCIAL' THEN
      IF p_cuenta_id IS NULL THEN
        RAISE EXCEPTION 'CUENTA_FINANCIERA_REQUERIDA: cuenta financiera requerida para pago parcial'
          USING ERRCODE = '22023';
      END IF;
      IF p_monto_inicial IS NULL OR p_monto_inicial <= 0 THEN
        RAISE EXCEPTION 'Monto inicial requerido y debe ser mayor a 0 para pago parcial'
          USING ERRCODE = '22023';
      END IF;
      IF p_monto_inicial > v_importe THEN
        RAISE EXCEPTION 'Monto inicial no puede superar el total de la operación'
          USING ERRCODE = '22023';
      END IF;
      v_monto_pago := p_monto_inicial;

    ELSE
      -- PENDIENTE: no requiere cuenta ni pago inicial
      v_monto_pago := 0;
    END IF;

    -- Registrar movimiento en ledger y en operaciones_pagos si hay monto pagado
    IF v_monto_pago > 0 AND p_cuenta_id IS NOT NULL THEN
      PERFORM public._ledger_insertar(
        v_operacion_id,
        v_tenant_id,
        p_cuenta_id,
        CASE WHEN v_tipo = 'COMPRA' THEN -v_monto_pago ELSE v_monto_pago END,
        COALESCE(p_fecha, now())
      );

      INSERT INTO public.operaciones_pagos (
        tenant_id,
        operacion_id,
        cuenta_financiera_id,
        monto,
        fecha,
        descripcion
      )
      VALUES (
        v_tenant_id,
        v_operacion_id,
        p_cuenta_id,
        v_monto_pago,
        COALESCE(p_fecha, now()),
        CASE
          WHEN v_tipo = 'COMPRA' AND v_estado_pago = 'PARCIAL' THEN 'Pago inicial parcial de compra'
          WHEN v_tipo = 'COMPRA' THEN 'Pago de compra'
          WHEN v_tipo = 'VENTA' AND v_estado_pago = 'PARCIAL' THEN 'Cobro inicial parcial de venta'
          ELSE 'Cobro de venta'
        END
      );
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean) TO authenticated, service_role;

-- Adaptador para firma legacy de 8 argumentos
CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock (
  p_tipo            text,
  p_taller_id       uuid,
  p_lineas          jsonb,
  p_arreglo_id      uuid                     DEFAULT NULL::uuid,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_idempotency_key uuid                     DEFAULT NULL::uuid,
  p_observaciones   text                     DEFAULT NULL::text
)
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
  SELECT public.rpc_crear_operacion_con_stock(
    p_tipo, p_taller_id, p_lineas, p_arreglo_id, p_fecha, p_cuenta_id, p_idempotency_key, p_observaciones,
    NULL, NULL, true
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text) TO authenticated, service_role;


-- ============================================================================
-- 2. rpc_confirmar_stock_operacion
-- ============================================================================
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
  v_confirmadas      int := 0;
  v_total_pactadas   int := 0;
  v_total_cumplidas  int := 0;
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
        IF v_op.tipo = 'COMPRA' THEN
          UPDATE public.stocks AS s
          SET cantidad = s.cantidad + v_pendiente,
              cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_pendiente),
              updated_at = now()
          WHERE s.id = v_linea.stock_id
            AND s.tenant_id = v_tenant_id;

        ELSIF v_op.tipo = 'VENTA' THEN
          IF (SELECT s.cantidad FROM public.stocks s WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id) < v_pendiente THEN
            RAISE EXCEPTION 'Stock físico insuficiente en taller para entregar la venta diferida' USING ERRCODE = 'P0001';
          END IF;

          UPDATE public.stocks AS s
          SET cantidad = s.cantidad - v_pendiente,
              cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_pendiente),
              updated_at = now()
          WHERE s.id = v_linea.stock_id
            AND s.tenant_id = v_tenant_id;
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
        RAISE EXCEPTION 'Línea de operación no encontrada para confirmar stock' USING ERRCODE = 'P0002';
      END IF;

      v_pendiente := v_linea.cantidad - v_linea.cantidad_cumplida;
      IF v_item_cant > v_pendiente THEN
        RAISE EXCEPTION 'La cantidad a confirmar (%) excede el remanente pendiente (%)', v_item_cant, v_pendiente USING ERRCODE = '22023';
      END IF;

      IF v_op.tipo = 'COMPRA' THEN
        -- Recepción parcial:
        UPDATE public.stocks AS s
        SET cantidad = s.cantidad + v_item_cant,
            cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_item_cant),
            updated_at = now()
        WHERE s.id = v_linea.stock_id
          AND s.tenant_id = v_tenant_id;

      ELSIF v_op.tipo = 'VENTA' THEN
        -- Entrega parcial:
        IF (SELECT s.cantidad FROM public.stocks s WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id) < v_item_cant THEN
          RAISE EXCEPTION 'Stock físico insuficiente en taller para entregar la venta' USING ERRCODE = 'P0001';
        END IF;

        UPDATE public.stocks AS s
        SET cantidad = s.cantidad - v_item_cant,
            cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_item_cant),
            updated_at = now()
        WHERE s.id = v_linea.stock_id
          AND s.tenant_id = v_tenant_id;
      END IF;

      UPDATE public.operaciones_lineas
      SET cantidad_cumplida = cantidad_cumplida + v_item_cant,
          delta_cantidad = CASE WHEN v_op.tipo = 'VENTA' THEN -(cantidad_cumplida + v_item_cant) ELSE (cantidad_cumplida + v_item_cant) END
      WHERE id = v_linea.id;

      v_confirmadas := v_confirmadas + v_item_cant;
    END LOOP;
  END IF;

  -- Recalcular estado_stock de la operación
  SELECT COALESCE(SUM(cantidad), 0), COALESCE(SUM(cantidad_cumplida), 0)
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

REVOKE ALL ON FUNCTION public.rpc_confirmar_stock_operacion(uuid, timestamp with time zone, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_confirmar_stock_operacion(uuid, timestamp with time zone, jsonb) TO authenticated, service_role;


-- ============================================================================
-- 3. rpc_registrar_pago_operacion
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_registrar_pago_operacion (
  p_operacion_id       uuid,
  p_cuenta_id          uuid,
  p_monto              numeric,
  p_fecha              timestamp with time zone DEFAULT now(),
  p_descripcion        text                     DEFAULT NULL::text,
  p_idempotency_key    uuid                     DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id          uuid := public.current_tenant_id();
  v_op                 record;
  v_pago_existente     record;
  v_saldo_pendiente    numeric;
  v_pago_operacion_id  uuid;
  v_monto_pago         numeric;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificar una cuenta financiera' USING ERRCODE = '22023';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a 0' USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

  -- Idempotencia
  IF p_idempotency_key IS NOT NULL THEN
    SELECT op.id, op.operacion_id, op.monto
    INTO v_pago_existente
    FROM public.operaciones_pagos op
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = op.operacion_pago_id
    WHERE op.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;

    IF v_pago_existente.id IS NOT NULL THEN
      SELECT monto_total, total_pagado, esta_pago, estado_pago
      INTO v_op FROM public.operaciones WHERE id = p_operacion_id;

      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'total_pagado', v_op.total_pagado,
        'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
        'esta_pago', v_op.esta_pago,
        'estado_pago', v_op.estado_pago
      );
    END IF;
  END IF;

  SELECT id, tipo, monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  v_saldo_pendiente := GREATEST(0, COALESCE(v_op.monto_total, 0) - COALESCE(v_op.total_pagado, 0));
  IF v_saldo_pendiente <= 0 THEN
    RAISE EXCEPTION 'Esta operación ya se encuentra totalmente saldada' USING ERRCODE = '22023';
  END IF;

  IF p_monto > v_saldo_pendiente THEN
    RAISE EXCEPTION 'El monto ingresado ($%) supera el saldo pendiente ($%)', p_monto, v_saldo_pendiente
      USING ERRCODE = '22023';
  END IF;

  v_monto_pago := p_monto;

  -- Crear operación de movimiento financiero de cuenta
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha, now()))
  RETURNING id INTO v_pago_operacion_id;

  INSERT INTO public.operaciones_movimiento_cuenta (
    operacion_id, tenant_id, subtipo, cuenta_id, importe,
    descripcion, idempotency_key, created_by
  )
  VALUES (
    v_pago_operacion_id,
    v_tenant_id,
    CASE WHEN v_op.tipo = 'VENTA' THEN 'INGRESO' ELSE 'GASTO' END,
    p_cuenta_id,
    CASE WHEN v_op.tipo = 'VENTA' THEN v_monto_pago ELSE -v_monto_pago END,
    COALESCE(
      NULLIF(btrim(p_descripcion), ''),
      CASE
        WHEN v_op.tipo = 'VENTA' THEN 'Cobro de venta diferida'
        WHEN v_op.tipo = 'COMPRA' THEN 'Pago de compra diferida'
        ELSE 'Pago de operación'
      END
    ),
    p_idempotency_key,
    auth.uid()
  );

  -- Vincular en operaciones_pagos (el trigger recalcula total_pagado, esta_pago y estado_pago)
  INSERT INTO public.operaciones_pagos (
    tenant_id,
    operacion_id,
    operacion_pago_id,
    cuenta_financiera_id,
    monto,
    fecha,
    descripcion,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_operacion_id,
    v_pago_operacion_id,
    p_cuenta_id,
    v_monto_pago,
    COALESCE(p_fecha, now()),
    NULLIF(btrim(p_descripcion), ''),
    auth.uid()
  );

  -- Leer estado resultante actualizado
  SELECT monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'pago_operacion_id', v_pago_operacion_id,
    'monto_registrado', v_monto_pago,
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_registrar_pago_operacion(uuid, uuid, numeric, timestamp with time zone, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_pago_operacion(uuid, uuid, numeric, timestamp with time zone, text, uuid) TO authenticated, service_role;


-- ============================================================================
-- 4. rpc_borrar_operacion_con_stock
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock (
  p_operacion_id    uuid,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id       uuid := public.current_tenant_id();
  v_operacion       record;
  v_linea           record;
  v_mov             record;
  v_cleanup_previo  text := current_setting('app.finanzas_tenant_cleanup', true);
  v_actualizadas    int;
  v_pendiente_linea int;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT o.id, o.tipo, o.estado_stock
  INTO v_operacion
  FROM public.operaciones AS o
  WHERE o.id = p_operacion_id
    AND o.tenant_id = v_tenant_id
    AND o.tipo <> 'MOVIMIENTO_CUENTA'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Revertir stock según lo efectivamente cumplido vs lo pendiente/reservado
  FOR v_linea IN
    SELECT l.stock_id, l.cantidad, l.cantidad_cumplida, l.delta_cantidad
    FROM public.operaciones_lineas AS l
    WHERE l.operacion_id = p_operacion_id
  LOOP
    IF v_operacion.tipo = 'COMPRA' THEN
      -- Revertir lo ingresado físicamente
      IF v_linea.cantidad_cumplida > 0 THEN
        UPDATE public.stocks AS s
        SET cantidad = s.cantidad - v_linea.cantidad_cumplida
        WHERE s.id = v_linea.stock_id
          AND s.tenant_id = v_tenant_id
          AND s.cantidad >= v_linea.cantidad_cumplida;
        GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
        IF v_actualizadas = 0 THEN
          RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_linea.stock_id USING ERRCODE = 'P0001';
        END IF;
      END IF;

      -- Revertir lo que estaba pendiente en camino
      v_pendiente_linea := v_linea.cantidad - v_linea.cantidad_cumplida;
      IF v_pendiente_linea > 0 THEN
        UPDATE public.stocks AS s
        SET cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_pendiente_linea)
        WHERE s.id = v_linea.stock_id
          AND s.tenant_id = v_tenant_id;
      END IF;

    ELSIF v_operacion.tipo = 'VENTA' THEN
      -- Revertir lo egresado físicamente
      IF v_linea.cantidad_cumplida > 0 THEN
        UPDATE public.stocks AS s
        SET cantidad = s.cantidad + v_linea.cantidad_cumplida
        WHERE s.id = v_linea.stock_id
          AND s.tenant_id = v_tenant_id;
      END IF;

      -- Revertir lo que estaba reservado
      v_pendiente_linea := v_linea.cantidad - v_linea.cantidad_cumplida;
      IF v_pendiente_linea > 0 THEN
        UPDATE public.stocks AS s
        SET cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_pendiente_linea)
        WHERE s.id = v_linea.stock_id
          AND s.tenant_id = v_tenant_id;
      END IF;

    ELSE
      -- ASIGNACION_ARREGLO u otros
      UPDATE public.stocks AS s
      SET cantidad = s.cantidad - v_linea.delta_cantidad
      WHERE s.id = v_linea.stock_id
        AND s.tenant_id = v_tenant_id
        AND (v_linea.delta_cantidad <= 0 OR s.cantidad >= v_linea.delta_cantidad);
    END IF;
  END LOOP;

  -- Reversar asientos del ledger asociados directamente o por pagos
  FOR v_mov IN
    SELECT m.cuenta_financiera_id, m.importe
    FROM public.movimientos_financieros AS m
    WHERE m.operacion_id = p_operacion_id
      AND m.tenant_id = v_tenant_id
  LOOP
    PERFORM public._ledger_insertar(
      NULL,
      v_tenant_id,
      v_mov.cuenta_financiera_id,
      -v_mov.importe,
      now()
    );
  END LOOP;

  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);
  DELETE FROM public.operaciones
  WHERE id = p_operacion_id
    AND tenant_id = v_tenant_id;
  PERFORM set_config(
    'app.finanzas_tenant_cleanup',
    COALESCE(NULLIF(v_cleanup_previo, ''), 'off'),
    true
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) TO authenticated, service_role;


-- ============================================================================
-- 5. rpc_listar_operaciones_con_gastos
-- ============================================================================
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
    monto_total              numeric,
    total_pagado             numeric,
    saldo_pendiente          numeric,
    esta_pago                boolean,
    estado_pago              text,
    estado_stock             text,
    arreglo_id               uuid,
    total_count              bigint,
    observaciones            text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  WITH rows AS (
    SELECT
      o.id,
      CASE
        WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
        ELSE COALESCE(omc.subtipo, o.tipo::text)
      END AS tipo,
      o.taller_id, o.fecha, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id,
          'cantidad', l.cantidad, 'cantidad_cumplida', l.cantidad_cumplida,
          'monto_unitario', l.monto_unitario, 'delta_cantidad', l.delta_cantidad,
          'created_at', l.created_at, 'nombre', p.nombre, 'codigo', p.codigo
        ) ORDER BY l.created_at, l.id)
        FROM public.operaciones_lineas AS l
        LEFT JOIN public.stocks AS s ON s.id = l.stock_id
        LEFT JOIN public.productos AS p ON p.id = s.producto_id
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb) AS lineas,
      CASE WHEN omc.subtipo = 'GASTO' THEN o.id ELSE NULL END AS gasto_id,
      CASE
        WHEN o.tipo = 'ASIGNACION_ARREGLO' AND v.id IS NOT NULL THEN
          'Asignación · ' || TRIM(v.marca || ' ' || v.modelo) || ' (' || v.patente || ')'
        WHEN EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones d WHERE d.operacion_ajuste_id = o.id) THEN
          'Devolución por NC · ' || COALESCE((
            SELECT 'NC ' || COALESCE(n.numero_comprobante::text, n.id::text)
              || ' · Factura ' || COALESCE(f.numero_comprobante::text, f.id::text)
            FROM public.facturacion_nc_devoluciones d
            JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id
            JOIN public.facturas_electronicas f ON f.id = n.documento_asociado_id
            WHERE d.operacion_ajuste_id = o.id LIMIT 1
          ), '')
        ELSE omc.descripcion
      END AS descripcion,
      omc.categoria_gasto,
      COALESCE(omc.cuenta_id, omc.cuenta_origen_id, mf.cuenta_financiera_id) AS cuenta_financiera_id,
      COALESCE(cf_s.nombre, cf_o.nombre, cf_m.nombre) AS cuenta_financiera_nombre,
      COALESCE(
        abs(omc.importe),
        abs(mf.importe),
        o.monto_total,
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
      )::numeric AS monto,
      o.monto_total,
      o.total_pagado,
      GREATEST(0, COALESCE(o.monto_total, 0) - COALESCE(o.total_pagado, 0))::numeric AS saldo_pendiente,
      COALESCE(o.esta_pago, false) AS esta_pago,
      o.estado_pago::text AS estado_pago,
      o.estado_stock::text AS estado_stock,
      COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id,
      o.observaciones
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = o.id
    LEFT JOIN LATERAL (
      SELECT m.cuenta_financiera_id, m.importe
      FROM public.movimientos_financieros AS m
      WHERE m.operacion_id = o.id AND m.tenant_id = o.tenant_id
      ORDER BY m.created_at, m.id
      LIMIT 1
    ) AS mf ON true
    LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
    LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = o.id
    LEFT JOIN public.arreglos AS a ON a.id = COALESCE(oca.arreglo_id, oaa.arreglo_id)
    LEFT JOIN public.vehiculos AS v ON v.id = a.vehiculo_id
    LEFT JOIN public.cuentas_financieras AS cf_s ON cf_s.id = omc.cuenta_id
    LEFT JOIN public.cuentas_financieras AS cf_o ON cf_o.id = omc.cuenta_origen_id
    LEFT JOIN public.cuentas_financieras AS cf_m ON cf_m.id = mf.cuenta_financiera_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
  )
  SELECT
    r.id, r.tipo, r.taller_id, r.fecha, r.created_at, r.lineas, r.gasto_id, r.descripcion, r.categoria_gasto,
    r.cuenta_financiera_id, r.cuenta_financiera_nombre, r.monto,
    r.monto_total, r.total_pagado, r.saldo_pendiente, r.esta_pago, r.estado_pago, r.estado_stock,
    r.arreglo_id, COUNT(*) OVER() AS total_count, r.observaciones
  FROM rows AS r
  WHERE COALESCE(cardinality(p_tipos), 0) = 0 OR r.tipo = ANY(p_tipos)
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
$function$;

REVOKE ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO authenticated, service_role;
