CREATE FUNCTION public._crear_operacion_con_stock (
  p_tipo            public.tipo_operacion,
  p_taller_id       uuid,
  p_lineas          jsonb,
  p_arreglo_id      uuid                     DEFAULT NULL::uuid,
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_pagos           jsonb                    DEFAULT NULL::jsonb,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_idempotency_key uuid                     DEFAULT NULL::uuid,
  p_observaciones   text                     DEFAULT NULL::text,
  p_estado_pago     text                     DEFAULT NULL::text,
  p_monto_inicial   numeric                  DEFAULT NULL::numeric,
  p_mover_stock     boolean                  DEFAULT true,
  p_proveedor_id    uuid                     DEFAULT NULL::uuid,
  p_cliente_id      uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id          uuid := public.current_tenant_id();
  v_operacion_id       uuid;
  v_linea              jsonb;
  v_linea_id           uuid;
  v_stock_id           uuid;
  v_cantidad           integer;
  v_monto_unitario     numeric(12,2);
  v_sentido            smallint;
  v_monto_total        numeric(12,2) := 0;
  v_total_pagos        numeric(14,2) := 0;
  v_pago_elem          jsonb;
  v_pago_cuenta_id     uuid;
  v_pago_monto         numeric(14,2);
  v_pago_fecha         timestamp with time zone;
  v_pago_desc          text;
  v_pago_idemp         uuid;
  v_signo              numeric;
  v_categoria_arreglo  uuid;
  v_empleado_id        uuid;
  v_iva_alicuota       smallint;
  v_cantidad_cumpl     integer;
  v_fecha              timestamp with time zone := COALESCE(p_fecha, now());
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_cuenta_id IS NOT NULL THEN
    SELECT operacion_id INTO v_operacion_id
    FROM public.operaciones_movimiento_cuenta
    WHERE tenant_id = v_tenant_id AND idempotency_key = p_idempotency_key;
    IF v_operacion_id IS NOT NULL THEN
      RETURN v_operacion_id;
    END IF;
  END IF;

  IF p_tipo NOT IN ('COMPRA', 'VENTA', 'ASIGNACION_ARREGLO', 'AJUSTE') THEN
    RAISE EXCEPTION 'Tipo de operación inválido para operaciones con stock: %', p_tipo USING ERRCODE = '22023';
  END IF;

  v_sentido := CASE WHEN p_tipo = 'COMPRA' THEN 1::smallint ELSE -1::smallint END;

  IF p_lineas IS NOT NULL AND jsonb_array_length(p_lineas) > 0 THEN
    SELECT COALESCE(SUM(((elem ->> 'cantidad')::integer * (elem ->> 'monto_unitario')::numeric)), 0)
    INTO v_monto_total
    FROM jsonb_array_elements(p_lineas) AS elem;
  END IF;

  INSERT INTO public.operaciones (
    tenant_id, taller_id, tipo, fecha, monto_total, observaciones
  ) VALUES (
    v_tenant_id, p_taller_id, p_tipo, v_fecha, v_monto_total, p_observaciones
  ) RETURNING id INTO v_operacion_id;

  IF p_tipo = 'VENTA' THEN
    INSERT INTO public.operaciones_venta (operacion_id, tenant_id, cliente_id)
    VALUES (v_operacion_id, v_tenant_id, p_cliente_id);
  ELSIF p_tipo = 'COMPRA' THEN
    INSERT INTO public.operaciones_compra (operacion_id, tenant_id, proveedor_id)
    VALUES (v_operacion_id, v_tenant_id, p_proveedor_id);
  ELSIF p_tipo = 'ASIGNACION_ARREGLO' THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, tenant_id, arreglo_id)
    VALUES (v_operacion_id, v_tenant_id, p_arreglo_id);
  END IF;

  -- Insertar líneas ordenadas por stock_id (Lock ordering)
  IF p_lineas IS NOT NULL AND jsonb_array_length(p_lineas) > 0 THEN
    FOR v_linea IN
      SELECT elem
      FROM jsonb_array_elements(p_lineas) AS elem
      ORDER BY (elem ->> 'stock_id')::uuid
    LOOP
      v_stock_id := (v_linea ->> 'stock_id')::uuid;
      v_cantidad := (v_linea ->> 'cantidad')::integer;
      v_monto_unitario := COALESCE((v_linea ->> 'monto_unitario')::numeric, 0);
      v_categoria_arreglo := (v_linea ->> 'categoria_arreglo_id')::uuid;
      v_empleado_id := (v_linea ->> 'empleado_id')::uuid;
      v_iva_alicuota := COALESCE((v_linea ->> 'iva_alicuota_id')::smallint, 5::smallint);

      INSERT INTO public.operaciones_lineas (
        operacion_id, stock_id, cantidad, monto_unitario, sentido,
        categoria_arreglo_id, empleado_id, iva_alicuota_id
      ) VALUES (
        v_operacion_id, v_stock_id, v_cantidad, v_monto_unitario, v_sentido,
        v_categoria_arreglo, v_empleado_id, v_iva_alicuota
      ) RETURNING id INTO v_linea_id;

      -- Determinar cantidad a cumplir físicamente
      IF v_linea ? 'cantidad_cumplida' AND (v_linea ->> 'cantidad_cumplida') IS NOT NULL THEN
        v_cantidad_cumpl := GREATEST(0, LEAST(v_cantidad, (v_linea ->> 'cantidad_cumplida')::integer));
      ELSIF COALESCE(p_mover_stock, true) THEN
        v_cantidad_cumpl := v_cantidad;
      ELSE
        v_cantidad_cumpl := 0;
      END IF;

      -- Si v_cantidad_cumpl > 0, generar impacto de stock inicial
      IF v_cantidad_cumpl > 0 THEN
        INSERT INTO public.operaciones_movimiento_stock (
          tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
        ) VALUES (
          v_tenant_id, v_operacion_id, v_linea_id, v_stock_id,
          v_sentido * v_cantidad_cumpl,
          v_fecha,
          CASE WHEN p_tipo = 'COMPRA' THEN 'Recepción inicial' ELSE 'Entrega inicial' END
        );
      END IF;
    END LOOP;
  END IF;

  -- Manejo de pagos en OMC
  v_signo := CASE WHEN p_tipo = 'VENTA' THEN 1 ELSE -1 END;

  IF p_pagos IS NOT NULL AND jsonb_array_length(p_pagos) > 0 THEN
    FOR v_pago_elem IN SELECT * FROM jsonb_array_elements(p_pagos)
    LOOP
      v_pago_cuenta_id := (v_pago_elem ->> 'cuenta_id')::uuid;
      v_pago_monto := (v_pago_elem ->> 'monto')::numeric;
      v_pago_fecha := COALESCE((v_pago_elem ->> 'fecha')::timestamptz, v_fecha);
      v_pago_desc := v_pago_elem ->> 'descripcion';
      v_pago_idemp := (v_pago_elem ->> 'idempotency_key')::uuid;

      IF v_pago_monto IS NOT NULL AND v_pago_monto > 0 AND v_pago_cuenta_id IS NOT NULL THEN
        INSERT INTO public.operaciones_movimiento_cuenta (
          tenant_id, operacion_id, cuenta_id, importe, fecha, descripcion, idempotency_key
        ) VALUES (
          v_tenant_id, v_operacion_id, v_pago_cuenta_id,
          v_signo * v_pago_monto,
          v_pago_fecha,
          COALESCE(v_pago_desc, 'Pago de ' || p_tipo::text),
          v_pago_idemp
        );
      END IF;
    END LOOP;
  ELSIF p_cuenta_id IS NOT NULL
        AND COALESCE(upper(p_estado_pago), '') <> 'PENDIENTE'
        AND (p_monto_inicial IS NOT NULL OR v_monto_total > 0) THEN
    IF upper(p_estado_pago) = 'PARCIAL' THEN
      v_total_pagos := COALESCE(p_monto_inicial, 0);
    ELSE
      v_total_pagos := COALESCE(p_monto_inicial, v_monto_total);
    END IF;
    IF v_total_pagos > 0 THEN
      INSERT INTO public.operaciones_movimiento_cuenta (
        tenant_id, operacion_id, cuenta_id, importe, fecha, descripcion, idempotency_key
      ) VALUES (
        v_tenant_id, v_operacion_id, p_cuenta_id,
        v_signo * v_total_pagos,
        v_fecha,
        'Pago de ' || p_tipo::text,
        p_idempotency_key
      );
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp
  WITH time zone, uuid, text, text, numeric, boolean, uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp
  WITH time zone, uuid, text, text, numeric, boolean, uuid, uuid) TO service_role;