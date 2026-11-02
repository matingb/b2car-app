CREATE FUNCTION public._operacion_validar_documento()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    IF TG_OP = 'DELETE' THEN PERFORM public._operacion_validar_documento_id(OLD.id);
    ELSE PERFORM public._operacion_validar_documento_id(NEW.id); END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN PERFORM public._operacion_validar_documento_id(OLD.operacion_id);
    ELSE PERFORM public._operacion_validar_documento_id(NEW.operacion_id); END IF;
    IF TG_OP = 'UPDATE' AND OLD.operacion_id IS DISTINCT FROM NEW.operacion_id THEN
      PERFORM public._operacion_validar_documento_id(OLD.operacion_id);
    END IF;
  END IF;
  RETURN NULL;
END $function$;

GRANT ALL ON FUNCTION public._operacion_validar_documento() TO anon;

GRANT ALL ON FUNCTION public._operacion_validar_documento() TO authenticated;

GRANT ALL ON FUNCTION public._operacion_validar_documento() TO service_role;