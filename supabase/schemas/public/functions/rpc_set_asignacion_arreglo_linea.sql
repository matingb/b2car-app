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
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida (%)', p_cantidad; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario inválido (%)', p_monto_unitario; END IF;
  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado'; END IF;
  SELECT oa.operacion_id INTO v_operacion_id
  FROM public.operaciones_asignacion_arreglo oa
  WHERE oa.arreglo_id = p_arreglo_id LIMIT 1;
  IF v_operacion_id IS NULL THEN
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
    VALUES (v_tenant_id, 'ASIGNACION_ARREGLO', p_taller_id, v_arreglo_fecha)
    RETURNING id INTO v_operacion_id;
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
    v_taller_id := p_taller_id;
  ELSE
    SELECT o.taller_id INTO v_taller_id
    FROM public.operaciones o
    WHERE o.id = v_operacion_id AND o.tenant_id = v_tenant_id;
    IF v_taller_id IS NULL THEN RAISE EXCEPTION 'operación % no encontrada', v_operacion_id; END IF;
    IF v_taller_id <> p_taller_id THEN RAISE EXCEPTION 'taller_id no coincide'; END IF;
  END IF;
  SELECT s.taller_id INTO v_stock_taller_id
  FROM public.stocks s WHERE s.id = p_stock_id FOR UPDATE;
  IF v_stock_taller_id IS NULL THEN RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id; END IF;
  IF v_stock_taller_id <> v_taller_id THEN RAISE EXCEPTION 'stock_id no pertenece al taller'; END IF;
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
    IF v_rowcount = 0 THEN RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', p_stock_id; END IF;
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

GRANT EXECUTE ON FUNCTION "public"."rpc_set_asignacion_arreglo_linea"(uuid, uuid, uuid, integer, numeric, uuid, uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_set_asignacion_arreglo_linea"(uuid, uuid, uuid, integer, numeric, uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_set_asignacion_arreglo_linea"(uuid, uuid, uuid, integer, numeric, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_set_asignacion_arreglo_linea"(uuid, uuid, uuid, integer, numeric, uuid, uuid) TO "postgres";
