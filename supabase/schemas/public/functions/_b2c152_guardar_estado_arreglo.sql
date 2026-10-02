CREATE OR REPLACE FUNCTION public._b2c152_guardar_estado_arreglo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF OLD.estado <> NEW.estado THEN
    IF OLD.estado <> 'PRESUPUESTO' AND NEW.estado = 'PRESUPUESTO' THEN
      RAISE EXCEPTION 'No se puede volver a PRESUPUESTO despues de activar el arreglo'
        USING ERRCODE = 'P0001';
    END IF;
    IF OLD.estado = 'PRESUPUESTO'
       AND NEW.estado <> 'PRESUPUESTO'
       AND NOT public._b2c152_activacion_guardada() THEN
      RAISE EXCEPTION 'La salida de PRESUPUESTO requiere rpc_activar_presupuesto'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_b2c152_guardar_estado_arreglo"() TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_b2c152_guardar_estado_arreglo"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_b2c152_guardar_estado_arreglo"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_b2c152_guardar_estado_arreglo"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_b2c152_guardar_estado_arreglo"() TO "postgres";
