-- Migration: 20261023170000_fix_rpc_borrar_operacion_con_stock_signature.sql
-- Description: Asegura compatibilidad de rpc_borrar_operacion_con_stock con 1 o 2 parámetros y actualiza rpc_borrar_arreglo

DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid);

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
          now(), 'Reversión por anulación de Operación #' || substr(p_operacion_id::text, 1, 8)
        );
      ELSIF v_linea.delta_cantidad > 0 THEN
        IF v_saldo_ant < v_linea.delta_cantidad THEN
          RAISE EXCEPTION 'Stock insuficiente para revertir la operación' USING ERRCODE = 'P0001';
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

  -- Revertir pagos en ledger y saldos financieros
  FOR v_pago IN
    SELECT op.id, op.cuenta_financiera_id, op.monto
    FROM public.operaciones_pagos op
    WHERE op.operacion_id = p_operacion_id
  LOOP
    IF v_op.tipo = 'VENTA' THEN
      -- Se acreditó plata, hay que debitarla (monto negativo)
      PERFORM public._ledger_insertar(
        v_tenant_id,
        v_pago.cuenta_financiera_id,
        -v_pago.monto,
        now(),
        p_operacion_id,
        'OPERACION_VENTA',
        'Reversión por anulación de Venta #' || substr(p_operacion_id::text, 1, 8),
        gen_random_uuid()
      );
    ELSIF v_op.tipo = 'COMPRA' THEN
      -- Se debitó plata, hay que acreditarla (monto positivo)
      PERFORM public._ledger_insertar(
        v_tenant_id,
        v_pago.cuenta_financiera_id,
        v_pago.monto,
        now(),
        p_operacion_id,
        'OPERACION_COMPRA',
        'Reversión por anulación de Compra #' || substr(p_operacion_id::text, 1, 8),
        gen_random_uuid()
      );
    END IF;
  END LOOP;

  -- Eliminar cascada de tablas satélite
  DELETE FROM public.operaciones_venta WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_compra WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_asignacion_arreglo WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_pagos WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_lineas WHERE operacion_id = p_operacion_id;

  -- Permitir que las foreign keys ON DELETE SET NULL en auditoría (movimientos_stock, movimientos_financieros) se actualicen
  PERFORM set_config('app.stock_tenant_cleanup', 'on', true);
  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);

  -- Eliminar la cabecera de la operación
  DELETE FROM public.operaciones WHERE id = p_operacion_id;

  PERFORM set_config('app.stock_tenant_cleanup', 'off', true);
  PERFORM set_config('app.finanzas_tenant_cleanup', 'off', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) TO anon, authenticated, service_role;

-- Actualizar rpc_borrar_arreglo para llamar rpc_borrar_operacion_con_stock con 1 parámetro
CREATE OR REPLACE FUNCTION public.rpc_borrar_arreglo (
  p_arreglo_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_cobro record;
  v_asignacion record;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  PERFORM 1
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arreglo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF public.facturacion_arreglo_autorizado(p_arreglo_id) THEN
    RAISE EXCEPTION 'El arreglo ya posee una factura electronica autorizada y sus datos fiscales no se pueden modificar'
      USING ERRCODE = '55001';
  END IF;

  FOR v_cobro IN
    SELECT oca.operacion_id
    FROM public.operaciones_cobro_arreglo AS oca
    WHERE oca.arreglo_id = p_arreglo_id
      AND oca.tenant_id = v_tenant_id
    ORDER BY oca.created_at, oca.operacion_id
  LOOP
    PERFORM public.rpc_finanzas_anular_cobro_arreglo(
      p_arreglo_id,
      v_cobro.operacion_id
    );
  END LOOP;

  FOR v_asignacion IN
    SELECT oa.operacion_id
    FROM public.operaciones_asignacion_arreglo AS oa
    JOIN public.operaciones AS o ON o.id = oa.operacion_id
    WHERE oa.arreglo_id = p_arreglo_id
      AND o.tenant_id = v_tenant_id
  LOOP
    PERFORM public.rpc_borrar_operacion_con_stock(
      v_asignacion.operacion_id
    );
  END LOOP;

  DELETE FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_borrar_arreglo(uuid) TO anon, authenticated, service_role;
