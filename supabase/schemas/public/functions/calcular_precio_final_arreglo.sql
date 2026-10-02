CREATE OR REPLACE FUNCTION public.calcular_precio_final_arreglo (
  p_arreglo_id uuid
)
  RETURNS numeric
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_servicios numeric := 0;
  v_asignaciones numeric := 0;
  v_pendientes numeric := 0;
BEGIN
  SELECT coalesce(sum(CASE
    WHEN d.horas_facturadas IS NULL THEN d.cantidad * d.precio_hora_facturada
    ELSE d.horas_facturadas * d.cantidad * d.precio_hora_facturada
  END), 0)
    INTO v_servicios
  FROM public.detalle_arreglo d
  WHERE d.arreglo_id = p_arreglo_id;
  SELECT coalesce(sum(ol.cantidad * ol.monto_unitario), 0)
    INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oaa
  JOIN public.operaciones_lineas ol ON ol.operacion_id = oaa.operacion_id
  WHERE oaa.arreglo_id = p_arreglo_id;
  SELECT coalesce(sum((x ->> 'cantidad')::numeric * (x ->> 'monto_unitario')::numeric), 0)
    INTO v_pendientes
  FROM public.arreglos a,
       jsonb_array_elements(coalesce(a.repuestos_pendientes, '[]'::jsonb)) x
  WHERE a.id = p_arreglo_id;
  RETURN v_servicios + v_asignaciones + v_pendientes;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) TO "postgres";
