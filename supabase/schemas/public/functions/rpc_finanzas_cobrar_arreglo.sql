CREATE OR REPLACE FUNCTION public.rpc_finanzas_cobrar_arreglo (
  p_arreglo_id      uuid,
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_monto           numeric                  DEFAULT NULL::numeric,
  p_fecha_cobro     timestamp with time zone DEFAULT now(),
  p_descripcion     text                     DEFAULT NULL::text,
  p_idempotency_key uuid                     DEFAULT NULL::uuid,
  p_pagos           jsonb                    DEFAULT NULL::jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id            uuid    := public.current_tenant_id();
  v_arreglo              record;
  v_monto_total_cobrado  numeric := 0;
  v_operacion_id         uuid;
  v_pago                 jsonb;
  v_pago_cuenta_id       uuid;
  v_pago_monto           numeric;
  v_pago_desc            text;
  v_operaciones_ids      uuid[]  := ARRAY[]::uuid[];
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  -- Idempotencia: si ya existe una operación con este idempotency_key, devolver estado actual
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':cobro:' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_operacion_id
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;
    IF v_operacion_id IS NOT NULL THEN
      SELECT a.total_cobrado, a.precio_final, a.esta_pago
      INTO v_arreglo FROM public.arreglos a
      WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id;
      RETURN jsonb_build_object(
        'operacion_id',    v_operacion_id,
        'idempotent',      true,
        'total_cobrado',   v_arreglo.total_cobrado,
        'saldo_pendiente', GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - v_arreglo.total_cobrado),
        'esta_pago',       v_arreglo.esta_pago
      );
    END IF;
  END IF;
  SELECT a.id, a.precio_final, a.total_cobrado, a.tenant_id, a.estado, v.patente
  INTO v_arreglo
  FROM public.arreglos a
  LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id
  FOR UPDATE OF a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado: %', p_arreglo_id USING ERRCODE = 'P0002'; END IF;
  IF v_arreglo.estado = 'PRESUPUESTO' THEN
    RAISE EXCEPTION 'No se pueden registrar cobros en un presupuesto' USING ERRCODE = '22023';
  END IF;
  -- MODO 1: Múltiples cuentas (p_pagos como array JSON)
  IF p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0 THEN
    FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos)
    LOOP
      v_pago_cuenta_id := (v_pago ->> 'cuenta_id')::uuid;
      v_pago_monto := (v_pago ->> 'monto')::numeric;
      v_pago_desc := NULLIF(btrim(v_pago ->> 'descripcion'), '');
      IF v_pago_cuenta_id IS NULL THEN
        RAISE EXCEPTION 'Cada cobro debe especificar una cuenta válida' USING ERRCODE = '22023';
      END IF;
      IF v_pago_monto IS NULL OR v_pago_monto <= 0 THEN
        RAISE EXCEPTION 'El monto de cada cobro debe ser mayor a 0' USING ERRCODE = '22023';
      END IF;
      PERFORM public._finanzas_exigir_cuenta(v_pago_cuenta_id, v_tenant_id, true);
      INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
      VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha_cobro, now()))
      RETURNING id INTO v_operacion_id;
      INSERT INTO public.operaciones_movimiento_cuenta (
        operacion_id, tenant_id, subtipo, cuenta_id, importe,
        descripcion, created_by
      ) VALUES (
        v_operacion_id, v_tenant_id, 'INGRESO', v_pago_cuenta_id, v_pago_monto,
        COALESCE(
          v_pago_desc,
          NULLIF(btrim(p_descripcion), ''),
          'Cobro de arreglo' || CASE WHEN v_arreglo.patente IS NOT NULL THEN ' - ' || v_arreglo.patente ELSE '' END
        ),
        auth.uid()
      );
      INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
      VALUES (v_operacion_id, p_arreglo_id, v_tenant_id);
      v_operaciones_ids := array_append(v_operaciones_ids, v_operacion_id);
      v_monto_total_cobrado := v_monto_total_cobrado + v_pago_monto;
    END LOOP;
  -- MODO 2: Cobro simple (una sola cuenta)
  ELSE
    IF p_cuenta_id IS NULL THEN
      RAISE EXCEPTION 'Debe especificar una cuenta financiera de destino' USING ERRCODE = '22023';
    END IF;
    v_pago_monto := COALESCE(
      p_monto,
      GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - COALESCE(v_arreglo.total_cobrado, 0))
    );
    IF v_pago_monto <= 0 THEN
      RAISE EXCEPTION 'El monto a cobrar debe ser mayor a 0' USING ERRCODE = '22023';
    END IF;
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
    VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha_cobro, now()))
    RETURNING id INTO v_operacion_id;
    INSERT INTO public.operaciones_movimiento_cuenta (
      operacion_id, tenant_id, subtipo, cuenta_id, importe,
      descripcion, idempotency_key, created_by
    ) VALUES (
      v_operacion_id, v_tenant_id, 'INGRESO', p_cuenta_id, v_pago_monto,
      COALESCE(
        NULLIF(btrim(p_descripcion), ''),
        'Cobro de arreglo' || CASE WHEN v_arreglo.patente IS NOT NULL THEN ' - ' || v_arreglo.patente ELSE '' END
      ),
      p_idempotency_key, auth.uid()
    );
    INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
    VALUES (v_operacion_id, p_arreglo_id, v_tenant_id);
    v_operaciones_ids := array_append(v_operaciones_ids, v_operacion_id);
    v_monto_total_cobrado := v_pago_monto;
  END IF;
  -- Actualizar total cobrado en arreglo
  UPDATE public.arreglos
  SET total_cobrado = COALESCE(total_cobrado, 0) + v_monto_total_cobrado
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  SELECT a.total_cobrado, a.precio_final, a.esta_pago
  INTO v_arreglo FROM public.arreglos a WHERE a.id = p_arreglo_id;
  RETURN jsonb_build_object(
    'operaciones_ids', to_jsonb(v_operaciones_ids),
    'monto_cobrado',   v_monto_total_cobrado,
    'total_cobrado',   v_arreglo.total_cobrado,
    'saldo_pendiente', GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - v_arreglo.total_cobrado),
    'esta_pago',       v_arreglo.esta_pago
  );
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_cobrar_arreglo"(uuid, uuid, numeric, timestamp WITH time zone, text, uuid, jsonb) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_cobrar_arreglo"(uuid, uuid, numeric, timestamp WITH time zone, text, uuid, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_finanzas_cobrar_arreglo"(uuid, uuid, numeric, timestamp WITH time zone, text, uuid, jsonb) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_finanzas_cobrar_arreglo"(uuid, uuid, numeric, timestamp WITH time zone, text, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_cobrar_arreglo"(uuid, uuid, numeric, timestamp WITH time zone, text, uuid, jsonb) TO "postgres";
