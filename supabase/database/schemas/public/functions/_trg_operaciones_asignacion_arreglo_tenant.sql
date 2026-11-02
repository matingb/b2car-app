CREATE FUNCTION public._trg_operaciones_asignacion_arreglo_tenant()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := (SELECT tenant_id FROM public.operaciones WHERE id = NEW.operacion_id);
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := public.current_tenant_id();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public._trg_operaciones_asignacion_arreglo_tenant() TO anon;

GRANT ALL ON FUNCTION public._trg_operaciones_asignacion_arreglo_tenant() TO authenticated;

GRANT ALL ON FUNCTION public._trg_operaciones_asignacion_arreglo_tenant() TO service_role;