CREATE FUNCTION public.rpc_crear_operacion_gasto (
  p_categoria_gasto text,
  p_monto           numeric,
  p_descripcion     text                     DEFAULT NULL::text,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_observaciones   text                     DEFAULT NULL::text,
  p_taller_id       uuid                     DEFAULT NULL::uuid,
  p_proveedor_id    uuid                     DEFAULT NULL::uuid,
  p_estado_pago     text                     DEFAULT NULL::text,
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_monto_inicial   numeric                  DEFAULT NULL::numeric,
  p_pagos           jsonb                    DEFAULT NULL::jsonb,
  p_idempotency_key uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id         uuid := public.current_tenant_id();
  v_operacion_id      uuid;
  v_estado_pago       public.estado_pago_operacion;
  v_monto_pago        numeric := 0;
  v_tiene_pagos       boolean := false;
  v_pago              jsonb;
  v_pago_cuenta_id    uuid;
  v_pago_monto        numeric;
  v_pago_fecha        timestamp with time zone;
  v_pago_desc         text;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_categoria_gasto IS NULL OR btrim(p_categoria_gasto) = '' THEN
    RAISE EXCEPTION 'categoria_gasto es requerida' USING ERRCODE = '22023';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del gasto debe ser mayor a 0' USING ERRCODE = '22023';
  END IF;

  IF p_proveedor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.proveedores WHERE id = p_proveedor_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Proveedor no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_taller_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.talleres WHERE id = p_taller_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Taller no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_tiene_pagos := (p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0);

  IF p_estado_pago IS NOT NULL THEN
    v_estado_pago := upper(p_estado_pago)::public.estado_pago_operacion;
  ELSIF v_tiene_pagos THEN
    v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSIF p_cuenta_id IS NOT NULL THEN
    v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSE
    v_estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
  END IF;

  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;

  -- Crear documento de operación GASTO
  INSERT INTO public.operaciones (
    tenant_id, tipo, taller_id, fecha, observaciones,
    monto_total, total_pagado, esta_pago,
    estado_pago, estado_stock
  )
  VALUES (
    v_tenant_id, 'GASTO'::public.tipo_operacion, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''),
    p_monto, 0, false,
    'PENDIENTE'::public.estado_pago_operacion, 'NO_APLICA'
  )
  RETURNING id INTO v_operacion_id;

  -- Asociar en operaciones_gasto
  INSERT INTO public.operaciones_gasto (
    operacion_id, tenant_id, categoria_gasto, descripcion
  )
  VALUES (
    v_operacion_id, v_tenant_id, btrim(p_categoria_gasto), NULLIF(btrim(p_descripcion), '')
  );

  -- Procesar pagos como OMC
  IF v_tiene_pagos THEN
    FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos) LOOP
      v_pago_cuenta_id := (v_pago->>'cuenta_id')::uuid;
      v_pago_monto := coalesce((v_pago->>'monto')::numeric, 0);
      v_pago_fecha := coalesce((v_pago->>'fecha')::timestamptz, coalesce(p_fecha, now()));
      v_pago_desc := v_pago->>'descripcion';

      IF v_pago_cuenta_id IS NOT NULL AND v_pago_monto > 0 THEN
        PERFORM public._finanzas_exigir_cuenta(v_pago_cuenta_id, v_tenant_id, true);

        INSERT INTO public.operaciones_movimiento_cuenta (
          tenant_id, operacion_id, cuenta_id, importe, fecha, descripcion, idempotency_key, created_by
        )
        VALUES (
          v_tenant_id, v_operacion_id, v_pago_cuenta_id, -v_pago_monto, v_pago_fecha,
          coalesce(v_pago_desc, 'Pago inicial al registrar gasto #' || substr(v_operacion_id::text, 1, 8)),
          (v_pago->>'idempotency_key')::uuid, auth.uid()
        );
      END IF;
    END LOOP;

  ELSE
    IF p_cuenta_id IS NOT NULL THEN
      IF v_estado_pago = 'PAGADO' THEN
        v_monto_pago := p_monto;
      ELSIF v_estado_pago = 'PARCIAL' THEN
        IF p_monto_inicial IS NULL OR p_monto_inicial <= 0 OR p_monto_inicial >= p_monto THEN
          RAISE EXCEPTION 'Para estado de pago PARCIAL debe indicar un monto inicial válido menor al total' USING ERRCODE = '22023';
        END IF;
        v_monto_pago := p_monto_inicial;
      ELSE
        v_monto_pago := 0;
      END IF;

      IF v_monto_pago > 0 THEN
        INSERT INTO public.operaciones_movimiento_cuenta (
          tenant_id, operacion_id, cuenta_id, importe, fecha, descripcion, idempotency_key, created_by
        )
        VALUES (
          v_tenant_id, v_operacion_id, p_cuenta_id, -v_monto_pago, COALESCE(p_fecha, now()),
          COALESCE(p_descripcion, 'Pago inicial al registrar gasto #' || substr(v_operacion_id::text, 1, 8)),
          p_idempotency_key, auth.uid()
        );
      END IF;
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_gasto(text, numeric, text, timestamp WITH time zone, text, uuid, uuid, text, uuid, numeric, jsonb, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_crear_operacion_gasto(text, numeric, text, timestamp WITH time zone, text, uuid, uuid, text, uuid, numeric, jsonb, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_crear_operacion_gasto(text, numeric, text, timestamp WITH time zone, text, uuid, uuid, text, uuid, numeric, jsonb, uuid) TO service_role;