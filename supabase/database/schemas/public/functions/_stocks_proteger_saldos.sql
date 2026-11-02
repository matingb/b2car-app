CREATE FUNCTION public._stocks_proteger_saldos()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.cantidad := 0;
    NEW.cantidad_reservada := 0;
    NEW.cantidad_pendiente := 0;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.cantidad IS DISTINCT FROM OLD.cantidad THEN
      IF current_setting('app.stock_ledger_write', true) IS DISTINCT FROM 'on'
         AND current_setting('app.stock_cleanup', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'La cantidad de stock solo puede modificarse a través del kardex' USING ERRCODE = '55000';
      END IF;
    END IF;

    IF NEW.cantidad_reservada IS DISTINCT FROM OLD.cantidad_reservada
       OR NEW.cantidad_pendiente IS DISTINCT FROM OLD.cantidad_pendiente THEN
      IF current_setting('app.stock_derivados_write', true) IS DISTINCT FROM 'on'
         AND current_setting('app.stock_cleanup', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'Las cantidades reservada y pendiente de stock solo pueden modificarse a través de derivados' USING ERRCODE = '55000';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public._stocks_proteger_saldos() TO anon;

GRANT ALL ON FUNCTION public._stocks_proteger_saldos() TO authenticated;

GRANT ALL ON FUNCTION public._stocks_proteger_saldos() TO service_role;