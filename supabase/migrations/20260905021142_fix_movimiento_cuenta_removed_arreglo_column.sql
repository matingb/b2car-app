-- Los cobros de arreglos ahora se vinculan mediante
-- operaciones_cobro_arreglo (20260825000000), que eliminó
-- operaciones_movimiento_cuenta.arreglo_id. Las RPC genéricas de
-- movimientos conservaron el parámetro por compatibilidad, pero seguían
-- escribiendo la columna eliminada e impedían crear cualquier gasto.

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
  IF v_subtipo NOT IN ('GASTO', 'INGRESO', 'TRANSFERENCIA') THEN
    RAISE EXCEPTION 'subtipo inválido: %. Válidos: GASTO, INGRESO, TRANSFERENCIA', p_subtipo USING ERRCODE = '22023';
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

  -- p_arreglo_id se mantiene en la firma para clientes anteriores. Las
  -- relaciones con arreglos se registran exclusivamente en
  -- operaciones_cobro_arreglo por rpc_finanzas_cobrar_arreglo.
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

CREATE OR REPLACE FUNCTION public.rpc_actualizar_movimiento_cuenta(
  p_operacion_id uuid, p_importe numeric DEFAULT NULL,
  p_descripcion text DEFAULT NULL, p_categoria_gasto text DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_cuenta_origen_id uuid DEFAULT NULL, p_cuenta_destino_id uuid DEFAULT NULL,
  p_fecha timestamptz DEFAULT NULL, p_idempotency_key uuid DEFAULT NULL,
  p_arreglo_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_omc       public.operaciones_movimiento_cuenta%ROWTYPE;
  v_existente uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_id IS NULL THEN RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_existente FROM public.operaciones_movimiento_cuenta AS omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;
    IF v_existente IS NOT NULL AND v_existente <> p_operacion_id THEN RETURN v_existente; END IF;
  END IF;
  SELECT omc.* INTO v_omc FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones AS o ON o.id = omc.operacion_id
  WHERE omc.operacion_id = p_operacion_id AND omc.tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no encontrado: %', p_operacion_id USING ERRCODE = 'P0002'; END IF;
  IF p_fecha IS NOT NULL THEN
    UPDATE public.operaciones SET fecha = p_fecha WHERE id = p_operacion_id;
  END IF;
  UPDATE public.operaciones_movimiento_cuenta SET
    importe           = CASE WHEN p_importe IS NOT NULL THEN
                         CASE WHEN v_omc.subtipo = 'GASTO' THEN -abs(p_importe) ELSE abs(p_importe) END
                       ELSE importe END,
    cuenta_id         = COALESCE(p_cuenta_id, cuenta_id),
    cuenta_origen_id  = COALESCE(p_cuenta_origen_id, cuenta_origen_id),
    cuenta_destino_id = COALESCE(p_cuenta_destino_id, cuenta_destino_id),
    categoria_gasto   = CASE WHEN v_omc.subtipo = 'GASTO' THEN COALESCE(p_categoria_gasto, categoria_gasto) ELSE NULL END,
    descripcion       = COALESCE(nullif(btrim(p_descripcion), ''), descripcion),
    idempotency_key   = COALESCE(p_idempotency_key, idempotency_key)
  WHERE operacion_id = p_operacion_id;
  RETURN p_operacion_id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_crear_movimiento_cuenta(text,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_movimiento_cuenta(text,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
