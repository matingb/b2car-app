-- Las operaciones de Compra/Venta deben afectar exclusivamente el stock del
-- taller informado y nunca dejar una cantidad negativa. Esta validación vive
-- en la RPC para cubrir cualquier consumidor del contrato, no solo el modal.
CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock(
  p_tipo text,
  p_taller_id uuid,
  p_lineas jsonb,
  p_arreglo_id uuid DEFAULT NULL,
  p_fecha timestamptz DEFAULT now(),
  p_cuenta_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo public.tipo_operacion;
  v_operacion_id uuid;
  v_linea jsonb;
  v_stock_id uuid;
  v_cantidad int;
  v_monto_unitario numeric;
  v_delta_cantidad int;
  v_importe numeric := 0;
  v_rowcount int;
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

  IF v_tipo IN ('COMPRA', 'VENTA') AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta financiera requerida para compras y ventas' USING ERRCODE = '22023';
  END IF;

  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;

  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, v_tipo, p_taller_id, COALESCE(p_fecha, now()))
  RETURNING id INTO v_operacion_id;

  IF p_arreglo_id IS NOT NULL AND v_tipo = 'ASIGNACION_ARREGLO' THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  END IF;

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

    INSERT INTO public.operaciones_lineas (
      operacion_id,
      stock_id,
      cantidad,
      monto_unitario,
      delta_cantidad
    )
    VALUES (
      v_operacion_id,
      v_stock_id,
      v_cantidad,
      v_monto_unitario,
      v_delta_cantidad
    );

    v_importe := v_importe + (v_cantidad * v_monto_unitario);
  END LOOP;

  IF p_cuenta_id IS NOT NULL AND v_importe <> 0 AND v_tipo IN ('COMPRA', 'VENTA') THEN
    PERFORM public._ledger_insertar(
      v_operacion_id,
      v_tenant_id,
      p_cuenta_id,
      CASE WHEN v_tipo = 'COMPRA' THEN -v_importe ELSE v_importe END,
      COALESCE(p_fecha, now())
    );
  END IF;

  RETURN v_operacion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamptz, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamptz, uuid, uuid) TO authenticated, service_role;
