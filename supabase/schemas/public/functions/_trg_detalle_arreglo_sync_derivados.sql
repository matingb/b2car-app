CREATE OR REPLACE FUNCTION public._trg_detalle_arreglo_sync_derivados()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._sync_arreglo_derivados(OLD.arreglo_id);
    RETURN OLD;
  END IF;
  PERFORM public._sync_arreglo_derivados(NEW.arreglo_id);
  IF TG_OP = 'UPDATE' AND OLD.arreglo_id IS DISTINCT FROM NEW.arreglo_id THEN
    PERFORM public._sync_arreglo_derivados(OLD.arreglo_id);
  END IF;
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_trg_detalle_arreglo_sync_derivados"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_trg_detalle_arreglo_sync_derivados"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_trg_detalle_arreglo_sync_derivados"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_trg_detalle_arreglo_sync_derivados"() TO "postgres";
