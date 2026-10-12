CREATE OR REPLACE FUNCTION public.calcular_precio_final_arreglo (
  p_arreglo_id uuid
)
  RETURNS numeric
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_arreglo public.arreglos;
BEGIN
  SELECT * INTO v_arreglo FROM public.arreglos WHERE id = p_arreglo_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF coalesce(auth.role(), '') <> 'service_role'
     AND v_arreglo.tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Arreglo fuera del tenant activo' USING ERRCODE = '42501';
  END IF;
  -- NULL snapshot treats entered prices as included; recalculation occurs only after an intentional edit, never as a migration backfill.
  RETURN public._b2c197_total_entradas(p_arreglo_id,
    v_arreglo.precios_incluyen_iva, v_arreglo.tasa_iva,
    v_arreglo.repuestos_pendientes, true);
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) TO "postgres";
