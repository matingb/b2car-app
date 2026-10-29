-- ============================================================================
-- Migración: Códigos de error específicos para Stock y Reversiones
-- Asigna:
--   - SQLSTATE 55002: Falta de stock físico (ventas, consumos, entregas diferidas/parciales)
--   - SQLSTATE 55005: Reversión bloqueada por consumo previo (anulaciones de compras donde las unidades ya fueron consumidas o vendidas)
-- ============================================================================

-- 1. rpc_crear_operacion_con_stock (55002 en ventas y consumos sin stock suficiente)
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
  p_mover_stock     boolean                  DEFAULT true,
  p_proveedor_id    uuid                     DEFAULT NULL::uuid,
  p_cliente_id      uuid                     DEFAULT NULL::uuid,
  p_pagos           jsonb                    DEFAULT NULL::jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id         uuid := public.current_tenant_id();
  v_tipo              public.tipo_operacion;
  v_operacion_id      uuid;
  v_linea             jsonb;
  v_stock_id          uuid;
  v_producto_id       uuid;
  v_cantidad          int;
  v_monto_unitario    numeric;
  v_delta_cantidad    int;
  v_cantidad_cumpl    int;
  v_saldo_ant         int;
  v_saldo_post        int;
  v_importe           numeric := 0;
  v_rowcount          int;
  v_mover_stock       boolean := COALESCE(p_mover_stock, true);
  v_estado_pago       public.estado_pago_operacion;
  v_monto_pago        numeric := 0;
  v_estado_stock      public.estado_stock_operacion;
  v_signo             int := 0;
  v_total_cantidad    int := 0;
  v_total_cumplida    int := 0;
  v_tiene_pagos       boolean := false;
  v_pago              jsonb;
  v_pago_cuenta_id    uuid;
  v_pago_monto        numeric;
  v_pago_fecha        timestamp with time zone;
  v_pago_desc         text;
  v_monto_total_pagos numeric := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  BEGIN
    v_tipo := p_tipo::public.tipo_operacion;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'tipo de operación inválido: %', p_tipo USING ERRCODE = '22023';
  END;

  IF p_taller_id IS NULL THEN
    RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.talleres t
    WHERE t.id = p_taller_id AND t.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Taller no encontrado o no pertenece al tenant: %', p_taller_id USING ERRCODE = 'P0002';
  END IF;

  IF v_tipo = 'ASIGNACION_ARREGLO' AND p_arreglo_id IS NULL THEN
    RAISE EXCEPTION 'arreglo_id requerido para ASIGNACION_ARREGLO' USING ERRCODE = '22023';
  END IF;

  IF v_tipo IN ('VENTA', 'COMPRA') AND (p_lineas IS NULL OR jsonb_array_length(p_lineas) = 0) THEN
    RAISE EXCEPTION 'operación debe incluir al menos una línea' USING ERRCODE = '22023';
  END IF;

  v_tiene_pagos := (p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0);

  -- Resolver estado_pago inicial
  IF p_estado_pago IS NOT NULL THEN
    BEGIN
      v_estado_pago := p_estado_pago::public.estado_pago_operacion;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'estado_pago inválido: %', p_estado_pago USING ERRCODE = '22023';
    END;
  ELSE
    IF p_cuenta_id IS NOT NULL OR v_tiene_pagos THEN
      v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
    ELSE
      v_estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
    END IF;
  END IF;

  -- Calcular importe total
  FOR v_linea IN SELECT * FROM jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) LOOP
    v_cantidad := coalesce((v_linea->>'cantidad')::int, 0);
    v_monto_unitario := coalesce((v_linea->>'monto_unitario')::numeric, 0);
    v_importe := v_importe + (v_cantidad * v_monto_unitario);
  END LOOP;

  -- Crear cabecera de operación (estado_stock inicial provisional)
  INSERT INTO public.operaciones (
    tenant_id,
    tipo,
    taller_id,
    fecha,
    observaciones,
    estado_pago,
    total_pagado,
    esta_pago,
    estado_stock
  )
  VALUES (
    v_tenant_id,
    v_tipo,
    p_taller_id,
    COALESCE(p_fecha, now()),
    p_observaciones,
    v_estado_pago,
    0,
    false,
    'PENDIENTE'::public.estado_stock_operacion
  )
  RETURNING id INTO v_operacion_id;

  -- Asociar a cliente en tabla operaciones_venta
  IF v_tipo = 'VENTA' AND p_cliente_id IS NOT NULL THEN
    INSERT INTO public.operaciones_venta (operacion_id, tenant_id, cliente_id)
    VALUES (v_operacion_id, v_tenant_id, p_cliente_id);
  END IF;

  -- Asociar a proveedor en tabla operaciones_compra
  IF v_tipo = 'COMPRA' AND p_proveedor_id IS NOT NULL THEN
    INSERT INTO public.operaciones_compra (operacion_id, tenant_id, proveedor_id)
    VALUES (v_operacion_id, v_tenant_id, p_proveedor_id);
  END IF;

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

    v_total_cantidad := v_total_cantidad + v_cantidad;

    -- Determinar cantidad a cumplir físicamente
    IF v_linea ? 'cantidad_cumplida' AND (v_linea->>'cantidad_cumplida') IS NOT NULL THEN
      v_cantidad_cumpl := GREATEST(0, LEAST(v_cantidad, (v_linea->>'cantidad_cumplida')::int));
    ELSIF v_mover_stock THEN
      v_cantidad_cumpl := v_cantidad;
    ELSE
      v_cantidad_cumpl := 0;
    END IF;

    v_total_cumplida := v_total_cumplida + v_cantidad_cumpl;

    -- Obtener datos actuales del stock con bloqueo
    SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
    FROM public.stocks s
    WHERE s.id = v_stock_id AND s.tenant_id = v_tenant_id AND s.taller_id = p_taller_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock no encontrado: %', v_stock_id USING ERRCODE = 'P0002';
    END IF;

    -- Movimientos de stock según tipo y diferimiento/entrega parcial
    IF v_tipo = 'COMPRA' THEN
      IF v_cantidad_cumpl > 0 THEN
        v_saldo_post := v_saldo_ant + v_cantidad_cumpl;

        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            cantidad_pendiente = s.cantidad_pendiente + (v_cantidad - v_cantidad_cumpl),
            updated_at = now()
        WHERE s.id = v_stock_id;

        -- Registrar en Kardex de stock
        PERFORM public._stock_ledger_insertar(
          v_tenant_id, p_taller_id, v_producto_id, v_stock_id, v_operacion_id,
          'COMPRA', v_cantidad_cumpl, v_saldo_ant, v_saldo_post,
          COALESCE(p_fecha, now()), 'Ingreso de mercadería por Compra #' || substr(v_operacion_id::text, 1, 8)
        );
      ELSE
        -- Compra diferida: queda en camino (pendiente de recepción física)
        UPDATE public.stocks AS s
        SET cantidad_pendiente = s.cantidad_pendiente + v_cantidad,
            updated_at = now()
        WHERE s.id = v_stock_id;
      END IF;

    ELSIF v_tipo = 'VENTA' THEN
      IF v_cantidad_cumpl > 0 THEN
        IF v_saldo_ant < v_cantidad_cumpl THEN
          RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = '55002';
        END IF;

        v_saldo_post := v_saldo_ant - v_cantidad_cumpl;

        IF (v_cantidad - v_cantidad_cumpl) > 0 THEN
          IF v_saldo_post < (v_cantidad - v_cantidad_cumpl) THEN
            RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = '55002';
          END IF;
          UPDATE public.stocks AS s
          SET cantidad = v_saldo_post,
              cantidad_reservada = s.cantidad_reservada + (v_cantidad - v_cantidad_cumpl),
              updated_at = now()
          WHERE s.id = v_stock_id;
        ELSE
          UPDATE public.stocks AS s
          SET cantidad = v_saldo_post,
              updated_at = now()
          WHERE s.id = v_stock_id;
        END IF;

        -- Registrar en Kardex de stock
        PERFORM public._stock_ledger_insertar(
          v_tenant_id, p_taller_id, v_producto_id, v_stock_id, v_operacion_id,
          'VENTA', -v_cantidad_cumpl, v_saldo_ant, v_saldo_post,
          COALESCE(p_fecha, now()), 'Entrega de mercadería por Venta #' || substr(v_operacion_id::text, 1, 8)
        );
      ELSE
        -- Venta diferida: queda reservada en taller
        UPDATE public.stocks AS s
        SET cantidad_reservada = s.cantidad_reservada + v_cantidad,
            updated_at = now()
        WHERE s.id = v_stock_id
          AND (s.cantidad - s.cantidad_reservada) >= v_cantidad;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount = 0 THEN
          RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = '55002';
        END IF;
      END IF;

    ELSE
      -- ASIGNACION_ARREGLO u otros movimientos directos
      IF v_delta_cantidad < 0 AND v_saldo_ant < -v_delta_cantidad THEN
        RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = '55002';
      END IF;

      v_cantidad_cumpl := v_cantidad;
      v_saldo_post := v_saldo_ant + v_delta_cantidad;

      UPDATE public.stocks AS s
      SET cantidad = v_saldo_post,
          updated_at = now()
      WHERE s.id = v_stock_id;

      -- Registrar en Kardex de stock
      PERFORM public._stock_ledger_insertar(
        v_tenant_id, p_taller_id, v_producto_id, v_stock_id, v_operacion_id,
        'ASIGNACION', v_delta_cantidad, v_saldo_ant, v_saldo_post,
        COALESCE(p_fecha, now()), 'Asignación de repuesto a arreglo por Operación #' || substr(v_operacion_id::text, 1, 8),
        NULL, p_arreglo_id
      );
    END IF;

    -- Insertar línea de operación con trazabilidad de cantidad_cumplida
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
      CASE
        WHEN v_tipo = 'COMPRA' THEN v_cantidad_cumpl
        WHEN v_tipo = 'VENTA' THEN -v_cantidad_cumpl
        ELSE v_delta_cantidad
      END
    );
  END LOOP;

  -- Actualizar monto total y estado_stock en operaciones
  UPDATE public.operaciones
  SET monto_total = v_importe,
      estado_stock = CASE
        WHEN v_tipo NOT IN ('COMPRA', 'VENTA') THEN 'ENTREGADO'::public.estado_stock_operacion
        WHEN v_total_cumplida >= v_total_cantidad AND v_total_cantidad > 0 THEN 'ENTREGADO'::public.estado_stock_operacion
        WHEN v_total_cumplida > 0 THEN 'PARCIAL'::public.estado_stock_operacion
        ELSE 'PENDIENTE'::public.estado_stock_operacion
      END
  WHERE id = v_operacion_id;

  -- Resolver signo de flujo financiero
  IF v_tipo = 'COMPRA' THEN
    v_signo := -1;
  ELSIF v_tipo = 'VENTA' THEN
    v_signo := 1;
  END IF;

  -- Procesar pagos múltiples si fueron provistos
  IF v_tiene_pagos THEN
    v_monto_total_pagos := 0;
    FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos) LOOP
      v_pago_cuenta_id := (v_pago->>'cuenta_id')::uuid;
      v_pago_monto := coalesce((v_pago->>'monto')::numeric, 0);
      v_pago_fecha := coalesce((v_pago->>'fecha')::timestamptz, coalesce(p_fecha, now()));
      v_pago_desc := v_pago->>'descripcion';

      IF v_pago_cuenta_id IS NOT NULL AND v_pago_monto > 0 THEN
        PERFORM public._finanzas_exigir_cuenta(v_pago_cuenta_id, v_tenant_id, true);
        v_monto_total_pagos := v_monto_total_pagos + v_pago_monto;

        IF v_signo <> 0 THEN
          PERFORM public._ledger_insertar(v_operacion_id, v_tenant_id, v_pago_cuenta_id, v_signo * v_pago_monto, v_pago_fecha);

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
            v_pago_cuenta_id,
            v_pago_monto,
            v_pago_fecha,
            coalesce(v_pago_desc, 'Pago inicial al registrar operación #' || substr(v_operacion_id::text, 1, 8))
          );
        END IF;
      END IF;
    END LOOP;

    IF v_monto_total_pagos >= v_importe AND v_importe > 0 THEN
      v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
    ELSIF v_monto_total_pagos > 0 THEN
      v_estado_pago := 'PARCIAL'::public.estado_pago_operacion;
    ELSE
      v_estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
    END IF;

    UPDATE public.operaciones
    SET estado_pago = v_estado_pago,
        total_pagado = v_monto_total_pagos,
        esta_pago = (v_monto_total_pagos >= v_importe AND v_importe > 0)
    WHERE id = v_operacion_id;

  ELSE
    -- Comportamiento heredado con cuenta única
    IF p_cuenta_id IS NOT NULL THEN
      IF v_estado_pago = 'PAGADO' THEN
        v_monto_pago := v_importe;
      ELSIF v_estado_pago = 'PARCIAL' THEN
        IF p_monto_inicial IS NULL OR p_monto_inicial <= 0 OR p_monto_inicial >= v_importe THEN
          RAISE EXCEPTION 'Para estado de pago PARCIAL debe indicar un monto inicial válido menor al total' USING ERRCODE = '22023';
        END IF;
        v_monto_pago := p_monto_inicial;
      END IF;
    ELSE
      v_monto_pago := 0;
    END IF;

    IF p_cuenta_id IS NOT NULL AND v_monto_pago > 0 AND v_signo <> 0 THEN
      PERFORM public._ledger_insertar(v_operacion_id, v_tenant_id, p_cuenta_id, v_signo * v_monto_pago, p_fecha);

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
        'Pago inicial al registrar operación #' || substr(v_operacion_id::text, 1, 8)
      );

      UPDATE public.operaciones
      SET total_pagado = v_monto_pago,
          esta_pago = (v_monto_pago >= v_importe AND v_importe > 0),
          estado_pago = v_estado_pago
      WHERE id = v_operacion_id;
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock TO "anon", "authenticated", "service_role", "postgres";


-- 2. rpc_confirmar_stock_operacion (55002 en falta de stock físico para entrega diferida/parcial)
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

  -- Bloquear operación para actualización
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
      SELECT ol.id, ol.stock_id, ol.cantidad, ol.cantidad_cumplida
      FROM public.operaciones_lineas ol
      WHERE ol.operacion_id = p_operacion_id
      FOR UPDATE
    LOOP
      v_pendiente := v_linea.cantidad - COALESCE(v_linea.cantidad_cumplida, 0);
      IF v_pendiente <= 0 THEN
        CONTINUE;
      END IF;

      SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
      FROM public.stocks s
      WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id AND s.taller_id = v_op.taller_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock no encontrado: %', v_linea.stock_id USING ERRCODE = 'P0002';
      END IF;

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
          RAISE EXCEPTION 'Stock físico insuficiente en taller para entregar la venta diferida' USING ERRCODE = '55002';
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
      SET cantidad_cumplida = v_linea.cantidad,
          delta_cantidad = CASE WHEN v_op.tipo = 'COMPRA' THEN v_linea.cantidad ELSE -v_linea.cantidad END
      WHERE id = v_linea.id;

      v_confirmadas := v_confirmadas + v_pendiente;
    END LOOP;

  -- CASO 2: Confirmación parcial por línea especificada en p_lineas
  ELSE
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
      v_item_linea_id := (v_item->>'linea_id')::uuid;
      v_item_stock_id := (v_item->>'stock_id')::uuid;
      v_item_cant := coalesce((v_item->>'cantidad')::int, 0);

      IF v_item_cant <= 0 THEN
        CONTINUE;
      END IF;

      IF v_item_linea_id IS NOT NULL THEN
        SELECT ol.id, ol.stock_id, ol.cantidad, ol.cantidad_cumplida
        INTO v_linea
        FROM public.operaciones_lineas ol
        WHERE ol.id = v_item_linea_id AND ol.operacion_id = p_operacion_id
        FOR UPDATE;
      ELSE
        SELECT ol.id, ol.stock_id, ol.cantidad, ol.cantidad_cumplida
        INTO v_linea
        FROM public.operaciones_lineas ol
        WHERE ol.stock_id = v_item_stock_id AND ol.operacion_id = p_operacion_id
        LIMIT 1
        FOR UPDATE;
      END IF;

      IF v_linea.id IS NULL THEN
        RAISE EXCEPTION 'Línea de operación no encontrada' USING ERRCODE = 'P0002';
      END IF;

      v_pendiente := v_linea.cantidad - COALESCE(v_linea.cantidad_cumplida, 0);
      v_confirmar := LEAST(v_pendiente, v_item_cant);

      IF v_confirmar <= 0 THEN
        CONTINUE;
      END IF;

      SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
      FROM public.stocks s
      WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id AND s.taller_id = v_op.taller_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock no encontrado: %', v_linea.stock_id USING ERRCODE = 'P0002';
      END IF;

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
          RAISE EXCEPTION 'Stock físico insuficiente en taller para entregar unidades solicitadas' USING ERRCODE = '55002';
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
      SET cantidad_cumplida = COALESCE(cantidad_cumplida, 0) + v_confirmar,
          delta_cantidad = CASE WHEN v_op.tipo = 'COMPRA' THEN COALESCE(cantidad_cumplida, 0) + v_confirmar ELSE -(COALESCE(cantidad_cumplida, 0) + v_confirmar) END
      WHERE id = v_linea.id;

      v_confirmadas := v_confirmadas + v_confirmar;
    END LOOP;
  END IF;

  -- 3. Recalcular estado_stock de la operación
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


-- 3. rpc_set_asignacion_arreglo_linea (55002 al asignar repuesto a un arreglo sin stock suficiente)
CREATE OR REPLACE FUNCTION public.rpc_set_asignacion_arreglo_linea (
  p_arreglo_id           uuid,
  p_taller_id            uuid,
  p_stock_id             uuid,
  p_cantidad             integer,
  p_monto_unitario       numeric DEFAULT 0,
  p_categoria_arreglo_id uuid    DEFAULT NULL::uuid,
  p_empleado_id          uuid    DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
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
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida (%)', p_cantidad USING ERRCODE = '22023'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario inválido (%)', p_monto_unitario USING ERRCODE = '22023'; END IF;
  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;
  SELECT oa.operacion_id INTO v_operacion_id
  FROM public.operaciones_asignacion_arreglo oa
  WHERE oa.arreglo_id = p_arreglo_id LIMIT 1;
  IF v_operacion_id IS NULL THEN
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
    VALUES (v_tenant_id, 'ASIGNACION_ARREGLO', p_taller_id, COALESCE(v_arreglo_fecha, now()))
    RETURNING id INTO v_operacion_id;
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  ELSE
    SELECT o.taller_id INTO v_taller_id
    FROM public.operaciones o
    WHERE o.id = v_operacion_id AND o.tenant_id = v_tenant_id;
    IF v_taller_id IS NULL THEN RAISE EXCEPTION 'operación % no encontrada', v_operacion_id USING ERRCODE = 'P0002'; END IF;
    IF v_taller_id <> p_taller_id THEN RAISE EXCEPTION 'taller_id no coincide' USING ERRCODE = '22023'; END IF;
  END IF;
  SELECT s.taller_id INTO v_stock_taller_id
  FROM public.stocks s WHERE s.id = p_stock_id FOR UPDATE;
  IF v_stock_taller_id IS NULL THEN RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id USING ERRCODE = 'P0002'; END IF;
  IF v_stock_taller_id <> v_taller_id THEN RAISE EXCEPTION 'stock_id no pertenece al taller' USING ERRCODE = '22023'; END IF;
  SELECT l.id, l.delta_cantidad INTO v_linea_id, v_old_delta
  FROM public.operaciones_lineas l
  WHERE l.operacion_id = v_operacion_id AND l.stock_id = p_stock_id LIMIT 1;
  v_new_delta := -p_cantidad;
  v_delta_diff := v_new_delta - COALESCE(v_old_delta, 0);
  IF v_delta_diff < 0 THEN
    UPDATE public.stocks s
    SET cantidad = s.cantidad + v_delta_diff, updated_at = now()
    WHERE s.id = p_stock_id AND s.cantidad >= (-v_delta_diff);
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', p_stock_id USING ERRCODE = '55002'; END IF;
  ELSIF v_delta_diff > 0 THEN
    UPDATE public.stocks s
    SET cantidad = s.cantidad + v_delta_diff, updated_at = now()
    WHERE s.id = p_stock_id;
  END IF;
  IF v_linea_id IS NULL THEN
    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad, categoria_arreglo_id, empleado_id
    ) VALUES (
      v_operacion_id, p_stock_id, p_cantidad, p_monto_unitario, v_new_delta, p_categoria_arreglo_id, p_empleado_id
    );
  ELSE
    UPDATE public.operaciones_lineas
    SET cantidad = p_cantidad, monto_unitario = p_monto_unitario, delta_cantidad = v_new_delta,
        categoria_arreglo_id = p_categoria_arreglo_id, empleado_id = p_empleado_id
    WHERE id = v_linea_id;
  END IF;
  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_set_asignacion_arreglo_linea TO "anon", "authenticated", "service_role", "postgres";


-- 4. rpc_facturacion_reservar_devoluciones (55002 en saldo físico insuficiente para devolver)
CREATE OR REPLACE FUNCTION public.rpc_facturacion_reservar_devoluciones(
  p_nota_id uuid,
  p_devoluciones jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant uuid;
  v_role text;
  v_dev jsonb;
  v_linea_id uuid;
  v_stock uuid;
  v_cantidad integer;
  v_original record;
  v_cantidad_original integer;
  v_used integer;
  v_duplicate integer;
  v_cantidad_bigint bigint;
BEGIN
  v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  v_role := auth.jwt() ->> 'user_role';
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Sesion sin tenant activo' USING ERRCODE = '28000'; END IF;
  IF v_role IS DISTINCT FROM 'admin' AND NOT public._b2c179_tiene_permiso('facturas:edit') THEN
    RAISE EXCEPTION 'Solo un administrador del tenant puede reservar devoluciones' USING ERRCODE = '42501';
  END IF;

  SELECT f.id, f.estado, f.documento_tipo, f.tipo_comprobante, f.cliente_id
  INTO v_original
  FROM public.facturas_electronicas n
  JOIN public.facturas_electronicas f ON f.id = n.factura_modificada_id AND f.tenant_id = v_tenant
  WHERE n.id = p_nota_id AND n.tenant_id = v_tenant;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota de crédito o factura original no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_original.estado <> 'AUTORIZADA' THEN
    RAISE EXCEPTION 'Solo pueden asociarse devoluciones de facturas autorizadas' USING ERRCODE = '55000';
  END IF;

  DELETE FROM public.facturacion_nc_devoluciones
  WHERE nota_credito_id = p_nota_id AND tenant_id = v_tenant;

  IF p_devoluciones IS NULL OR jsonb_array_length(p_devoluciones) = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) - count(DISTINCT (j->>'operacion_linea_id'))
  INTO v_duplicate
  FROM jsonb_array_elements(p_devoluciones) j;
  IF v_duplicate > 0 THEN RAISE EXCEPTION 'No se puede repetir una línea de stock' USING ERRCODE = '22023'; END IF;

  FOR v_dev IN SELECT * FROM jsonb_array_elements(p_devoluciones)
  LOOP
    v_linea_id := (v_dev ->> 'operacion_linea_id')::uuid;
    v_cantidad_bigint := (v_dev ->> 'cantidad')::bigint;
    IF v_cantidad_bigint IS NULL OR v_cantidad_bigint <= 0 THEN
      RAISE EXCEPTION 'La cantidad de devolución debe ser positiva' USING ERRCODE = '22023';
    END IF;
    IF v_cantidad_bigint > 2147483647 THEN RAISE EXCEPTION 'La cantidad supera el máximo permitido' USING ERRCODE = '22023'; END IF;
    v_cantidad := v_cantidad_bigint::integer;

    IF v_original.documento_tipo = 'VENTA' THEN
      SELECT ol.stock_id, ol.cantidad
      INTO v_stock, v_cantidad_original
      FROM public.operaciones_lineas ol
      JOIN public.operaciones_venta ov ON ov.operacion_id = ol.operacion_id AND ov.tenant_id = v_tenant
      JOIN public.operaciones_factura ofa ON ofa.operacion_id = ov.operacion_id
      WHERE ol.id = v_linea_id AND ofa.factura_id = v_original.id;
    ELSIF v_original.documento_tipo = 'ARREGLO' THEN
      SELECT ol.stock_id, ol.cantidad
      INTO v_stock, v_cantidad_original
      FROM public.operaciones_lineas ol
      JOIN public.operaciones_asignacion_arreglo oaa ON oaa.operacion_id = ol.operacion_id
      JOIN public.arreglos_factura afa ON afa.arreglo_id = oaa.arreglo_id
      WHERE ol.id = v_linea_id AND afa.factura_id = v_original.id;
    END IF;

    IF v_stock IS NULL THEN
      RAISE EXCEPTION 'La línea de devolución no pertenece a la factura original' USING ERRCODE = '22023';
    END IF;

    IF v_cantidad > v_cantidad_original THEN
      RAISE EXCEPTION 'La cantidad a devolver excede lo facturado originalmente' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(sum(d.cantidad), 0)
    INTO v_used
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id AND n.tenant_id = v_tenant
    WHERE d.operacion_linea_id = v_linea_id
      AND n.estado IN ('ENVIANDO','INCIERTA','AUTORIZADA')
      AND n.id <> p_nota_id;
    IF v_cantidad > v_cantidad_original - v_used THEN
      RAISE EXCEPTION 'La cantidad a devolver supera el saldo físico disponible' USING ERRCODE = '55002';
    END IF;
    INSERT INTO public.facturacion_nc_devoluciones(
      tenant_id, nota_credito_id, factura_original_id, operacion_linea_id, stock_id, cantidad
    ) VALUES (v_tenant, p_nota_id, v_original.id, v_linea_id, v_stock, v_cantidad);
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_facturacion_reservar_devoluciones(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_reservar_devoluciones(uuid,jsonb) TO authenticated, service_role;


-- 5. rpc_borrar_operacion_con_stock (55005 en reversión bloqueada por consumo previo)
CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock (
  p_operacion_id uuid,
  p_unused       uuid DEFAULT NULL
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id       uuid := public.current_tenant_id();
  v_op              record;
  v_linea           record;
  v_pago            record;
  v_cumplida        int;
  v_remanente       int;
  v_saldo_ant       int;
  v_saldo_post      int;
  v_producto_id     uuid;
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

  -- Revertir stock según cantidad física cumplida y reservas/pendientes
  FOR v_linea IN
    SELECT id, stock_id, cantidad, cantidad_cumplida, delta_cantidad
    FROM public.operaciones_lineas
    WHERE operacion_id = p_operacion_id
    FOR UPDATE
  LOOP
    v_cumplida := COALESCE(v_linea.cantidad_cumplida, v_linea.cantidad);
    v_remanente := GREATEST(0, v_linea.cantidad - v_cumplida);

    SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
    FROM public.stocks s
    WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id
    FOR UPDATE;

    IF v_op.tipo = 'COMPRA' THEN
      -- Lo cumplido salió físicamente del taller
      IF v_cumplida > 0 THEN
        IF v_saldo_ant < v_cumplida THEN
          RAISE EXCEPTION 'Stock insuficiente para revertir la compra (unidades ya consumidas o vendidas)' USING ERRCODE = '55005';
        END IF;

        v_saldo_post := v_saldo_ant - v_cumplida;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_remanente),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'REVERSION', -v_cumplida, v_saldo_ant, v_saldo_post,
          now(), 'Reversión por anulación de Compra #' || substr(p_operacion_id::text, 1, 8)
        );
      ELSE
        UPDATE public.stocks AS s
        SET cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_remanente),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;
      END IF;

    ELSIF v_op.tipo = 'VENTA' THEN
      -- Lo entregado regresa al stock físico del taller
      IF v_cumplida > 0 THEN
        v_saldo_post := v_saldo_ant + v_cumplida;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_remanente),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'REVERSION', v_cumplida, v_saldo_ant, v_saldo_post,
          now(), 'Reversión por anulación de Venta #' || substr(p_operacion_id::text, 1, 8)
        );
      ELSE
        UPDATE public.stocks AS s
        SET cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_remanente),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;
      END IF;

    ELSE
      -- ASIGNACION_ARREGLO u otros movimientos
      IF v_linea.delta_cantidad < 0 THEN
        v_saldo_post := v_saldo_ant - v_linea.delta_cantidad;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'REVERSION', -v_linea.delta_cantidad, v_saldo_ant, v_saldo_post,
          now(), 'Reversión por anulación de Asignación #' || substr(p_operacion_id::text, 1, 8)
        );
      ELSIF v_linea.delta_cantidad > 0 THEN
        IF v_saldo_ant < v_linea.delta_cantidad THEN
          RAISE EXCEPTION 'Stock insuficiente para revertir operación' USING ERRCODE = '55005';
        END IF;

        v_saldo_post := v_saldo_ant - v_linea.delta_cantidad;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'REVERSION', -v_linea.delta_cantidad, v_saldo_ant, v_saldo_post,
          now(), 'Reversión por anulación de Operación #' || substr(p_operacion_id::text, 1, 8)
        );
      END IF;
    END IF;
  END LOOP;

  -- Revertir movimientos financieros asociados en ledger
  FOR v_pago IN
    SELECT m.id
    FROM public.movimientos_financieros AS m
    WHERE m.operacion_id = p_operacion_id
      AND m.tenant_id = v_tenant_id
  LOOP
    PERFORM public._finanzas_reversar_movimiento(v_pago.id, now());
  END LOOP;

  -- Eliminar registros dependientes
  DELETE FROM public.operaciones_pagos WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_lineas WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_asignacion_arreglo WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_venta WHERE operacion_id = p_operacion_id;
  -- Permitir que las foreign keys ON DELETE SET NULL en auditoría (movimientos_stock, movimientos_financieros) se actualicen
  PERFORM set_config('app.stock_tenant_cleanup', 'on', true);
  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);

  DELETE FROM public.operaciones WHERE id = p_operacion_id;

  PERFORM set_config('app.stock_tenant_cleanup', 'off', true);
  PERFORM set_config('app.finanzas_tenant_cleanup', 'off', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock TO "anon", "authenticated", "service_role", "postgres";


-- 6. rpc_revertir_movimiento_stock_operacion (55005 al revertir compra con unidades consumidas)
CREATE OR REPLACE FUNCTION public.rpc_revertir_movimiento_stock_operacion (
  p_operacion_id  uuid,
  p_movimiento_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id        uuid := public.current_tenant_id();
  v_op               record;
  v_mov              record;
  v_stock            record;
  v_linea            record;
  v_cant             int;
  v_saldo_ant        int;
  v_saldo_post       int;
  v_nueva_reservada  int;
  v_nueva_pendiente  int;
  v_nueva_cumplida   int;
  v_total_pactadas   int;
  v_total_cumplidas  int;
  v_nuevo_estado     public.estado_stock_operacion;
  v_rev_mov_id       uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_operacion_id IS NULL OR p_movimiento_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos' USING ERRCODE = '22023';
  END IF;

  -- 1. Bloquear operación para actualización
  SELECT id, tipo, taller_id, estado_stock
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_op.tipo NOT IN ('COMPRA', 'VENTA') THEN
    RAISE EXCEPTION 'Solo se pueden revertir movimientos de stock en compras o ventas' USING ERRCODE = '22023';
  END IF;

  -- 2. Validar que el movimiento exista, corresponda a la operación y no sea ya una reversión
  SELECT id, tipo_movimiento, cantidad, stock_id, producto_id, fecha, reversion_de_id
  INTO v_mov
  FROM public.movimientos_stock
  WHERE id = p_movimiento_id AND operacion_id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento de stock no encontrado para esta operación' USING ERRCODE = 'P0002';
  END IF;

  IF v_mov.tipo_movimiento = 'REVERSION' OR v_mov.reversion_de_id IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede revertir un movimiento que ya es una reversión' USING ERRCODE = '22023';
  END IF;

  -- Validar si ya fue revertido previamente
  IF EXISTS (
    SELECT 1 FROM public.movimientos_stock
    WHERE reversion_de_id = p_movimiento_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Este movimiento de stock ya fue revertido anteriormente' USING ERRCODE = '22023';
  END IF;

  -- 3. Obtener stock y línea correspondientes con bloqueo
  SELECT id, cantidad, cantidad_reservada, cantidad_pendiente, producto_id
  INTO v_stock
  FROM public.stocks
  WHERE id = v_mov.stock_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock no encontrado: %', v_mov.stock_id USING ERRCODE = 'P0002';
  END IF;

  SELECT id, cantidad, cantidad_cumplida
  INTO v_linea
  FROM public.operaciones_lineas
  WHERE operacion_id = p_operacion_id AND stock_id = v_mov.stock_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Línea de operación no encontrada para el stock %', v_mov.stock_id USING ERRCODE = 'P0002';
  END IF;

  v_cant := abs(v_mov.cantidad);
  v_saldo_ant := v_stock.cantidad;

  IF v_op.tipo = 'VENTA' THEN
    -- En Venta las unidades entregadas regresan al taller y vuelven a quedar reservadas
    v_saldo_post := v_saldo_ant + v_cant;
    v_nueva_reservada := v_stock.cantidad_reservada + v_cant;
    v_nueva_cumplida := GREATEST(0, v_linea.cantidad_cumplida - v_cant);

    UPDATE public.stocks
    SET cantidad = v_saldo_post,
        cantidad_reservada = v_nueva_reservada,
        updated_at = now()
    WHERE id = v_stock.id;

    UPDATE public.operaciones_lineas
    SET cantidad_cumplida = v_nueva_cumplida,
        delta_cantidad = -v_nueva_cumplida
    WHERE id = v_linea.id;

    v_rev_mov_id := public._stock_ledger_insertar(
      v_tenant_id, v_op.taller_id, v_stock.producto_id, v_stock.id, p_operacion_id,
      'REVERSION', v_cant, v_saldo_ant, v_saldo_post,
      now(), 'Reversión de entrega de Venta #' || substr(p_operacion_id::text, 1, 8),
      NULL, NULL, p_movimiento_id
    );

  ELSIF v_op.tipo = 'COMPRA' THEN
    -- En Compra las unidades recibidas salen del taller y vuelven a quedar pendientes de recepción
    IF v_saldo_ant < v_cant THEN
      RAISE EXCEPTION 'Stock físico insuficiente en taller para revertir la compra (unidades ya consumidas o vendidas)' USING ERRCODE = '55005';
    END IF;

    v_saldo_post := v_saldo_ant - v_cant;
    v_nueva_pendiente := v_stock.cantidad_pendiente + v_cant;
    v_nueva_cumplida := GREATEST(0, v_linea.cantidad_cumplida - v_cant);

    UPDATE public.stocks
    SET cantidad = v_saldo_post,
        cantidad_pendiente = v_nueva_pendiente,
        updated_at = now()
    WHERE id = v_stock.id;

    UPDATE public.operaciones_lineas
    SET cantidad_cumplida = v_nueva_cumplida,
        delta_cantidad = v_nueva_cumplida
    WHERE id = v_linea.id;

    v_rev_mov_id := public._stock_ledger_insertar(
      v_tenant_id, v_op.taller_id, v_stock.producto_id, v_stock.id, p_operacion_id,
      'REVERSION', -v_cant, v_saldo_ant, v_saldo_post,
      now(), 'Reversión de recepción de Compra #' || substr(p_operacion_id::text, 1, 8),
      NULL, NULL, p_movimiento_id
    );
  END IF;

  -- 4. Recalcular estado_stock de la operación
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
    'movimiento_revertido_id', p_movimiento_id,
    'reversion_movimiento_id', v_rev_mov_id,
    'unidades_revertidas', v_cant,
    'estado_stock', v_nuevo_estado,
    'total_cumplidas', v_total_cumplidas,
    'total_pactadas', v_total_pactadas
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_revertir_movimiento_stock_operacion TO "anon", "authenticated", "service_role", "postgres";


-- 7. rpc_revertir_operacion_linea (55005 al revertir una línea)
CREATE OR REPLACE FUNCTION public.rpc_revertir_operacion_linea (
  p_operacion_linea_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_operacion_id uuid;
  v_stock_id uuid;
  v_delta int;
  v_reverse int;
  v_rowcount int;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_operacion_linea_id IS NULL THEN
    RAISE EXCEPTION 'operacion_linea_id requerido' USING ERRCODE = '22023';
  END IF;
  SELECT l.operacion_id, l.stock_id, l.delta_cantidad
  INTO v_operacion_id, v_stock_id, v_delta
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  WHERE l.id = p_operacion_linea_id
    AND o.tenant_id = v_tenant_id;
  IF v_operacion_id IS NULL THEN
    RAISE EXCEPTION 'línea no encontrada (%)', p_operacion_linea_id USING ERRCODE = 'P0002';
  END IF;
  IF v_delta IS NULL OR v_delta = 0 THEN
    RAISE EXCEPTION 'delta inválido para línea %', p_operacion_linea_id USING ERRCODE = '22023';
  END IF;
  -- Lock del stock involucrado
  PERFORM 1
  FROM public.stocks s
  WHERE s.id = v_stock_id
  FOR UPDATE;
  v_reverse := -v_delta;
  IF v_reverse < 0 THEN
    UPDATE public.stocks s
    SET cantidad = s.cantidad + v_reverse,
        updated_at = now()
    WHERE s.id = v_stock_id
      AND s.cantidad >= (-v_reverse);
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para revertir la línea (stock %)', v_stock_id
      USING ERRCODE = '55005';
    END IF;
  ELSE
    UPDATE public.stocks s
    SET cantidad = s.cantidad + v_reverse,
        updated_at = now()
    WHERE s.id = v_stock_id;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      RAISE EXCEPTION 'stock no encontrado (%)', v_stock_id USING ERRCODE = 'P0002';
    END IF;
  END IF;
  DELETE FROM public.operaciones_lineas
  WHERE id = p_operacion_linea_id;
  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_revertir_operacion_linea TO "anon", "authenticated", "service_role", "postgres";
