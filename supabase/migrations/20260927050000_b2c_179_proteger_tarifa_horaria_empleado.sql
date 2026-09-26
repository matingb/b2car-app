-- Prevent tenant-scoped Data API writes from bypassing the employee edit permission.
CREATE OR REPLACE FUNCTION public._b2c179_proteger_valor_hora_empleado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public._b2c179_proteger_valor_hora_empleado()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS empleados_proteger_valor_hora ON public.empleados;
CREATE TRIGGER empleados_proteger_valor_hora
  BEFORE INSERT OR UPDATE OF valor_hora ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public._b2c179_proteger_valor_hora_empleado();
