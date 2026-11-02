CREATE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_operacion_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    v_operacion_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_operacion_id := COALESCE(NEW.operacion_id, OLD.operacion_id);
  END IF;

  IF public.facturacion_operacion_autorizada(v_operacion_id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'No se puede eliminar una venta con comprobante fiscal autorizado';
    ELSIF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'No se pueden agregar líneas a una venta con comprobante fiscal autorizado';
    ELSIF TG_OP = 'UPDATE' THEN
      IF TG_TABLE_NAME = 'operaciones' THEN
        IF NEW.tipo IS DISTINCT FROM OLD.tipo
           OR NEW.fecha IS DISTINCT FROM OLD.fecha
           OR NEW.taller_id IS DISTINCT FROM OLD.taller_id
           OR NEW.monto_total IS DISTINCT FROM OLD.monto_total
           OR NEW.observaciones IS DISTINCT FROM OLD.observaciones THEN
          RAISE EXCEPTION 'No se pueden modificar datos fiscales de una venta con comprobante fiscal autorizado';
        END IF;
      ELSIF TG_TABLE_NAME = 'operaciones_lineas' THEN
        IF NEW.stock_id IS DISTINCT FROM OLD.stock_id
           OR NEW.operacion_id IS DISTINCT FROM OLD.operacion_id
           OR NEW.sentido IS DISTINCT FROM OLD.sentido
           OR NEW.cantidad IS DISTINCT FROM OLD.cantidad
           OR NEW.monto_unitario IS DISTINCT FROM OLD.monto_unitario
           OR NEW.iva_alicuota_id IS DISTINCT FROM OLD.iva_alicuota_id THEN
          RAISE EXCEPTION 'No se pueden modificar líneas de una venta con comprobante fiscal autorizado';
        END IF;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada() TO anon;

GRANT ALL ON FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada() TO authenticated;

GRANT ALL ON FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada() TO service_role;