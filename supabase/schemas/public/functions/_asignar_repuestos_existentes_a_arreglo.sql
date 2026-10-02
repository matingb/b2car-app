CREATE OR REPLACE FUNCTION public._asignar_repuestos_existentes_a_arreglo (
  p_arreglo_id uuid,
  p_taller_id  uuid,
  p_repuestos  jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos IS NULL OR jsonb_array_length(p_repuestos) = 0 THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos) LOOP
    PERFORM public.rpc_asignar_repuesto_existente_con_compra(
      p_arreglo_id := p_arreglo_id, p_taller_id := p_taller_id,
      p_stock_id := (v_item ->> 'stock_id')::uuid, p_cantidad := (v_item ->> 'cantidad')::int,
      p_monto_unitario := (v_item ->> 'monto_unitario')::numeric,
      p_precio_compra := NULLIF(v_item ->> 'precio_compra', '')::numeric,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid
    );
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public._asignar_repuestos_existentes_a_arreglo (
  p_arreglo_id      uuid,
  p_taller_id       uuid,
  p_repuestos       jsonb,
  p_cuenta_id       uuid  DEFAULT NULL::uuid,
  p_idempotency_key uuid  DEFAULT NULL::uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos IS NULL OR jsonb_array_length(p_repuestos) = 0 THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos) LOOP
    PERFORM public.rpc_asignar_repuesto_existente_con_compra(
      p_arreglo_id := p_arreglo_id, p_taller_id := p_taller_id,
      p_stock_id := (v_item ->> 'stock_id')::uuid, p_cantidad := (v_item ->> 'cantidad')::int,
      p_monto_unitario := (v_item ->> 'monto_unitario')::numeric,
      p_precio_compra := NULLIF(v_item ->> 'precio_compra', '')::numeric,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid,
      p_cuenta_id := p_cuenta_id,
      p_idempotency_key := p_idempotency_key
    );
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_asignar_repuestos_existentes_a_arreglo"(uuid, uuid, jsonb) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_asignar_repuestos_existentes_a_arreglo"(uuid, uuid, jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."_asignar_repuestos_existentes_a_arreglo"(uuid, uuid, jsonb, uuid, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_asignar_repuestos_existentes_a_arreglo"(uuid, uuid, jsonb, uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_asignar_repuestos_existentes_a_arreglo"(uuid, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_asignar_repuestos_existentes_a_arreglo"(uuid, uuid, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "public"."_asignar_repuestos_existentes_a_arreglo"(uuid, uuid, jsonb, uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_asignar_repuestos_existentes_a_arreglo"(uuid, uuid, jsonb, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_asignar_repuestos_existentes_a_arreglo"(uuid, uuid, jsonb, uuid, uuid) TO "postgres";
