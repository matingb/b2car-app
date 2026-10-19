CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    v_id := COALESCE(NEW.id, OLD.id);
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE operacion_ajuste_id = v_id) THEN
      RAISE EXCEPTION 'No se puede modificar un ajuste generado por una nota de crédito';
    END IF;
  ELSE
    v_id := COALESCE(NEW.operacion_id, OLD.operacion_id);
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE operacion_ajuste_id = v_id) THEN
      RAISE EXCEPTION 'No se pueden modificar líneas de un ajuste generado por una nota de crédito';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc() TO authenticated, service_role;
