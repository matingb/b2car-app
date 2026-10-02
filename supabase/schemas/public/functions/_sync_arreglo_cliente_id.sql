CREATE OR REPLACE FUNCTION public._sync_arreglo_cliente_id()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF NEW.cliente_id IS NULL AND NEW.vehiculo_id IS NOT NULL THEN
    SELECT v.cliente_id INTO NEW.cliente_id
    FROM public.vehiculos v
    WHERE v.id = NEW.vehiculo_id;
  END IF;
  RETURN NEW;
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."_sync_arreglo_cliente_id"() TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_sync_arreglo_cliente_id"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_sync_arreglo_cliente_id"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_sync_arreglo_cliente_id"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_sync_arreglo_cliente_id"() TO "postgres";
