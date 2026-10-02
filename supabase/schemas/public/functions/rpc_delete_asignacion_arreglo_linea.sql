CREATE OR REPLACE FUNCTION public.rpc_delete_asignacion_arreglo_linea (
  p_operacion_linea_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid;
  v_operacion_id uuid;
  v_taller_id uuid;
  v_stock_id uuid;
  v_cantidad int;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;
  IF p_operacion_linea_id IS NULL THEN
    RAISE EXCEPTION 'operacion_linea_id requerido';
  END IF;
  SELECT l.operacion_id, o.taller_id, l.stock_id, l.cantidad
  INTO v_operacion_id, v_taller_id, v_stock_id, v_cantidad
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  WHERE l.id = p_operacion_linea_id
    AND o.tipo = 'ASIGNACION_ARREGLO';
  IF v_operacion_id IS NULL THEN
    RAISE EXCEPTION 'línea no encontrada (%).', p_operacion_linea_id;
  END IF;
  -- borrar la línea primero
  DELETE FROM public.operaciones_lineas
  WHERE id = p_operacion_linea_id;
  -- devolver stock (+cantidad)
  UPDATE public.stocks s
  SET cantidad = s.cantidad + v_cantidad,
      updated_at = now()
  WHERE s.id = v_stock_id;
  -- si ya no quedan líneas, eliminar operación (cascada elimina vínculo)
  IF NOT EXISTS (
    SELECT 1 FROM public.operaciones_lineas ol WHERE ol.operacion_id = v_operacion_id LIMIT 1
  ) THEN
    DELETE FROM public.operaciones o WHERE o.id = v_operacion_id;
  END IF;
  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_delete_asignacion_arreglo_linea"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_delete_asignacion_arreglo_linea"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_delete_asignacion_arreglo_linea"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_delete_asignacion_arreglo_linea"(uuid) TO "postgres";
