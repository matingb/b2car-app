CREATE OR REPLACE FUNCTION public.recalcular_precio_final_arreglo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_rec jsonb;
  v_arreglo_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;
  IF TG_TABLE_NAME = 'detalle_arreglo' THEN
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  ELSIF TG_TABLE_NAME = 'operaciones_asignacion_arreglo' THEN
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  ELSIF TG_TABLE_NAME = 'operaciones_lineas' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'operacion_id')::uuid
    LIMIT 1;
    IF v_arreglo_id IS NULL THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
  END IF;
  IF v_arreglo_id IS NOT NULL THEN
    UPDATE public.arreglos
    SET precio_final = public.calcular_precio_final_arreglo(v_arreglo_id)
    WHERE id = v_arreglo_id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."recalcular_precio_final_arreglo"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."recalcular_precio_final_arreglo"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."recalcular_precio_final_arreglo"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."recalcular_precio_final_arreglo"() TO "postgres";
