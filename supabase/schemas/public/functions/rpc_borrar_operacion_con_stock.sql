DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid);

CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock (
  p_operacion_id uuid
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
          RAISE EXCEPTION 'Stock insuficiente para revertir la compra (unidades ya consumidas o vendidas)' USING ERRCODE = 'P0001';
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
          RAISE EXCEPTION 'Stock insuficiente para revertir operación' USING ERRCODE = 'P0001';
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
  DELETE FROM public.operaciones WHERE id = p_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock TO "anon", "authenticated", "service_role", "postgres";
