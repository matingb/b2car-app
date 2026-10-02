CREATE OR REPLACE FUNCTION public.obtener_operaciones_por_arreglo_id (
  p_arreglo_id uuid
)
  RETURNS uuid[]
  LANGUAGE sql
  AS $function$
    select coalesce(array_agg(o.operacion_id), '{}')
    from public.operaciones_asignacion_arreglo o
    where o.arreglo_id = p_arreglo_id;
$function$;

GRANT EXECUTE ON FUNCTION "public"."obtener_operaciones_por_arreglo_id"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."obtener_operaciones_por_arreglo_id"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."obtener_operaciones_por_arreglo_id"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."obtener_operaciones_por_arreglo_id"(uuid) TO "postgres";
