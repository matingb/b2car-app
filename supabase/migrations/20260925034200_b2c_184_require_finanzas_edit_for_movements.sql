CREATE OR REPLACE FUNCTION public.rpc_crear_movimiento_cuenta(
  p_subtipo text, p_importe numeric,
  p_descripcion text DEFAULT NULL, p_categoria_gasto text DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_cuenta_origen_id uuid DEFAULT NULL, p_cuenta_destino_id uuid DEFAULT NULL,
  p_fecha timestamptz DEFAULT now(), p_idempotency_key uuid DEFAULT NULL,
  p_arreglo_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id   uuid := public.current_tenant_id();
  v_subtipo     text := upper(btrim(coalesce(p_subtipo, '')));
  v_op_id       uuid;
  v_existente   uuid;
  v_importe_omc numeric;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF auth.role() = 'authenticated'
     AND NOT public._b2c179_tiene_permiso('finanzas:edit') THEN
    RAISE EXCEPTION 'permiso finanzas:edit requerido' USING ERRCODE = '42501';
  END IF;
  IF v_subtipo NOT IN ('GASTO', 'INGRESO', 'TRANSFERENCIA') THEN
    RAISE EXCEPTION 'subtipo invalido: %. Validos: GASTO, INGRESO, TRANSFERENCIA', p_subtipo USING ERRCODE = '22023';
  END IF;
  IF p_importe IS NULL OR p_importe <= 0 THEN
    RAISE EXCEPTION 'importe debe ser un valor positivo mayor a cero' USING ERRCODE = '22023';
  END IF;
  IF v_subtipo IN ('GASTO', 'INGRESO') AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id es requerido para %', v_subtipo USING ERRCODE = '22023';
  END IF;
  IF v_subtipo = 'TRANSFERENCIA' THEN
    IF p_cuenta_origen_id IS NULL OR p_cuenta_destino_id IS NULL THEN
      RAISE EXCEPTION 'cuenta_origen_id y cuenta_destino_id son requeridos' USING ERRCODE = '22023';
    END IF;
    IF p_cuenta_origen_id = p_cuenta_destino_id THEN
      RAISE EXCEPTION 'Las cuentas de origen y destino deben ser distintas' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_subtipo = 'GASTO' AND (p_categoria_gasto IS NULL OR btrim(p_categoria_gasto) = '') THEN
    RAISE EXCEPTION 'categoria_gasto es requerida para un GASTO' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_existente FROM public.operaciones_movimiento_cuenta AS omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;
    IF v_existente IS NOT NULL THEN RETURN v_existente; END IF;
  END IF;

  IF v_subtipo IN ('GASTO', 'INGRESO') THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  ELSIF v_subtipo = 'TRANSFERENCIA' THEN
    IF p_cuenta_origen_id < p_cuenta_destino_id THEN
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_origen_id, v_tenant_id, true);
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_destino_id, v_tenant_id, true);
    ELSE
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_destino_id, v_tenant_id, true);
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_origen_id, v_tenant_id, true);
    END IF;
  END IF;

  v_importe_omc := CASE WHEN v_subtipo = 'GASTO' THEN -p_importe ELSE p_importe END;

  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha, now())) RETURNING id INTO v_op_id;

  INSERT INTO public.operaciones_movimiento_cuenta (
    operacion_id, tenant_id, subtipo, cuenta_id, importe,
    cuenta_origen_id, cuenta_destino_id, categoria_gasto,
    descripcion, idempotency_key, created_by
  ) VALUES (
    v_op_id, v_tenant_id, v_subtipo, p_cuenta_id, v_importe_omc,
    p_cuenta_origen_id, p_cuenta_destino_id,
    CASE WHEN v_subtipo = 'GASTO' THEN p_categoria_gasto ELSE NULL END,
    nullif(btrim(p_descripcion), ''), p_idempotency_key, auth.uid()
  );

  RETURN v_op_id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_crear_movimiento_cuenta(text,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_movimiento_cuenta(text,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
