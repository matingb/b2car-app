-- Migration: 20261027230000_revertir_stock_operacion.sql
-- Permite revertir entregas o recepciones de stock individuales en operaciones comerciales con registro compensatorio en el Kardex

-- 1. Agregar columna reversion_de_id a movimientos_stock para auditar trazabilidad de reversiones
ALTER TABLE public.movimientos_stock
  ADD COLUMN IF NOT EXISTS reversion_de_id uuid REFERENCES public.movimientos_stock(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mov_stock_reversion_de_id
  ON public.movimientos_stock(reversion_de_id)
  WHERE reversion_de_id IS NOT NULL;

-- 2. Actualizar _stock_ledger_insertar para soportar reversion_de_id opcional
DROP FUNCTION IF EXISTS public._stock_ledger_insertar(uuid, uuid, uuid, uuid, uuid, text, integer, integer, integer, timestamptz, text, uuid, uuid);

CREATE OR REPLACE FUNCTION public._stock_ledger_insertar (
  p_tenant_id          uuid,
  p_taller_id          uuid,
  p_producto_id        uuid,
  p_stock_id           uuid,
  p_operacion_id       uuid,
  p_tipo_movimiento    text,
  p_cantidad           integer,
  p_saldo_anterior     integer,
  p_saldo_posterior    integer,
  p_fecha              timestamptz DEFAULT now(),
  p_motivo             text DEFAULT NULL,
  p_created_by         uuid DEFAULT NULL,
  p_detalle_arreglo_id uuid DEFAULT NULL,
  p_reversion_de_id    uuid DEFAULT NULL
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.movimientos_stock (
    tenant_id,
    taller_id,
    producto_id,
    stock_id,
    operacion_id,
    detalle_arreglo_id,
    tipo_movimiento,
    cantidad,
    saldo_anterior,
    saldo_posterior,
    fecha,
    motivo,
    created_by,
    reversion_de_id
  )
  VALUES (
    p_tenant_id,
    p_taller_id,
    p_producto_id,
    p_stock_id,
    p_operacion_id,
    p_detalle_arreglo_id,
    p_tipo_movimiento,
    p_cantidad,
    p_saldo_anterior,
    p_saldo_posterior,
    COALESCE(p_fecha, now()),
    p_motivo,
    p_created_by,
    p_reversion_de_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public._stock_ledger_insertar TO "anon", "authenticated", "service_role", "postgres";

-- 3. Crear RPC rpc_revertir_movimiento_stock_operacion
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
    RAISE EXCEPTION 'Solo se puede revertir stock de compras o ventas' USING ERRCODE = '22023';
  END IF;

  -- 2. Bloquear movimiento de stock a revertir
  SELECT id, producto_id, stock_id, tipo_movimiento, cantidad, fecha, motivo, reversion_de_id
  INTO v_mov
  FROM public.movimientos_stock
  WHERE id = p_movimiento_id
    AND operacion_id = p_operacion_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento de stock no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_mov.tipo_movimiento = 'REVERSION' OR v_mov.reversion_de_id IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede revertir un movimiento que ya es una reversión' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.movimientos_stock
    WHERE reversion_de_id = p_movimiento_id
      AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Este movimiento de stock ya fue revertido previamente' USING ERRCODE = '22023';
  END IF;

  -- 3. Bloquear stock físico y línea de operación
  SELECT s.id, s.producto_id, s.cantidad, s.cantidad_reservada, s.cantidad_pendiente
  INTO v_stock
  FROM public.stocks s
  WHERE s.id = v_mov.stock_id AND s.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock asociado no encontrado' USING ERRCODE = 'P0002';
  END IF;

  SELECT id, stock_id, cantidad, cantidad_cumplida
  INTO v_linea
  FROM public.operaciones_lineas
  WHERE operacion_id = p_operacion_id
    AND stock_id = v_mov.stock_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Línea de operación correspondiente no encontrada' USING ERRCODE = 'P0002';
  END IF;

  v_cant := ABS(v_mov.cantidad);
  IF v_cant <= 0 THEN
    RAISE EXCEPTION 'La cantidad del movimiento es inválida' USING ERRCODE = '22023';
  END IF;

  v_saldo_ant := v_stock.cantidad;

  IF v_op.tipo = 'VENTA' THEN
    -- En Venta las unidades entregadas regresan físicamente al taller y vuelven a reservarse en la operación
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
      RAISE EXCEPTION 'Stock físico insuficiente en taller para revertir la compra (unidades ya consumidas o vendidas)' USING ERRCODE = 'P0001';
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

GRANT EXECUTE ON FUNCTION public.rpc_revertir_movimiento_stock_operacion(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_revertir_movimiento_stock_operacion(uuid, uuid) FROM PUBLIC;
