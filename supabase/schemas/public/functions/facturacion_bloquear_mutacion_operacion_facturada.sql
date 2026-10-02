CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_rec jsonb;
  v_operacion_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;
  IF TG_TABLE_NAME = 'operaciones' THEN
    v_operacion_id := (v_rec ->> 'id')::uuid;
  ELSE
    v_operacion_id := (v_rec ->> 'operacion_id')::uuid;
  END IF;
  IF public.facturacion_operacion_autorizada(v_operacion_id) THEN
    RAISE EXCEPTION 'No se puede modificar una venta con comprobante fiscal autorizado';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_mutacion_operacion_facturada"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_mutacion_operacion_facturada"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."facturacion_bloquear_mutacion_operacion_facturada"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_mutacion_operacion_facturada"() TO "postgres";
