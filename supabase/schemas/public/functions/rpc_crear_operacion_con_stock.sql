DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean, uuid);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean, uuid, uuid, jsonb);

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
  v_cuenta_tipo       text;
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

  IF p_tipo IS NULL OR upper(p_tipo) IN ('MOVIMIENTO_CUENTA', 'GASTO') THEN
    RAISE EXCEPTION 'Use rpc_crear_movimiento_cuenta para operaciones financieras' USING ERRCODE = '22023';
  END IF;

  v_tipo := p_tipo::public.tipo_operacion;
  IF p_taller_id IS NULL THEN
    RAISE EXCEPTION 'taller_id es requerido para operaciones de stock' USING ERRCODE = '22023';
  END IF;

  -- Validar cliente si se especificó para ventas
  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Cliente no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Validar proveedor si se especificó para compras
  IF p_proveedor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.proveedores WHERE id = p_proveedor_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Proveedor no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_tiene_pagos := (p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0);

  -- Resolver estado de pago inicial
  IF p_estado_pago IS NOT NULL THEN
    v_estado_pago := upper(p_estado_pago)::public.estado_pago_operacion;
  ELSIF v_tiene_pagos THEN
    v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSIF p_cuenta_id IS NOT NULL THEN
    v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSE
    v_estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
  END IF;

  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;

  -- Insertar operación inicial en tabla central
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
          RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
        END IF;

        v_saldo_post := v_saldo_ant - v_cantidad_cumpl;

        IF (v_cantidad - v_cantidad_cumpl) > 0 THEN
          IF v_saldo_post < (v_cantidad - v_cantidad_cumpl) THEN
            RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
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
          RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
        END IF;
      END IF;

    ELSE
      -- ASIGNACION_ARREGLO u otros movimientos directos
      IF v_delta_cantidad < 0 AND v_saldo_ant < -v_delta_cantidad THEN
        RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
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
        CASE WHEN v_tipo = 'ASIGNACION_ARREGLO' THEN 'ASIGNACION_ARREGLO' ELSE 'AJUSTE' END,
        v_delta_cantidad, v_saldo_ant, v_saldo_post,
        COALESCE(p_fecha, now()),
        'Movimiento de stock por ' || v_tipo::text || ' #' || substr(v_operacion_id::text, 1, 8)
      );
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
      v_delta_cantidad
    );

    v_importe := v_importe + (v_cantidad * v_monto_unitario);
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