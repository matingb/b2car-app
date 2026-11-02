CREATE FUNCTION public._stock_aplicar_movimiento()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_saldo_ant int;
  v_saldo_post int;
BEGIN
  SELECT s.cantidad INTO v_saldo_ant
  FROM public.stocks s
  WHERE s.id = NEW.stock_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock no encontrado: %', NEW.stock_id USING ERRCODE = 'P0002';
  END IF;

  NEW.saldo_anterior := v_saldo_ant;
  v_saldo_post := v_saldo_ant + NEW.cantidad;
  NEW.saldo_posterior := v_saldo_post;

  IF v_saldo_post < 0 THEN
    IF NEW.reversion_de_id IS NOT NULL OR NEW.tipo_movimiento = 'REVERSION' THEN
      RAISE EXCEPTION 'STOCK_INSUFICIENTE: Stock insuficiente para revertir la operación' USING ERRCODE = '55005';
    ELSE
      RAISE EXCEPTION 'STOCK_INSUFICIENTE' USING ERRCODE = '55002';
    END IF;
  END IF;

  PERFORM set_config('app.stock_ledger_write', 'on', true);
  UPDATE public.stocks
  SET cantidad = v_saldo_post,
      updated_at = now()
  WHERE id = NEW.stock_id;

  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public._stock_aplicar_movimiento() TO anon;

GRANT ALL ON FUNCTION public._stock_aplicar_movimiento() TO authenticated;

GRANT ALL ON FUNCTION public._stock_aplicar_movimiento() TO service_role;