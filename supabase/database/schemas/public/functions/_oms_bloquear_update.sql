CREATE FUNCTION public._oms_bloquear_update()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
BEGIN
  RAISE EXCEPTION 'Los impactos de stock son inmutables' USING ERRCODE = '55000';
END;
$function$;

GRANT ALL ON FUNCTION public._oms_bloquear_update() TO anon;

GRANT ALL ON FUNCTION public._oms_bloquear_update() TO authenticated;

GRANT ALL ON FUNCTION public._oms_bloquear_update() TO service_role;