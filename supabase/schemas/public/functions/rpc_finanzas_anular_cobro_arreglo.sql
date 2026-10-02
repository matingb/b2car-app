CREATE OR REPLACE FUNCTION public.rpc_finanzas_anular_cobro_arreglo (
  p_arreglo_id   uuid,
  p_operacion_id uuid DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op_id uuid := p_operacion_id;
  v_importe_anulado numeric;
  v_nuevo_total numeric;
  v_cleanup_previo text := current_setting('app.finanzas_tenant_cleanup', true);
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  PERFORM 1
  FROM public.arreglos
  WHERE id = p_arreglo_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arreglo no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_op_id IS NULL THEN
    SELECT oca.operacion_id
    INTO v_op_id
    FROM public.operaciones_cobro_arreglo AS oca
    WHERE oca.arreglo_id = p_arreglo_id
      AND oca.tenant_id = v_tenant_id
    ORDER BY oca.created_at DESC
    LIMIT 1;
  END IF;
  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'No se encontraron cobros para este arreglo' USING ERRCODE = 'P0002';
  END IF;
  SELECT omc.importe
  INTO v_importe_anulado
  FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones_cobro_arreglo AS oca
    ON oca.operacion_id = omc.operacion_id
  WHERE omc.operacion_id = v_op_id
    AND omc.tenant_id = v_tenant_id
    AND oca.arreglo_id = p_arreglo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobro no encontrado para este arreglo' USING ERRCODE = 'P0002';
  END IF;
  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);
  DELETE FROM public.operaciones
  WHERE id = v_op_id
    AND tenant_id = v_tenant_id
    AND tipo = 'MOVIMIENTO_CUENTA';
  PERFORM set_config(
    'app.finanzas_tenant_cleanup',
    COALESCE(NULLIF(v_cleanup_previo, ''), 'off'),
    true
  );
  SELECT COALESCE(SUM(omc.importe), 0)
  INTO v_nuevo_total
  FROM public.operaciones_cobro_arreglo AS oca
  JOIN public.operaciones_movimiento_cuenta AS omc
    ON omc.operacion_id = oca.operacion_id
  WHERE oca.arreglo_id = p_arreglo_id
    AND oca.tenant_id = v_tenant_id;
  UPDATE public.arreglos
  SET total_cobrado = v_nuevo_total
  WHERE id = p_arreglo_id
    AND tenant_id = v_tenant_id;
  RETURN jsonb_build_object(
    'anulada_operacion_id', v_op_id,
    'importe_anulado', v_importe_anulado,
    'total_cobrado', v_nuevo_total
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_anular_cobro_arreglo"(uuid, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_anular_cobro_arreglo"(uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_finanzas_anular_cobro_arreglo"(uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_finanzas_anular_cobro_arreglo"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_anular_cobro_arreglo"(uuid, uuid) TO "postgres";
