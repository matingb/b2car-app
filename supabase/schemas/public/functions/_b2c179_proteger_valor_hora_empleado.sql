CREATE OR REPLACE FUNCTION public._b2c179_proteger_valor_hora_empleado()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
BEGIN
  -- Trusted server-side operations and local SQL administration can maintain the master.
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT public._b2c179_tiene_permiso('empleados:edit') THEN
    IF TG_OP = 'INSERT' AND NEW.valor_hora IS NOT NULL THEN
      RAISE EXCEPTION 'permiso empleados:edit requerido para asignar valor_hora'
        USING ERRCODE = '42501';
    ELSIF TG_OP = 'UPDATE'
      AND NEW.valor_hora IS DISTINCT FROM OLD.valor_hora THEN
      RAISE EXCEPTION 'permiso empleados:edit requerido para modificar valor_hora'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_b2c179_proteger_valor_hora_empleado"() TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_b2c179_proteger_valor_hora_empleado"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_b2c179_proteger_valor_hora_empleado"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_b2c179_proteger_valor_hora_empleado"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_b2c179_proteger_valor_hora_empleado"() TO "postgres";
