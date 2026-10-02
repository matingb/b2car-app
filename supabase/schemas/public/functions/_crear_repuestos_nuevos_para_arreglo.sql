CREATE OR REPLACE FUNCTION public._crear_repuestos_nuevos_para_arreglo (
  p_arreglo_id       uuid,
  p_taller_id        uuid,
  p_repuestos_nuevos jsonb,
  p_cuenta_id        uuid  DEFAULT NULL::uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos_nuevos IS NULL OR jsonb_array_length(p_repuestos_nuevos) = 0 THEN
    RETURN;
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos_nuevos)
  LOOP
    PERFORM public.rpc_crear_producto_inline_para_arreglo(
      p_arreglo_id := p_arreglo_id,
      p_taller_id := p_taller_id,
      p_codigo := v_item ->> 'codigo',
      p_nombre := v_item ->> 'nombre',
      p_precio_compra := (v_item ->> 'precio_compra')::numeric,
      p_precio_venta := (v_item ->> 'precio_venta')::numeric,
      p_cantidad := (v_item ->> 'cantidad')::integer,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid,
      p_cuenta_id := p_cuenta_id
    );
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_crear_repuestos_nuevos_para_arreglo"(uuid, uuid, jsonb, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_crear_repuestos_nuevos_para_arreglo"(uuid, uuid, jsonb, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_crear_repuestos_nuevos_para_arreglo"(uuid, uuid, jsonb, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_crear_repuestos_nuevos_para_arreglo"(uuid, uuid, jsonb, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_crear_repuestos_nuevos_para_arreglo"(uuid, uuid, jsonb, uuid) TO "postgres";
