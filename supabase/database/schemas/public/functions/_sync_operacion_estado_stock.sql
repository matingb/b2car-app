CREATE FUNCTION public._sync_operacion_estado_stock (
  p_operacion_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tipo public.tipo_operacion;
  v_pactada int;
  v_cumplida int;
  v_cancelada int;
  v_nuevo public.estado_stock_operacion;
BEGIN
  IF p_operacion_id IS NULL THEN RETURN; END IF;

  SELECT tipo INTO v_tipo FROM public.operaciones WHERE id = p_operacion_id;
  IF v_tipo NOT IN ('COMPRA', 'VENTA') THEN RETURN; END IF;

  SELECT COALESCE(SUM(cantidad), 0),
         COALESCE(SUM(cantidad_cumplida), 0),
         COALESCE(SUM(cantidad_cancelada), 0)
  INTO v_pactada, v_cumplida, v_cancelada
  FROM public.operaciones_lineas
  WHERE operacion_id = p_operacion_id;

  IF v_pactada = 0 THEN
    v_nuevo := 'ENTREGADO';
  ELSIF (v_cumplida + v_cancelada) >= v_pactada THEN
    v_nuevo := 'ENTREGADO';
  ELSIF v_cumplida > 0 OR v_cancelada > 0 THEN
    v_nuevo := 'PARCIAL';
  ELSE
    v_nuevo := 'PENDIENTE';
  END IF;

  UPDATE public.operaciones
  SET estado_stock = v_nuevo
  WHERE id = p_operacion_id
    AND estado_stock IS DISTINCT FROM v_nuevo;
END;
$function$;

REVOKE ALL ON FUNCTION public._sync_operacion_estado_stock(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public._sync_operacion_estado_stock(uuid) TO service_role;