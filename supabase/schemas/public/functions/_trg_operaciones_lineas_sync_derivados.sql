CREATE OR REPLACE FUNCTION public._trg_operaciones_lineas_sync_derivados()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_arreglo_id uuid;
  v_old_arreglo_id uuid;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = NEW.operacion_id;
    PERFORM public._sync_arreglo_derivados(v_arreglo_id);
  END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    SELECT oa.arreglo_id INTO v_old_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = OLD.operacion_id;
    IF v_old_arreglo_id IS NOT NULL AND v_old_arreglo_id IS DISTINCT FROM v_arreglo_id THEN
      PERFORM public._sync_arreglo_derivados(v_old_arreglo_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_trg_operaciones_lineas_sync_derivados"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_trg_operaciones_lineas_sync_derivados"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_trg_operaciones_lineas_sync_derivados"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_trg_operaciones_lineas_sync_derivados"() TO "postgres";
