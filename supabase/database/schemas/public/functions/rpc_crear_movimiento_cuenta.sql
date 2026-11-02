CREATE FUNCTION public.rpc_crear_movimiento_cuenta (
  p_subtipo           text,
  p_importe           numeric,
  p_descripcion       text                     DEFAULT NULL::text,
  p_categoria_gasto   text                     DEFAULT NULL::text,
  p_cuenta_id         uuid                     DEFAULT NULL::uuid,
  p_cuenta_origen_id  uuid                     DEFAULT NULL::uuid,
  p_cuenta_destino_id uuid                     DEFAULT NULL::uuid,
  p_fecha             timestamp with time zone DEFAULT now(),
  p_idempotency_key   uuid                     DEFAULT NULL::uuid,
  p_observaciones     text                     DEFAULT NULL::text,
  p_taller_id         uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id   uuid := public.current_tenant_id();
  v_subtipo     text := upper(btrim(coalesce(p_subtipo, '')));
  v_op_id       uuid;
  v_existente   uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('finanzas:edit') THEN
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

  IF p_taller_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.talleres WHERE id = p_taller_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Taller no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_existente
    FROM public.operaciones_movimiento_cuenta AS omc
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

  IF v_subtipo = 'GASTO' THEN
    v_op_id := public.rpc_crear_operacion_gasto(
      p_categoria_gasto := p_categoria_gasto,
      p_monto := p_importe,
      p_descripcion := p_descripcion,
      p_fecha := p_fecha,
      p_observaciones := p_observaciones,
      p_taller_id := p_taller_id,
      p_cuenta_id := p_cuenta_id,
      p_idempotency_key := p_idempotency_key
    );

  ELSIF v_subtipo = 'INGRESO' THEN
    IF btrim(coalesce(p_descripcion, '')) = '' THEN
      RAISE EXCEPTION 'La descripción es requerida para un ingreso' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, observaciones, monto_total)
    VALUES (v_tenant_id, 'INGRESO'::public.tipo_operacion, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''), p_importe)
    RETURNING id INTO v_op_id;

    INSERT INTO public.operaciones_ingreso (operacion_id, tenant_id, cuenta_id, concepto)
    VALUES (v_op_id, v_tenant_id, p_cuenta_id, btrim(p_descripcion));

    INSERT INTO public.operaciones_movimiento_cuenta (
      operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, idempotency_key, created_by
    ) VALUES (
      v_op_id, v_tenant_id, p_cuenta_id, p_importe, COALESCE(p_fecha, now()),
      btrim(p_descripcion), p_idempotency_key, auth.uid()
    );

  ELSIF v_subtipo = 'TRANSFERENCIA' THEN
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, observaciones, monto_total)
    VALUES (v_tenant_id, 'TRANSFERENCIA'::public.tipo_operacion, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''), p_importe)
    RETURNING id INTO v_op_id;

    INSERT INTO public.operaciones_transferencia (operacion_id, tenant_id, cuenta_origen_id, cuenta_destino_id)
    VALUES (v_op_id, v_tenant_id, p_cuenta_origen_id, p_cuenta_destino_id);

    -- 2 OMC: débito en origen, crédito en destino
    INSERT INTO public.operaciones_movimiento_cuenta (
      operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, idempotency_key, created_by
    ) VALUES (
      v_op_id, v_tenant_id, p_cuenta_origen_id, -p_importe, COALESCE(p_fecha, now()),
      COALESCE(NULLIF(btrim(p_descripcion), ''), 'Transferencia saliente'), p_idempotency_key, auth.uid()
    );

    INSERT INTO public.operaciones_movimiento_cuenta (
      operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, created_by
    ) VALUES (
      v_op_id, v_tenant_id, p_cuenta_destino_id, p_importe, COALESCE(p_fecha, now()),
      COALESCE(NULLIF(btrim(p_descripcion), ''), 'Transferencia entrante'), auth.uid()
    );
  END IF;

  RETURN v_op_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, text, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, text, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, text, uuid) TO service_role;