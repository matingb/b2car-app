DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean, uuid);

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
  p_proveedor_id    uuid                     DEFAULT NULL::uuid
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
  v_producto_id      uuid;
  v_cantidad         int;
  v_monto_unitario   numeric;
  v_delta_cantidad   int;
  v_cantidad_cumpl   int;
  v_saldo_ant        int;
  v_saldo_post       int;
  v_importe          numeric := 0;
  v_rowcount         int;
  v_mover_stock      boolean := COALESCE(p_mover_stock, true);
  v_estado_pago      public.estado_pago_operacion;
  v_monto_pago       numeric := 0;
  v_cuenta_tipo      text;
  v_signo            int := 0;
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

  -- Validar proveedor si se especificó
  IF p_proveedor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.proveedores WHERE id = p_proveedor_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Proveedor no encontrado' USING ERRCODE = 'P0002';
    END IF;
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
    proveedor_id,
    estado_pago,
    estado_stock
  )
  VALUES (
    v_tenant_id, v_tipo, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''),
    p_proveedor_id,
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

    -- Obtener datos actuales del stock con bloqueo
    SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
    FROM public.stocks s
    WHERE s.id = v_stock_id AND s.tenant_id = v_tenant_id AND s.taller_id = p_taller_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock no encontrado: %', v_stock_id USING ERRCODE = 'P0002';
    END IF;

    -- Movimientos de stock según tipo y diferimiento
    IF v_tipo = 'COMPRA' THEN
      IF v_mover_stock THEN
        v_cantidad_cumpl := v_cantidad;
        v_saldo_post := v_saldo_ant + v_cantidad;

        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            updated_at = now()
        WHERE s.id = v_stock_id;

        -- Registrar en Kardex de stock
        PERFORM public._stock_ledger_insertar(
          v_tenant_id, p_taller_id, v_producto_id, v_stock_id, v_operacion_id,
          'COMPRA', v_cantidad, v_saldo_ant, v_saldo_post,
          COALESCE(p_fecha, now()), 'Ingreso de mercadería por Compra #' || substr(v_operacion_id::text, 1, 8)
        );
      ELSE
        -- Compra diferida: queda en camino (pendiente de recepción física)
        v_cantidad_cumpl := 0;
        UPDATE public.stocks AS s
        SET cantidad_pendiente = s.cantidad_pendiente + v_cantidad,
            updated_at = now()
        WHERE s.id = v_stock_id;
      END IF;

    ELSIF v_tipo = 'VENTA' THEN
      IF v_mover_stock THEN
        IF v_saldo_ant < v_cantidad THEN
          RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
        END IF;

        v_cantidad_cumpl := v_cantidad;
        v_saldo_post := v_saldo_ant - v_cantidad;

        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            updated_at = now()
        WHERE s.id = v_stock_id;

        -- Registrar en Kardex de stock
        PERFORM public._stock_ledger_insertar(
          v_tenant_id, p_taller_id, v_producto_id, v_stock_id, v_operacion_id,
          'VENTA', -v_cantidad, v_saldo_ant, v_saldo_post,
          COALESCE(p_fecha, now()), 'Entrega de mercadería por Venta #' || substr(v_operacion_id::text, 1, 8)
        );
      ELSE
        -- Venta diferida: queda reservada en taller
        v_cantidad_cumpl := 0;
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

  -- Actualizar monto total en operaciones
  UPDATE public.operaciones
  SET monto_total = v_importe
  WHERE id = v_operacion_id;

  -- Determinar monto pagado inicial
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

  -- Registrar movimiento en ledger financiero y en operaciones_pagos si hay pago inicial
  IF p_cuenta_id IS NOT NULL AND v_monto_pago > 0 THEN
    SELECT tipo INTO v_cuenta_tipo FROM public.cuentas_financieras WHERE id = p_cuenta_id;
    IF v_tipo = 'COMPRA' THEN
      v_signo := -1;
    ELSIF v_tipo = 'VENTA' THEN
      v_signo := 1;
    END IF;

    IF v_signo <> 0 THEN
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
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock TO "anon", "authenticated", "service_role", "postgres";