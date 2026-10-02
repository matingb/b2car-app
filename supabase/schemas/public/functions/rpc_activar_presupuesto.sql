CREATE OR REPLACE FUNCTION public.rpc_activar_presupuesto (
  p_arreglo_id   uuid,
  p_nuevo_estado public.estado_arreglo
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo public.arreglos;
  v_linea jsonb;
  v_pendientes jsonb;
  v_tipo text;
BEGIN
  IF p_nuevo_estado IS NULL OR p_nuevo_estado = 'PRESUPUESTO' THEN
    RAISE EXCEPTION 'Estado de activacion invalido' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_arreglo FROM public.arreglos
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_arreglo.estado <> 'PRESUPUESTO' THEN
    IF v_arreglo.estado = p_nuevo_estado THEN RETURN true; END IF;
    RAISE EXCEPTION 'El arreglo ya fue activado y no admite esta transicion' USING ERRCODE = 'P0001';
  END IF;
  IF v_arreglo.repuestos_pendientes IS NOT NULL THEN
    v_pendientes := v_arreglo.repuestos_pendientes;
    FOR v_linea IN SELECT x FROM jsonb_array_elements(v_pendientes) x ORDER BY x ->> 'id' LOOP
      PERFORM public._b2c152_validar_linea(v_linea, v_arreglo.taller_id, v_tenant_id);
    END LOOP;
    -- Vaciar primero el borrador para que los triggers de asignacion no sumen
    -- la misma linea pendiente junto con la linea ya materializada.
    UPDATE public.arreglos
    SET repuestos_pendientes = NULL, updated_at = now()
    WHERE id = p_arreglo_id;
    PERFORM set_config('b2c152.activation', 'on', true);
    FOR v_linea IN SELECT x FROM jsonb_array_elements(v_pendientes) x ORDER BY x ->> 'id' LOOP
      v_tipo := upper(v_linea ->> 'tipo');
      IF v_tipo = 'EXISTENTE' THEN
        PERFORM public.rpc_asignar_repuesto_existente_con_compra(
          p_arreglo_id := p_arreglo_id,
          p_taller_id := v_arreglo.taller_id,
          p_stock_id := (v_linea ->> 'stock_id')::uuid,
          p_cantidad := (v_linea ->> 'cantidad')::integer,
          p_monto_unitario := (v_linea ->> 'monto_unitario')::numeric,
          p_precio_compra := NULLIF(v_linea ->> 'precio_compra', '')::numeric,
          p_categoria_arreglo_id := NULLIF(v_linea ->> 'categoria_arreglo_id', '')::uuid,
          p_empleado_id := NULLIF(v_linea ->> 'empleado_id', '')::uuid,
          p_cuenta_id := NULLIF(v_linea ->> 'cuenta_id', '')::uuid,
          p_idempotency_key := NULLIF(v_linea ->> 'idempotency_key', '')::uuid
        );
      ELSE
        PERFORM public.rpc_crear_producto_inline_para_arreglo(
          p_arreglo_id := p_arreglo_id,
          p_taller_id := v_arreglo.taller_id,
          p_codigo := v_linea ->> 'codigo',
          p_nombre := v_linea ->> 'nombre',
          p_precio_compra := (v_linea ->> 'precio_compra')::numeric,
          p_precio_venta := (v_linea ->> 'precio_venta')::numeric,
          p_cantidad := (v_linea ->> 'cantidad')::integer,
          p_categoria_arreglo_id := NULLIF(v_linea ->> 'categoria_arreglo_id', '')::uuid,
          p_empleado_id := NULLIF(v_linea ->> 'empleado_id', '')::uuid,
          p_cuenta_id := NULLIF(v_linea ->> 'cuenta_id', '')::uuid,
          p_idempotency_key := NULLIF(v_linea ->> 'idempotency_key', '')::uuid
        );
      END IF;
    END LOOP;
    UPDATE public.arreglos
    SET estado = p_nuevo_estado,
        precio_final = public.calcular_precio_final_arreglo(id),
        updated_at = now()
    WHERE id = p_arreglo_id;
  ELSE
    -- Presupuesto historico: sus asignaciones ya existen y no deben duplicarse.
    PERFORM set_config('b2c152.activation', 'on', true);
    UPDATE public.arreglos SET estado = p_nuevo_estado, updated_at = now() WHERE id = p_arreglo_id;
  END IF;
  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_activar_presupuesto"(uuid, public.estado_arreglo) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_activar_presupuesto"(uuid, public.estado_arreglo) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_activar_presupuesto"(uuid, public.estado_arreglo) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_activar_presupuesto"(uuid, public.estado_arreglo) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_activar_presupuesto"(uuid, public.estado_arreglo) TO "postgres";
