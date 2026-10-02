CREATE OR REPLACE FUNCTION public._check_codigo_no_existe_en_productos (
  p_codigo text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_codigo text := lower(trim(coalesce(p_codigo, '')));
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;
  IF v_codigo = '' THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.productos p
    WHERE p.tenant_id = v_tenant_id
      AND lower(trim(p.codigo)) = v_codigo
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'PRODUCTO_CODIGO_DUPLICADO (%)', p_codigo
    USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_check_codigo_no_existe_en_productos"(text) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_check_codigo_no_existe_en_productos"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_check_codigo_no_existe_en_productos"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_check_codigo_no_existe_en_productos"(text) TO "postgres";
