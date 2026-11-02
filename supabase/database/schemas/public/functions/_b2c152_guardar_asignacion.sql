CREATE FUNCTION public._b2c152_guardar_asignacion()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
DECLARE
  v_estado public.estado_arreglo;
  v_repuestos_pendientes jsonb;
BEGIN
  SELECT estado, repuestos_pendientes
    INTO v_estado, v_repuestos_pendientes
  FROM public.arreglos
  WHERE id = NEW.arreglo_id;
  IF v_estado = 'PRESUPUESTO'
     AND v_repuestos_pendientes IS NOT NULL
     AND NOT public._b2c152_activacion_guardada() THEN
    RAISE EXCEPTION 'Un presupuesto no puede recibir asignaciones operativas'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._b2c152_guardar_asignacion() FROM PUBLIC;