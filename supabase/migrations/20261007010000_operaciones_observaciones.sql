-- 1. Agregar columna observaciones a public.operaciones
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS observaciones text;

-- 2. Drop de firmas anteriores para evitar ambigüedad de sobrecargas y permitir cambio de RETURNS TABLE
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_actualizar_operacion_con_stock(uuid, text, uuid, jsonb, timestamp with time zone, uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer);

-- 3. Actualizar rpc_crear_operacion_con_stock
CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock (
  p_tipo            text,
  p_taller_id       uuid,
  p_lineas          jsonb,
  p_arreglo_id      uuid                     DEFAULT NULL::uuid,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_idempotency_key uuid                     DEFAULT NULL::uuid,
  p_observaciones   text                     DEFAULT NULL::text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo public.tipo_operacion;
  v_operacion_id uuid;
  v_linea jsonb;
  v_stock_id uuid;
  v_cantidad int;
  v_monto_unitario numeric;
  v_delta_cantidad int;
  v_importe numeric := 0;
  v_rowcount int;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_tipo IS NULL OR upper(p_tipo) IN ('MOVIMIENTO_CUENTA', 'GASTO') THEN
    RAISE EXCEPTION 'Use rpc_crear_movimiento_cuenta para operaciones financieras' USING ERRCODE = '22023';
  END IF;
  v_tipo := p_tipo::public.tipo_operacion;
  IF p_taller_id IS NULL THEN
    RAISE EXCEPTION 'taller_id es requerido para operaciones de stock' USING ERRCODE = '22023';
  END IF;
  IF v_tipo IN ('COMPRA', 'VENTA') AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta financiera requerida para compras y ventas' USING ERRCODE = '22023';
  END IF;
  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, observaciones)
  VALUES (v_tenant_id, v_tipo, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''))
  RETURNING id INTO v_operacion_id;
  IF p_arreglo_id IS NOT NULL AND v_tipo = 'ASIGNACION_ARREGLO' THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  END IF;
  FOR v_linea IN SELECT * FROM jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) LOOP
    v_stock_id := (v_linea->>'stock_id')::uuid;
    v_cantidad := coalesce((v_linea->>'cantidad')::int, 0);
    v_monto_unitario := coalesce((v_linea->>'monto_unitario')::numeric, 0);
    v_delta_cantidad := coalesce((v_linea->>'delta_cantidad')::int, 0);
    IF v_stock_id IS NULL THEN
      RAISE EXCEPTION 'línea de stock inválida' USING ERRCODE = '22023';
    END IF;
    IF v_tipo IN ('VENTA', 'COMPRA') AND (v_cantidad <= 0 OR v_monto_unitario < 0) THEN
      RAISE EXCEPTION 'línea de stock inválida' USING ERRCODE = '22023';
    ELSIF v_tipo = 'VENTA' AND v_delta_cantidad <> -v_cantidad THEN
      RAISE EXCEPTION 'delta inválido para venta' USING ERRCODE = '22023';
    ELSIF v_tipo = 'COMPRA' AND v_delta_cantidad <> v_cantidad THEN
      RAISE EXCEPTION 'delta inválido para compra' USING ERRCODE = '22023';
    END IF;
    UPDATE public.stocks AS s
    SET cantidad = s.cantidad + v_delta_cantidad,
        updated_at = now()
    WHERE s.id = v_stock_id
      AND s.tenant_id = v_tenant_id
      AND s.taller_id = p_taller_id
      AND (v_delta_cantidad >= 0 OR s.cantidad >= -v_delta_cantidad);
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.operaciones_lineas (
      operacion_id,
      stock_id,
      cantidad,
      monto_unitario,
      delta_cantidad
    )
    VALUES (
      v_operacion_id,
      v_stock_id,
      v_cantidad,
      v_monto_unitario,
      v_delta_cantidad
    );
    v_importe := v_importe + (v_cantidad * v_monto_unitario);
  END LOOP;
  IF p_cuenta_id IS NOT NULL AND v_importe <> 0 AND v_tipo IN ('COMPRA', 'VENTA') THEN
    PERFORM public._ledger_insertar(
      v_operacion_id,
      v_tenant_id,
      p_cuenta_id,
      CASE WHEN v_tipo = 'COMPRA' THEN -v_importe ELSE v_importe END,
      COALESCE(p_fecha, now())
    );
  END IF;
  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text) FROM postgres;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text) TO postgres;

-- 4. Actualizar rpc_actualizar_operacion_con_stock
CREATE OR REPLACE FUNCTION public.rpc_actualizar_operacion_con_stock (
  p_operacion_id    uuid,
  p_tipo            text,
  p_taller_id       uuid,
  p_lineas          jsonb,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_idempotency_key uuid                     DEFAULT NULL::uuid,
  p_observaciones   text                     DEFAULT NULL::text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id     uuid := public.current_tenant_id();
  v_cuenta_id     uuid := p_cuenta_id;
  v_observaciones text := p_observaciones;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF v_cuenta_id IS NULL AND p_tipo IN ('COMPRA', 'VENTA') THEN
    SELECT m.cuenta_financiera_id INTO v_cuenta_id FROM public.movimientos_financieros AS m
    WHERE m.operacion_id = p_operacion_id AND m.tenant_id = v_tenant_id LIMIT 1;
  END IF;
  IF v_observaciones IS NULL THEN
    SELECT o.observaciones INTO v_observaciones FROM public.operaciones AS o
    WHERE o.id = p_operacion_id AND o.tenant_id = v_tenant_id LIMIT 1;
  END IF;
  PERFORM public.rpc_borrar_operacion_con_stock(p_operacion_id, NULL);
  RETURN public.rpc_crear_operacion_con_stock(p_tipo, p_taller_id, p_lineas, NULL, p_fecha, v_cuenta_id, p_idempotency_key, v_observaciones);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid, text, uuid, jsonb, timestamp with time zone, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid, text, uuid, jsonb, timestamp with time zone, uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid, text, uuid, jsonb, timestamp with time zone, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid, text, uuid, jsonb, timestamp with time zone, uuid, uuid, text) FROM postgres;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid, text, uuid, jsonb, timestamp with time zone, uuid, uuid, text) TO postgres;

-- 5. Actualizar rpc_crear_movimiento_cuenta
CREATE OR REPLACE FUNCTION public.rpc_crear_movimiento_cuenta (
  p_subtipo           text,
  p_importe           numeric,
  p_descripcion       text                     DEFAULT NULL::text,
  p_categoria_gasto   text                     DEFAULT NULL::text,
  p_cuenta_id         uuid                     DEFAULT NULL::uuid,
  p_cuenta_origen_id  uuid                     DEFAULT NULL::uuid,
  p_cuenta_destino_id uuid                     DEFAULT NULL::uuid,
  p_fecha             timestamp with time zone DEFAULT now(),
  p_idempotency_key   uuid                     DEFAULT NULL::uuid,
  p_arreglo_id        uuid                     DEFAULT NULL::uuid,
  p_observaciones     text                     DEFAULT NULL::text
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
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, observaciones)
  VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), '')) RETURNING id INTO v_op_id;
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
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text) FROM postgres;
GRANT EXECUTE ON FUNCTION public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text) TO postgres;

-- 6. Actualizar rpc_actualizar_movimiento_cuenta
CREATE OR REPLACE FUNCTION public.rpc_actualizar_movimiento_cuenta (
  p_operacion_id      uuid,
  p_importe           numeric                  DEFAULT NULL::numeric,
  p_descripcion       text                     DEFAULT NULL::text,
  p_categoria_gasto   text                     DEFAULT NULL::text,
  p_cuenta_id         uuid                     DEFAULT NULL::uuid,
  p_cuenta_origen_id  uuid                     DEFAULT NULL::uuid,
  p_cuenta_destino_id uuid                     DEFAULT NULL::uuid,
  p_fecha             timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_idempotency_key   uuid                     DEFAULT NULL::uuid,
  p_arreglo_id        uuid                     DEFAULT NULL::uuid,
  p_observaciones     text                     DEFAULT NULL::text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
  IF p_fecha IS NOT NULL OR p_observaciones IS NOT NULL THEN
    UPDATE public.operaciones
    SET fecha = COALESCE(p_fecha, fecha),
        observaciones = CASE WHEN p_observaciones IS NOT NULL THEN NULLIF(btrim(p_observaciones), '') ELSE observaciones END
    WHERE id = p_operacion_id;
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
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text) FROM postgres;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text) TO postgres;

-- 7. Actualizar rpc_listar_operaciones_con_gastos
CREATE OR REPLACE FUNCTION public.rpc_listar_operaciones_con_gastos (
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_tipos     text[]                   DEFAULT NULL::text[],
  p_page      integer                  DEFAULT 1,
  p_page_size integer                  DEFAULT 50
)
  RETURNS TABLE (
    id                       uuid,
    tipo                     text,
    taller_id                uuid,
    fecha                    timestamp with time zone,
    created_at               timestamp with time zone,
    lineas                   jsonb,
    gasto_id                 uuid,
    descripcion              text,
    categoria_gasto          text,
    cuenta_financiera_id     uuid,
    cuenta_financiera_nombre text,
    monto                    numeric,
    arreglo_id               uuid,
    total_count              bigint,
    observaciones            text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  WITH rows AS (
    SELECT
      o.id,
      CASE
        WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
        ELSE COALESCE(omc.subtipo, o.tipo::text)
      END AS tipo,
      o.taller_id, o.fecha, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id,
          'cantidad', l.cantidad, 'monto_unitario', l.monto_unitario,
          'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at,
          'nombre', p.nombre, 'codigo', p.codigo
        ) ORDER BY l.created_at, l.id)
        FROM public.operaciones_lineas AS l
        LEFT JOIN public.stocks AS s ON s.id = l.stock_id
        LEFT JOIN public.productos AS p ON p.id = s.producto_id
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb) AS lineas,
      CASE WHEN omc.subtipo = 'GASTO' THEN o.id ELSE NULL END AS gasto_id,
      CASE
        WHEN o.tipo = 'ASIGNACION_ARREGLO' AND v.id IS NOT NULL THEN
          'Asignación · ' || TRIM(v.marca || ' ' || v.modelo) || ' (' || v.patente || ')'
        ELSE omc.descripcion
      END AS descripcion,
      omc.categoria_gasto,
      COALESCE(omc.cuenta_id, omc.cuenta_origen_id, mf.cuenta_financiera_id) AS cuenta_financiera_id,
      COALESCE(cf_s.nombre, cf_o.nombre, cf_m.nombre) AS cuenta_financiera_nombre,
      COALESCE(
        abs(omc.importe),
        abs(mf.importe),
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
      )::numeric AS monto,
      COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id,
      o.observaciones
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = o.id
    LEFT JOIN LATERAL (
      SELECT m.cuenta_financiera_id, m.importe
      FROM public.movimientos_financieros AS m
      WHERE m.operacion_id = o.id AND m.tenant_id = o.tenant_id
      ORDER BY m.created_at, m.id
      LIMIT 1
    ) AS mf ON true
    LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
    LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = o.id
    LEFT JOIN public.arreglos AS a ON a.id = COALESCE(oca.arreglo_id, oaa.arreglo_id)
    LEFT JOIN public.vehiculos AS v ON v.id = a.vehiculo_id
    LEFT JOIN public.cuentas_financieras AS cf_s ON cf_s.id = omc.cuenta_id
    LEFT JOIN public.cuentas_financieras AS cf_o ON cf_o.id = omc.cuenta_origen_id
    LEFT JOIN public.cuentas_financieras AS cf_m ON cf_m.id = mf.cuenta_financiera_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
  )
  SELECT r.id, r.tipo, r.taller_id, r.fecha, r.created_at, r.lineas, r.gasto_id, r.descripcion, r.categoria_gasto, r.cuenta_financiera_id, r.cuenta_financiera_nombre, r.monto, r.arreglo_id, COUNT(*) OVER() AS total_count, r.observaciones
  FROM rows AS r
  WHERE COALESCE(cardinality(p_tipos), 0) = 0 OR r.tipo = ANY(p_tipos)
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer) FROM postgres;
GRANT EXECUTE ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO postgres;
