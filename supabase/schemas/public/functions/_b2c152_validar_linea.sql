CREATE OR REPLACE FUNCTION public._b2c152_validar_linea (
  p_linea     jsonb,
  p_taller_id uuid,
  p_tenant_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tipo text;
  v_id uuid;
  v_stock_id uuid;
  v_cantidad integer;
  v_monto numeric;
  v_precio_compra numeric;
  v_codigo text;
  v_nombre text;
BEGIN
  IF p_linea IS NULL OR jsonb_typeof(p_linea) <> 'object' THEN
    RAISE EXCEPTION 'repuesto pendiente invalido' USING ERRCODE = '22023';
  END IF;
  BEGIN v_id := (p_linea ->> 'id')::uuid; EXCEPTION WHEN invalid_text_representation THEN v_id := NULL; END;
  IF v_id IS NULL THEN RAISE EXCEPTION 'id de repuesto pendiente invalido' USING ERRCODE = '22023'; END IF;
  v_tipo := upper(trim(coalesce(p_linea ->> 'tipo', '')));
  v_cantidad := (p_linea ->> 'cantidad')::integer;
  v_monto := (p_linea ->> 'monto_unitario')::numeric;
  IF v_cantidad IS NULL OR v_cantidad <= 0 OR v_monto IS NULL OR v_monto < 0 THEN
    RAISE EXCEPTION 'cantidad o monto de repuesto pendiente invalido' USING ERRCODE = '22023';
  END IF;
  IF v_tipo = 'EXISTENTE' THEN
    BEGIN v_stock_id := (p_linea ->> 'stock_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN v_stock_id := NULL; END;
    IF v_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id de repuesto pendiente invalido' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.stocks s
      WHERE s.id = v_stock_id AND s.tenant_id = p_tenant_id AND s.taller_id = p_taller_id
    ) THEN
      RAISE EXCEPTION 'stock_id no pertenece al taller' USING ERRCODE = 'P0001';
    END IF;
    IF p_linea ? 'precio_compra' AND (p_linea ->> 'precio_compra') IS NOT NULL THEN
      v_precio_compra := (p_linea ->> 'precio_compra')::numeric;
      IF v_precio_compra < 0 THEN RAISE EXCEPTION 'precio_compra invalido' USING ERRCODE = '22023'; END IF;
    END IF;
  ELSIF v_tipo = 'NUEVO' THEN
    v_codigo := trim(coalesce(p_linea ->> 'codigo', ''));
    v_nombre := trim(coalesce(p_linea ->> 'nombre', ''));
    v_precio_compra := (p_linea ->> 'precio_compra')::numeric;
    IF v_codigo = '' OR v_nombre = '' OR v_precio_compra IS NULL OR v_precio_compra < 0 THEN
      RAISE EXCEPTION 'producto nuevo pendiente invalido' USING ERRCODE = '22023';
    END IF;
    IF (p_linea ->> 'precio_venta')::numeric IS NULL OR (p_linea ->> 'precio_venta')::numeric < 0 THEN
      RAISE EXCEPTION 'precio_venta invalido' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'tipo de repuesto pendiente invalido' USING ERRCODE = '22023';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_b2c152_validar_linea"(jsonb, uuid, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_b2c152_validar_linea"(jsonb, uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_b2c152_validar_linea"(jsonb, uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_b2c152_validar_linea"(jsonb, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_b2c152_validar_linea"(jsonb, uuid, uuid) TO "postgres";
