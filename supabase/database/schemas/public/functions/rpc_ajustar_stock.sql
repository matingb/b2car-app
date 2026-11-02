CREATE FUNCTION public.rpc_ajustar_stock (
  p_stock_id        uuid,
  p_cantidad_nueva  integer,
  p_motivo          text    DEFAULT NULL::text,
  p_idempotency_key uuid    DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_stock     record;
  v_diff      integer;
  v_sentido   smallint;
  v_op_id     uuid;
  v_linea_id  uuid;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('productos:edit') THEN
    RAISE EXCEPTION 'permiso productos:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad_nueva < 0 THEN RAISE EXCEPTION 'cantidad_nueva no puede ser negativa' USING ERRCODE = '22023'; END IF;

  SELECT s.id, s.tenant_id, s.taller_id, s.cantidad
  INTO v_stock
  FROM public.stocks s
  WHERE s.id = p_stock_id AND s.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock no encontrado: %', p_stock_id USING ERRCODE = 'P0002';
  END IF;

  v_diff := p_cantidad_nueva - v_stock.cantidad;

  IF v_diff = 0 THEN
    RETURN jsonb_build_object('ok', true, 'stock_id', p_stock_id, 'cantidad', v_stock.cantidad);
  END IF;

  v_sentido := CASE WHEN v_diff > 0 THEN 1::smallint ELSE -1::smallint END;

  INSERT INTO public.operaciones (
    tenant_id, taller_id, tipo, fecha, monto_total
  ) VALUES (
    v_tenant_id, v_stock.taller_id, 'AJUSTE', now(), 0
  ) RETURNING id INTO v_op_id;

  INSERT INTO public.operaciones_ajuste (operacion_id, tenant_id, motivo, descripcion)
  VALUES (v_op_id, v_tenant_id, 'MANUAL', COALESCE(p_motivo, 'Ajuste manual de stock'));

  INSERT INTO public.operaciones_lineas (
    operacion_id, stock_id, cantidad, monto_unitario, sentido
  ) VALUES (
    v_op_id, p_stock_id, abs(v_diff), 0, v_sentido
  ) RETURNING id INTO v_linea_id;

  INSERT INTO public.operaciones_movimiento_stock (
    tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo, idempotency_key
  ) VALUES (
    v_tenant_id, v_op_id, v_linea_id, p_stock_id, v_diff, now(), COALESCE(p_motivo, 'Ajuste manual de stock'), p_idempotency_key
  );

  SELECT s.cantidad INTO v_stock.cantidad FROM public.stocks s WHERE s.id = p_stock_id;

  RETURN jsonb_build_object('ok', true, 'stock_id', p_stock_id, 'cantidad', v_stock.cantidad);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_ajustar_stock(uuid, integer, text, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_ajustar_stock(uuid, integer, text, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_ajustar_stock(uuid, integer, text, uuid) TO service_role;