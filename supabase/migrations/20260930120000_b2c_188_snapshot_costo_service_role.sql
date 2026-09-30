-- B2C-188: la migracion de datos historicos necesita conservar el costo hora
-- de cada tarea tal como lo trae el sistema anterior, incluido NULL cuando es
-- desconocido. La excepcion aplica solo a escrituras confiables de servidor
-- con service_role (scripts de migracion); la app escribe como authenticated y
-- conserva el comportamiento de B2C-179.
CREATE OR REPLACE FUNCTION public._snapshot_detalle_arreglo_valores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_taller_id uuid;
  v_precio_hora numeric;
  v_empleado_tenant_id uuid;
  v_empleado_taller_id uuid;
  v_empleado_valor_hora numeric;
  -- auth.role() es NULL fuera de PostgREST (SQL local, seed): sin coalesce la
  -- condicion booleana quedaria NULL y alteraria la logica de los IF.
  v_es_service_role boolean := coalesce(auth.role() = 'service_role', false);
  v_puede_editar_costos boolean := v_es_service_role
    OR public._b2c179_tiene_permiso('empleados:edit');
  v_resolver_precio boolean;
BEGIN
  SELECT a.tenant_id, a.taller_id, t.valor_hora
    INTO v_tenant_id, v_taller_id, v_precio_hora
    FROM public.arreglos a
    LEFT JOIN public.talleres t ON t.id = a.taller_id AND t.tenant_id = a.tenant_id
   WHERE a.id = NEW.arreglo_id;

  IF v_tenant_id IS NULL OR NEW.tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'arreglo no encontrado para el tenant del detalle';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.horas_facturadas := COALESCE(NEW.horas_facturadas, 1);
    NEW.horas_trabajadas := COALESCE(NEW.horas_trabajadas, 1);
    v_resolver_precio := NEW.precio_hora_facturada IS NULL;
  ELSE
    IF OLD.horas_facturadas IS NOT NULL AND NEW.horas_facturadas IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P1791',
        MESSAGE = 'Las horas facturadas ya definidas no pueden volver a desconocidas';
    END IF;
    v_resolver_precio := NEW.precio_hora_facturada IS NULL
      AND NEW.precio_hora_facturada IS DISTINCT FROM OLD.precio_hora_facturada;
  END IF;

  IF v_resolver_precio THEN
    NEW.precio_hora_facturada := COALESCE(v_precio_hora, 0);
  END IF;

  IF NEW.empleado_id IS NOT NULL THEN
    SELECT e.tenant_id, e.taller_id, e.valor_hora
      INTO v_empleado_tenant_id, v_empleado_taller_id, v_empleado_valor_hora
      FROM public.empleados e
     WHERE e.id = NEW.empleado_id;

    IF v_empleado_tenant_id IS NULL
       OR v_empleado_tenant_id IS DISTINCT FROM v_tenant_id
       OR v_empleado_taller_id IS DISTINCT FROM v_taller_id THEN
      RAISE EXCEPTION 'empleado no pertenece al tenant y taller del arreglo';
    END IF;

    IF TG_OP = 'INSERT' THEN
      -- service_role conserva el valor explicito, incluso NULL (costo
      -- historico desconocido); el resto mantiene el snapshot del empleado.
      IF (NEW.valor_hora_empleado IS NULL AND NOT v_es_service_role)
         OR NOT v_puede_editar_costos THEN
        NEW.valor_hora_empleado := v_empleado_valor_hora;
      END IF;
    ELSE
      IF NEW.empleado_id IS DISTINCT FROM OLD.empleado_id
         AND OLD.valor_hora_empleado IS NULL
         AND NEW.valor_hora_empleado IS NULL THEN
        NEW.valor_hora_empleado := v_empleado_valor_hora;
      ELSIF NOT v_puede_editar_costos
         AND NEW.valor_hora_empleado IS DISTINCT FROM OLD.valor_hora_empleado THEN
        IF NEW.empleado_id IS DISTINCT FROM OLD.empleado_id
           AND OLD.valor_hora_empleado IS NULL THEN
          NEW.valor_hora_empleado := v_empleado_valor_hora;
        ELSE
          NEW.valor_hora_empleado := OLD.valor_hora_empleado;
        END IF;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NOT v_puede_editar_costos
    AND NEW.valor_hora_empleado IS DISTINCT FROM OLD.valor_hora_empleado THEN
    NEW.valor_hora_empleado := NULL;
  ELSIF TG_OP = 'INSERT' AND NOT v_puede_editar_costos THEN
    NEW.valor_hora_empleado := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._snapshot_detalle_arreglo_valores()
  FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
