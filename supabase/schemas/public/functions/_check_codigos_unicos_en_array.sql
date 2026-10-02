CREATE OR REPLACE FUNCTION public._check_codigos_unicos_en_array (
  p_repuestos_nuevos jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_expected int;
  v_distinct int;
BEGIN
  IF p_repuestos_nuevos IS NULL OR jsonb_array_length(p_repuestos_nuevos) = 0 THEN
    RETURN;
  END IF;
  v_expected := (
    SELECT COUNT(*)
    FROM jsonb_array_elements(p_repuestos_nuevos) AS item
    WHERE trim(coalesce(item ->> 'codigo', '')) <> ''
  );
  v_distinct := (
    SELECT COUNT(DISTINCT lower(trim(item ->> 'codigo')))
    FROM jsonb_array_elements(p_repuestos_nuevos) AS item
    WHERE trim(coalesce(item ->> 'codigo', '')) <> ''
  );
  IF v_expected <> jsonb_array_length(p_repuestos_nuevos)
     OR v_expected <> v_distinct THEN
    RAISE EXCEPTION 'PRODUCTO_CODIGO_DUPLICADO'
    USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_check_codigos_unicos_en_array"(jsonb) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_check_codigos_unicos_en_array"(jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_check_codigos_unicos_en_array"(jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_check_codigos_unicos_en_array"(jsonb) TO "postgres";
