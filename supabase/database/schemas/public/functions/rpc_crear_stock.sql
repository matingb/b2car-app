CREATE FUNCTION public.rpc_crear_stock (
  p_taller_id        uuid,
  p_producto_id      uuid,
  p_cantidad_inicial integer DEFAULT 0,
  p_stock_minimo     integer DEFAULT 0,
  p_stock_maximo     integer DEFAULT 0,
  p_idempotency_key  uuid    DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id   uuid := public.current_tenant_id();
  v_stock_id    uuid;
  v_op_id       uuid;
  v_linea_id    uuid;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('productos:edit') THEN
    RAISE EXCEPTION 'permiso productos:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_producto_id IS NULL THEN RAISE EXCEPTION 'producto_id requerido' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.talleres WHERE id = p_taller_id AND tenant_id = v_tenant_id)
     OR NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND tenant_id = v_tenant_id) THEN
    RAISE EXCEPTION 'Producto o taller ajeno al tenant' USING ERRCODE = '22023';
  END IF;
  IF p_cantidad_inicial < 0 THEN RAISE EXCEPTION 'cantidad_inicial no puede ser negativa' USING ERRCODE = '22023'; END IF;

  SELECT id INTO v_stock_id
  FROM public.stocks
  WHERE tenant_id = v_tenant_id AND taller_id = p_taller_id AND producto_id = p_producto_id;

  IF v_stock_id IS NULL THEN
    INSERT INTO public.stocks (
      tenant_id, taller_id, producto_id, cantidad, stock_minimo, stock_maximo
    ) VALUES (
      v_tenant_id, p_taller_id, p_producto_id, 0, COALESCE(p_stock_minimo, 0), COALESCE(p_stock_maximo, 0)
    ) RETURNING id INTO v_stock_id;
  END IF;

  IF p_cantidad_inicial > 0 THEN
    INSERT INTO public.operaciones (
      tenant_id, taller_id, tipo, fecha, monto_total
    ) VALUES (
      v_tenant_id, p_taller_id, 'AJUSTE', now(), 0
    ) RETURNING id INTO v_op_id;

    INSERT INTO public.operaciones_ajuste (operacion_id, tenant_id, motivo, descripcion)
    VALUES (v_op_id, v_tenant_id, 'INICIAL', 'Stock inicial');

    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, sentido
    ) VALUES (
      v_op_id, v_stock_id, p_cantidad_inicial, 0, 1
    ) RETURNING id INTO v_linea_id;

    INSERT INTO public.operaciones_movimiento_stock (
      tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo, idempotency_key
    ) VALUES (
      v_tenant_id, v_op_id, v_linea_id, v_stock_id, p_cantidad_inicial, now(), 'Stock inicial', p_idempotency_key
    );
  END IF;

  RETURN v_stock_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_crear_stock(uuid, uuid, integer, integer, integer, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_crear_stock(uuid, uuid, integer, integer, integer, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_crear_stock(uuid, uuid, integer, integer, integer, uuid) TO service_role;