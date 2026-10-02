CREATE OR REPLACE FUNCTION public._insert_detalle_form_custom (
  p_arreglo_id uuid,
  p_form       jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;
  IF p_form IS NULL OR jsonb_typeof(p_form) <> 'object' THEN
    RETURN;
  END IF;
  PERFORM 1 FROM public.arreglos
   WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'arreglo no encontrado';
  END IF;
  INSERT INTO public.detalle_form_custom (
    tenant_id, arreglo_id, config_id, costo, metadata
  )
  VALUES (
    v_tenant_id, p_arreglo_id,
    NULLIF(coalesce(p_form ->> 'formulario_id', p_form ->> 'config_id', ''), '')::uuid,
    COALESCE((p_form ->> 'costo')::numeric, 0),
    COALESCE(p_form -> 'metadata', '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_insert_detalle_form_custom"(uuid, jsonb) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_insert_detalle_form_custom"(uuid, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_insert_detalle_form_custom"(uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_insert_detalle_form_custom"(uuid, jsonb) TO "postgres";
