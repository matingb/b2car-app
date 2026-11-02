CREATE FUNCTION public.rpc_borrar_arreglo (
  p_arreglo_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_cobro record;
  v_asignacion record;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  PERFORM 1
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arreglo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF public.facturacion_arreglo_autorizado(p_arreglo_id) THEN
    RAISE EXCEPTION 'El arreglo ya posee una factura electronica autorizada y sus datos fiscales no se pueden modificar'
      USING ERRCODE = '55001';
  END IF;

  FOR v_cobro IN
    SELECT oca.operacion_id
    FROM public.operaciones_cobro_arreglo AS oca
    WHERE oca.arreglo_id = p_arreglo_id
      AND oca.tenant_id = v_tenant_id
    ORDER BY oca.created_at, oca.operacion_id
  LOOP
    PERFORM public.rpc_finanzas_anular_cobro_arreglo(
      p_arreglo_id,
      v_cobro.operacion_id
    );
  END LOOP;

  FOR v_asignacion IN
    SELECT oa.operacion_id
    FROM public.operaciones_asignacion_arreglo AS oa
    JOIN public.operaciones AS o ON o.id = oa.operacion_id
    WHERE oa.arreglo_id = p_arreglo_id
      AND o.tenant_id = v_tenant_id
  LOOP
    PERFORM public.rpc_borrar_operacion_con_stock(
      v_asignacion.operacion_id
    );
  END LOOP;

  DELETE FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_borrar_arreglo(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_borrar_arreglo(uuid) TO anon;

GRANT ALL ON FUNCTION public.rpc_borrar_arreglo(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_borrar_arreglo(uuid) TO service_role;