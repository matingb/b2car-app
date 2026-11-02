CREATE FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    v_id := COALESCE(NEW.id, OLD.id);
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE operacion_ajuste_id = v_id) THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'No se puede eliminar un ajuste generado por una nota de crédito';
      ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.tipo IS DISTINCT FROM OLD.tipo
           OR NEW.fecha IS DISTINCT FROM OLD.fecha
           OR NEW.taller_id IS DISTINCT FROM OLD.taller_id
           OR NEW.monto_total IS DISTINCT FROM OLD.monto_total
           OR NEW.observaciones IS DISTINCT FROM OLD.observaciones THEN
          RAISE EXCEPTION 'No se puede modificar un ajuste generado por una nota de crédito';
        END IF;
      END IF;
    END IF;
  ELSE
    v_id := COALESCE(NEW.operacion_id, OLD.operacion_id);
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE operacion_ajuste_id = v_id) THEN
      IF TG_OP = 'DELETE' OR TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'No se pueden modificar líneas de un ajuste generado por una nota de crédito';
      ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.stock_id IS DISTINCT FROM OLD.stock_id
           OR NEW.cantidad IS DISTINCT FROM OLD.cantidad
           OR NEW.monto_unitario IS DISTINCT FROM OLD.monto_unitario THEN
          RAISE EXCEPTION 'No se pueden modificar líneas de un ajuste generado por una nota de crédito';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

GRANT ALL ON FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc() TO anon;

GRANT ALL ON FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc() TO authenticated;

GRANT ALL ON FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc() TO service_role;