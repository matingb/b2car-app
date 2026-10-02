CREATE OR REPLACE FUNCTION public._b2c152_publicar_pendientes (
  p_pendientes jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  SELECT CASE WHEN p_pendientes IS NULL THEN NULL ELSE coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', x ->> 'id', 'tipo', x ->> 'tipo', 'stock_id', x ->> 'stock_id',
      'codigo', x ->> 'codigo', 'nombre', x ->> 'nombre',
      'precio_compra', x ->> 'precio_compra', 'precio_venta', x ->> 'precio_venta',
      'monto_unitario', x ->> 'monto_unitario', 'cantidad', x ->> 'cantidad',
      'categoria_arreglo_id', x ->> 'categoria_arreglo_id', 'empleado_id', x ->> 'empleado_id'
    )) ORDER BY (x ->> 'id')
  ), '[]'::jsonb) END
  FROM jsonb_array_elements(coalesce(p_pendientes, '[]'::jsonb)) x;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_b2c152_publicar_pendientes"(jsonb) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_b2c152_publicar_pendientes"(jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_b2c152_publicar_pendientes"(jsonb) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_b2c152_publicar_pendientes"(jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_b2c152_publicar_pendientes"(jsonb) TO "postgres";
