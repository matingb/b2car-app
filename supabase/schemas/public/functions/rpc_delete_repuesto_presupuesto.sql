CREATE OR REPLACE FUNCTION public.rpc_delete_repuesto_presupuesto (
  p_arreglo_id uuid,
  p_taller_id  uuid,
  p_linea_id   uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo public.arreglos;
  v_items jsonb;
BEGIN
  SELECT * INTO v_arreglo FROM public.arreglos
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id AND taller_id = p_taller_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_arreglo.estado <> 'PRESUPUESTO' OR v_arreglo.repuestos_pendientes IS NULL THEN
    RAISE EXCEPTION 'El arreglo no es un presupuesto administrado' USING ERRCODE = 'P0001';
  END IF;
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_items
  FROM jsonb_array_elements(v_arreglo.repuestos_pendientes) x
  WHERE (x ->> 'id')::uuid <> p_linea_id;
  IF jsonb_array_length(v_items) = jsonb_array_length(v_arreglo.repuestos_pendientes) THEN
    RAISE EXCEPTION 'Repuesto pendiente no encontrado' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.arreglos
  SET repuestos_pendientes = v_items,
      updated_at = now()
  WHERE id = p_arreglo_id;
  UPDATE public.arreglos
  SET precio_final = public.calcular_precio_final_arreglo(id)
  WHERE id = p_arreglo_id;
  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_delete_repuesto_presupuesto"(uuid, uuid, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_delete_repuesto_presupuesto"(uuid, uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_delete_repuesto_presupuesto"(uuid, uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_delete_repuesto_presupuesto"(uuid, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_delete_repuesto_presupuesto"(uuid, uuid, uuid) TO "postgres";
