CREATE OR REPLACE FUNCTION public.rpc_upsert_repuesto_presupuesto (
  p_arreglo_id uuid,
  p_taller_id  uuid,
  p_linea_id   uuid  DEFAULT NULL::uuid,
  p_linea      jsonb DEFAULT NULL::jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo public.arreglos;
  v_linea jsonb := coalesce(p_linea, '{}'::jsonb);
  v_old jsonb;
  v_items jsonb;
BEGIN
  SELECT * INTO v_arreglo FROM public.arreglos
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id AND taller_id = p_taller_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_arreglo.estado <> 'PRESUPUESTO' OR v_arreglo.repuestos_pendientes IS NULL THEN
    RAISE EXCEPTION 'El arreglo no es un presupuesto administrado' USING ERRCODE = 'P0001';
  END IF;
  IF p_linea_id IS NOT NULL THEN
    SELECT x INTO v_old FROM jsonb_array_elements(v_arreglo.repuestos_pendientes) x
    WHERE (x ->> 'id')::uuid = p_linea_id;
    IF v_old IS NULL THEN RAISE EXCEPTION 'Repuesto pendiente no encontrado' USING ERRCODE = 'P0002'; END IF;
  END IF;
  IF v_old IS NOT NULL THEN
    IF v_linea ? 'precio_compra' AND (v_linea -> 'precio_compra') IS NULL THEN
      -- Un null explicito elimina la intencion de compra y sus metadatos.
      v_linea := v_old || v_linea || jsonb_build_object(
        'cuenta_id', NULL,
        'idempotency_key', NULL
      );
    ELSE
      -- Los campos omitidos son "sin cambio": conserva precio, cuenta y clave.
      v_linea := v_old || v_linea;
      v_linea := v_linea || jsonb_build_object(
        'idempotency_key', coalesce(v_linea ->> 'idempotency_key', v_old ->> 'idempotency_key'),
        'cuenta_id', coalesce(v_linea ->> 'cuenta_id', v_old ->> 'cuenta_id')
      );
    END IF;
  END IF;
  v_linea := v_linea || jsonb_build_object('id', coalesce(p_linea_id, gen_random_uuid())::text);
  v_linea := jsonb_set(v_linea, '{tipo}', to_jsonb(upper(coalesce(v_linea ->> 'tipo', 'EXISTENTE'))), true);
  PERFORM public._b2c152_validar_linea(v_linea, p_taller_id, v_tenant_id);
  IF upper(v_linea ->> 'tipo') = 'NUEVO' THEN
    PERFORM public._check_codigo_no_existe_en_productos(v_linea ->> 'codigo');
  END IF;
  IF v_linea ->> 'cuenta_id' IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cuentas_financieras c
    WHERE c.id = (v_linea ->> 'cuenta_id')::uuid AND c.tenant_id = v_tenant_id AND c.activo
  ) THEN
    RAISE EXCEPTION 'CUENTA_FINANCIERA_REQUERIDA' USING ERRCODE = 'P0001';
  END IF;
  IF p_linea_id IS NULL THEN
    v_items := v_arreglo.repuestos_pendientes || jsonb_build_array(v_linea);
  ELSE
    SELECT coalesce(jsonb_agg(CASE WHEN (x ->> 'id')::uuid = p_linea_id THEN v_linea ELSE x END), '[]'::jsonb)
      INTO v_items FROM jsonb_array_elements(v_arreglo.repuestos_pendientes) x;
  END IF;
  UPDATE public.arreglos
  SET repuestos_pendientes = v_items,
      updated_at = now()
  WHERE id = p_arreglo_id;
  UPDATE public.arreglos
  SET precio_final = public.calcular_precio_final_arreglo(id)
  WHERE id = p_arreglo_id;
  RETURN jsonb_build_object('id', v_linea ->> 'id');
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_upsert_repuesto_presupuesto"(uuid, uuid, uuid, jsonb) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_upsert_repuesto_presupuesto"(uuid, uuid, uuid, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_upsert_repuesto_presupuesto"(uuid, uuid, uuid, jsonb) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_upsert_repuesto_presupuesto"(uuid, uuid, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_upsert_repuesto_presupuesto"(uuid, uuid, uuid, jsonb) TO "postgres";
