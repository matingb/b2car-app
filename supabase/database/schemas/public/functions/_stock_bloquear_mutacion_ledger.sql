CREATE FUNCTION public._stock_bloquear_mutacion_ledger()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF current_setting('app.stock_tenant_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'Los registros del kardex de stock son inmutables.' USING ERRCODE = '55000';
END;
$function$;

GRANT ALL ON FUNCTION public._stock_bloquear_mutacion_ledger() TO anon;

GRANT ALL ON FUNCTION public._stock_bloquear_mutacion_ledger() TO authenticated;

GRANT ALL ON FUNCTION public._stock_bloquear_mutacion_ledger() TO service_role;