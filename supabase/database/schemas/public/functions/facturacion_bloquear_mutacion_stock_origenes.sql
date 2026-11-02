CREATE FUNCTION public.facturacion_bloquear_mutacion_stock_origenes()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.facturas_electronicas f WHERE f.id=OLD.factura_id AND f.estado='AUTORIZADA') THEN
      RAISE EXCEPTION 'El snapshot de origen autorizado es inmutable';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Los snapshots de origen no se modifican';
  END IF;
  IF EXISTS (SELECT 1 FROM public.facturas_electronicas f WHERE f.id=NEW.factura_id AND (f.documento_tipo <> 'FACTURA' OR f.estado='AUTORIZADA')) THEN
    RAISE EXCEPTION 'No se puede insertar snapshot para este documento';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.facturacion_bloquear_mutacion_stock_origenes() FROM PUBLIC;

GRANT ALL ON FUNCTION public.facturacion_bloquear_mutacion_stock_origenes() TO service_role;