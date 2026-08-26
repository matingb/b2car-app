-- Las operaciones de stock (COMPRA/VENTA) crean asientos en el ledger.
-- Al borrar la operación, la FK de esos asientos ejecuta ON DELETE SET NULL
-- sobre operacion_id. Ese UPDATE técnico debe estar permitido únicamente
-- dentro de esta RPC autorizada; el ledger original permanece inmutable.
CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock(
  p_operacion_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion record;
  v_linea record;
  v_mov record;
  v_cleanup_previo text := current_setting('app.finanzas_tenant_cleanup', true);
  v_actualizadas int;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT o.id, o.tipo
  INTO v_operacion
  FROM public.operaciones AS o
  WHERE o.id = p_operacion_id
    AND o.tenant_id = v_tenant_id
    AND o.tipo <> 'MOVIMIENTO_CUENTA'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Revertir stock sin permitir que borrar una COMPRA deje cantidades negativas.
  FOR v_linea IN
    SELECT l.stock_id, l.delta_cantidad
    FROM public.operaciones_lineas AS l
    WHERE l.operacion_id = p_operacion_id
  LOOP
    IF v_linea.delta_cantidad > 0 THEN
      UPDATE public.stocks AS s
      SET cantidad = s.cantidad - v_linea.delta_cantidad
      WHERE s.id = v_linea.stock_id
        AND s.tenant_id = v_tenant_id
        AND s.cantidad >= v_linea.delta_cantidad;
    ELSE
      UPDATE public.stocks AS s
      SET cantidad = s.cantidad - v_linea.delta_cantidad
      WHERE s.id = v_linea.stock_id
        AND s.tenant_id = v_tenant_id;
    END IF;

    GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
    IF v_actualizadas = 0 THEN
      RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_linea.stock_id
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- El reverso es un asiento nuevo y conserva el historial append-only.
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

  -- Permite sólo el ON DELETE SET NULL de los asientos originales de esta
  -- operación. El ajuste vive hasta el final de la transacción (is_local).
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
$$;

REVOKE ALL ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid,uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
