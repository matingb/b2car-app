CREATE OR REPLACE FUNCTION public._sync_arreglo_derivados (
  p_arreglo_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_categorias uuid[];
  v_empleados uuid[];
BEGIN
  IF p_arreglo_id IS NULL THEN
    RETURN;
  END IF;
  SELECT
    COALESCE(ARRAY_AGG(DISTINCT cat_id) FILTER (WHERE cat_id IS NOT NULL), '{}'),
    COALESCE(ARRAY_AGG(DISTINCT empleado_id) FILTER (WHERE empleado_id IS NOT NULL), '{}')
  INTO v_categorias, v_empleados
  FROM (
    SELECT d.categoria_arreglo_id AS cat_id, d.empleado_id AS empleado_id
    FROM public.detalle_arreglo d
    WHERE d.arreglo_id = p_arreglo_id
    UNION ALL
    SELECT ol.categoria_arreglo_id AS cat_id, ol.empleado_id AS empleado_id
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    WHERE oa.arreglo_id = p_arreglo_id
  ) usos;
  UPDATE public.arreglos
  SET categorias = v_categorias,
      empleados = v_empleados
  WHERE id = p_arreglo_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_sync_arreglo_derivados"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_sync_arreglo_derivados"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_sync_arreglo_derivados"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_sync_arreglo_derivados"(uuid) TO "postgres";
