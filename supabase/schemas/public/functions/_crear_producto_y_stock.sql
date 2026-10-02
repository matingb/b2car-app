CREATE OR REPLACE FUNCTION public._crear_producto_y_stock (
  p_taller_id     uuid,
  p_codigo        text,
  p_nombre        text,
  p_precio_compra numeric,
  p_precio_venta  numeric
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_producto_id uuid;
  v_stock_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;
  INSERT INTO public.productos (
    tenant_id, codigo, nombre, precio_unitario, costo_unitario, categorias, show_in_stock
  )
  VALUES (
    v_tenant_id, trim(p_codigo), trim(p_nombre),
    p_precio_venta, p_precio_compra, ARRAY[]::text[], false
  )
  RETURNING id INTO v_producto_id;
  INSERT INTO public.stocks (
    tenant_id, taller_id, producto_id, cantidad, stock_minimo, stock_maximo
  )
  VALUES (
    v_tenant_id, p_taller_id, v_producto_id, 0, 0, 0
  )
  RETURNING id INTO v_stock_id;
  RETURN v_stock_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_crear_producto_y_stock"(uuid, text, text, numeric, numeric) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_crear_producto_y_stock"(uuid, text, text, numeric, numeric) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_crear_producto_y_stock"(uuid, text, text, numeric, numeric) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_crear_producto_y_stock"(uuid, text, text, numeric, numeric) TO "postgres";
