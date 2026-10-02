CREATE OR REPLACE FUNCTION public._insert_detalles_arreglo (
  p_arreglo_id uuid,
  p_detalles   jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_item jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN RETURN; END IF;
  PERFORM 1 FROM public.arreglos WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles) LOOP
    INSERT INTO public.detalle_arreglo (
      tenant_id, arreglo_id, descripcion, cantidad, precio_hora_facturada,
      horas_facturadas, horas_trabajadas, valor_hora_empleado,
      categoria_arreglo_id, empleado_id
    ) VALUES (
      v_tenant_id, p_arreglo_id, trim(coalesce(v_item ->> 'descripcion', '')),
      COALESCE(NULLIF(v_item ->> 'cantidad', '')::numeric, 1),
      NULLIF(v_item ->> 'precio_hora_facturada', '')::numeric,
      COALESCE(NULLIF(v_item ->> 'horas_facturadas', '')::numeric, 1),
      COALESCE(NULLIF(v_item ->> 'horas_trabajadas', '')::numeric, 1),
      NULLIF(v_item ->> 'valor_hora_empleado', '')::numeric,
      NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      NULLIF(v_item ->> 'empleado_id', '')::uuid
    );
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_insert_detalles_arreglo"(uuid, jsonb) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_insert_detalles_arreglo"(uuid, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_insert_detalles_arreglo"(uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_insert_detalles_arreglo"(uuid, jsonb) TO "postgres";
