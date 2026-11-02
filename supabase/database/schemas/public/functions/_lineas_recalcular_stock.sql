CREATE FUNCTION public._lineas_recalcular_stock()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF current_setting('app.stock_tenant_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM public._sync_stock_derivados(NEW.stock_id);
    IF TG_OP = 'UPDATE' AND OLD.stock_id IS DISTINCT FROM NEW.stock_id THEN
      PERFORM public._sync_stock_derivados(OLD.stock_id);
    END IF;
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (NEW.cantidad IS DISTINCT FROM OLD.cantidad OR NEW.cantidad_cancelada IS DISTINCT FROM OLD.cantidad_cancelada)) THEN
      PERFORM public._sync_operacion_estado_stock(NEW.operacion_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public._sync_stock_derivados(OLD.stock_id);
    PERFORM public._sync_operacion_estado_stock(OLD.operacion_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

GRANT ALL ON FUNCTION public._lineas_recalcular_stock() TO anon;

GRANT ALL ON FUNCTION public._lineas_recalcular_stock() TO authenticated;

GRANT ALL ON FUNCTION public._lineas_recalcular_stock() TO service_role;