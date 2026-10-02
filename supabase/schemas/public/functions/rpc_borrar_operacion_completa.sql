CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_completa (
  p_operacion_id    uuid,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo public.tipo_operacion;
  v_arreglo_id uuid;
  v_eliminada boolean;
  v_resultado jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_operacion_id IS NULL THEN
    RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(v_tenant_id::text || ':borrar-operacion:' || p_idempotency_key::text)
    );
  END IF;
  SELECT o.tipo, oca.arreglo_id
  INTO v_tipo, v_arreglo_id
  FROM public.operaciones AS o
  LEFT JOIN public.operaciones_cobro_arreglo AS oca
    ON oca.operacion_id = o.id
   AND oca.tenant_id = v_tenant_id
  WHERE o.id = p_operacion_id
    AND o.tenant_id = v_tenant_id
  FOR UPDATE OF o;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operacion no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_arreglo_id IS NOT NULL THEN
    v_resultado := public.rpc_finanzas_anular_cobro_arreglo(
      v_arreglo_id,
      p_operacion_id
    );
    RETURN jsonb_build_object(
      'eliminada', true,
      'tipo', 'COBRO_ARREGLO',
      'arreglo_id', v_arreglo_id,
      'resultado_cobro', v_resultado
    );
  END IF;
  IF v_tipo = 'MOVIMIENTO_CUENTA' THEN
    v_eliminada := public.rpc_eliminar_movimiento_cuenta(p_operacion_id);
  ELSE
    v_eliminada := public.rpc_borrar_operacion_con_stock(
      p_operacion_id,
      p_idempotency_key
    );
  END IF;
  IF NOT COALESCE(v_eliminada, false) THEN
    RAISE EXCEPTION 'Operacion no encontrada' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'eliminada', true,
    'tipo', v_tipo::text,
    'arreglo_id', NULL
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_borrar_operacion_completa"(uuid, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_borrar_operacion_completa"(uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_borrar_operacion_completa"(uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_borrar_operacion_completa"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_borrar_operacion_completa"(uuid, uuid) TO "postgres";
