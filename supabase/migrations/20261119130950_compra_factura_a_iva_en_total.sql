-- En compras creadas junto con una factura A, los precios de las líneas son bases netas.
-- Guardamos la modalidad para distinguirlas de los precios que ya incluyen IVA.
ALTER TABLE public.operaciones_compra
  ADD COLUMN IF NOT EXISTS precios_incluyen_iva boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.operaciones_compra.precios_incluyen_iva IS
  'Indica si los precios unitarios de la compra ya incluyen IVA. false se usa al crear la compra junto con una factura A; el total operativo suma el IVA calculado por alícuota.';

-- Reemplaza la firma para evitar una sobrecarga ambigua en PostgREST.
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(
  public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb,
  timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb
);

CREATE FUNCTION public.rpc_crear_operacion_con_stock (
  p_tipo                    public.tipo_operacion,
  p_taller_id               uuid,
  p_lineas                  jsonb,
  p_arreglo_id              uuid                     DEFAULT NULL::uuid,
  p_cuenta_id               uuid                     DEFAULT NULL::uuid,
  p_pagos                   jsonb                    DEFAULT NULL::jsonb,
  p_fecha                   timestamp with time zone DEFAULT now(),
  p_idempotency_key         uuid                     DEFAULT NULL::uuid,
  p_observaciones           text                     DEFAULT NULL::text,
  p_estado_pago             text                     DEFAULT NULL::text,
  p_monto_inicial           numeric                  DEFAULT NULL::numeric,
  p_mover_stock             boolean                  DEFAULT true,
  p_proveedor_id            uuid                     DEFAULT NULL::uuid,
  p_cliente_id              uuid                     DEFAULT NULL::uuid,
  p_cargos                  jsonb                    DEFAULT NULL::jsonb,
  p_precios_incluyen_iva    boolean                  DEFAULT true
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id          uuid := public.current_tenant_id();
  v_operacion_id       uuid;
  v_operacion_existente uuid;
  v_fingerprint_existente text;
  v_request_fingerprint text;
  v_total_lineas       numeric(14,2) := 0;
  v_total_iva          numeric(14,2) := 0;
  v_total_cargos       numeric(14,2) := 0;
  v_total_operacion    numeric(14,2) := 0;
  v_total_pagos        numeric(14,2) := 0;
  v_pago               jsonb;
  v_pago_monto         numeric;
  v_pago_cuenta_id     uuid;
  v_monto_inicial      numeric := p_monto_inicial;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF p_precios_incluyen_iva IS NULL THEN
    RAISE EXCEPTION 'La modalidad de precios con IVA es obligatoria' USING ERRCODE = '22023';
  END IF;
  IF NOT p_precios_incluyen_iva AND p_tipo <> 'COMPRA' THEN
    RAISE EXCEPTION 'Solo las compras admiten precios netos con IVA a sumar' USING ERRCODE = '22023';
  END IF;

  -- Fingerprint and lock the logical request before any stock or payment write.
  IF p_idempotency_key IS NOT NULL THEN
    v_request_fingerprint := md5(jsonb_build_object(
      'tipo', p_tipo,
      'taller_id', p_taller_id,
      'lineas', p_lineas,
      'arreglo_id', p_arreglo_id,
      'cuenta_id', p_cuenta_id,
      'pagos', p_pagos,
      'fecha', p_fecha,
      'observaciones', p_observaciones,
      'estado_pago', p_estado_pago,
      'monto_inicial', p_monto_inicial,
      'mover_stock', p_mover_stock,
      'proveedor_id', p_proveedor_id,
      'cliente_id', p_cliente_id,
      'cargos', p_cargos,
      'precios_incluyen_iva', p_precios_incluyen_iva
    )::text);

    PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || p_idempotency_key::text, 0));
    SELECT operacion_id, request_fingerprint
    INTO v_operacion_existente, v_fingerprint_existente
    FROM public.operaciones_creacion_idempotencia
    WHERE tenant_id = v_tenant_id AND idempotency_key = p_idempotency_key;
    IF v_operacion_existente IS NOT NULL THEN
      IF v_fingerprint_existente <> v_request_fingerprint THEN
        RAISE EXCEPTION 'La clave de idempotencia ya se usó con otros datos' USING ERRCODE = '22023';
      END IF;
      RETURN v_operacion_existente;
    END IF;

    -- Compatibility for operations created before the idempotency registry existed.
    IF p_cuenta_id IS NOT NULL THEN
      SELECT operacion_id INTO v_operacion_existente
      FROM public.operaciones_movimiento_cuenta
      WHERE tenant_id = v_tenant_id AND idempotency_key = p_idempotency_key;
      IF v_operacion_existente IS NOT NULL THEN
        RETURN v_operacion_existente;
      END IF;
    END IF;
  END IF;

  IF p_lineas IS NOT NULL THEN
    IF jsonb_typeof(p_lineas) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Las líneas de la operación deben ser una lista' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_lineas) > 0 THEN
      SELECT COALESCE(SUM(((elem ->> 'cantidad')::integer * (elem ->> 'monto_unitario')::numeric)), 0)
      INTO v_total_lineas
      FROM jsonb_array_elements(p_lineas) AS elem;
    END IF;
  END IF;

  IF NOT p_precios_incluyen_iva AND p_lineas IS NOT NULL AND jsonb_array_length(p_lineas) > 0 THEN
    -- Aggregate and round once per ARCA rate, matching the document calculation.
    SELECT COALESCE(SUM(ROUND(bases.base_neta * tasas.porcentaje / 100, 2)), 0)
    INTO v_total_iva
    FROM (
      SELECT
        COALESCE((elem ->> 'iva_alicuota_id')::smallint, 5::smallint) AS iva_alicuota_id,
        SUM((elem ->> 'cantidad')::integer * (elem ->> 'monto_unitario')::numeric) AS base_neta
      FROM jsonb_array_elements(p_lineas) AS elem
      GROUP BY COALESCE((elem ->> 'iva_alicuota_id')::smallint, 5::smallint)
    ) AS bases
    JOIN (VALUES
      (3::smallint, 0::numeric),
      (9::smallint, 2.5::numeric),
      (8::smallint, 5::numeric),
      (4::smallint, 10.5::numeric),
      (5::smallint, 21::numeric),
      (6::smallint, 27::numeric)
    ) AS tasas(iva_alicuota_id, porcentaje)
      ON tasas.iva_alicuota_id = bases.iva_alicuota_id;
  END IF;

  IF p_cargos IS NOT NULL THEN
    v_total_cargos := public._validar_y_sumar_cargos_operacion(p_cargos);
  END IF;
  v_total_operacion := v_total_lineas + v_total_iva + v_total_cargos;
  IF v_total_operacion >= 1000000000000 THEN
    RAISE EXCEPTION 'El total supera el importe máximo de la compra' USING ERRCODE = '22023';
  END IF;

  IF p_pagos IS NOT NULL THEN
    IF jsonb_typeof(p_pagos) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Los pagos iniciales deben ser una lista' USING ERRCODE = '22023';
    END IF;
    FOR v_pago IN SELECT value FROM jsonb_array_elements(p_pagos) LOOP
      IF jsonb_typeof(v_pago) IS DISTINCT FROM 'object'
        OR jsonb_typeof(v_pago -> 'monto') IS DISTINCT FROM 'number'
        OR jsonb_typeof(v_pago -> 'cuenta_id') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION 'Cada pago inicial requiere cuenta e importe numérico' USING ERRCODE = '22023';
      END IF;
      BEGIN
        v_pago_monto := (v_pago ->> 'monto')::numeric;
        v_pago_cuenta_id := NULLIF(v_pago ->> 'cuenta_id', '')::uuid;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'El pago inicial contiene cuenta o importe inválido' USING ERRCODE = '22023';
      END;
      IF v_pago_cuenta_id IS NULL OR v_pago_monto <= 0 OR v_pago_monto <> round(v_pago_monto, 2) THEN
        RAISE EXCEPTION 'Cada pago inicial requiere una cuenta válida y un importe positivo de hasta 2 decimales' USING ERRCODE = '22023';
      END IF;
      v_total_pagos := v_total_pagos + v_pago_monto;
    END LOOP;
    IF v_total_pagos > v_total_operacion THEN
      RAISE EXCEPTION 'Los pagos iniciales no pueden superar el total de la operación' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_monto_inicial IS NOT NULL
    AND (p_monto_inicial < 0 OR p_monto_inicial <> round(p_monto_inicial, 2) OR p_monto_inicial > v_total_operacion) THEN
    RAISE EXCEPTION 'El monto inicial no puede superar el total de la operación' USING ERRCODE = '22023';
  END IF;

  -- If all is paid without explicit payment rows, use the final net-plus-VAT total.
  IF NOT p_precios_incluyen_iva
     AND (p_pagos IS NULL OR jsonb_array_length(p_pagos) = 0)
     AND p_cuenta_id IS NOT NULL
     AND COALESCE(upper(p_estado_pago), 'PAGADO') NOT IN ('PENDIENTE', 'PARCIAL')
     AND p_monto_inicial IS NULL THEN
    v_monto_inicial := v_total_operacion;
  END IF;

  v_operacion_id := public._crear_operacion_con_stock(
    p_tipo := p_tipo,
    p_taller_id := p_taller_id,
    p_lineas := p_lineas,
    p_arreglo_id := p_arreglo_id,
    p_cuenta_id := p_cuenta_id,
    p_pagos := p_pagos,
    p_fecha := p_fecha,
    p_idempotency_key := p_idempotency_key,
    p_observaciones := p_observaciones,
    p_estado_pago := p_estado_pago,
    p_monto_inicial := v_monto_inicial,
    p_mover_stock := p_mover_stock,
    p_proveedor_id := p_proveedor_id,
    p_cliente_id := p_cliente_id,
    p_cargos := p_cargos
  );

  IF NOT p_precios_incluyen_iva THEN
    UPDATE public.operaciones_compra
    SET precios_incluyen_iva = false
    WHERE operacion_id = v_operacion_id AND tenant_id = v_tenant_id;

    UPDATE public.operaciones
    SET monto_total = v_total_operacion
    WHERE id = v_operacion_id AND tenant_id = v_tenant_id;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.operaciones_creacion_idempotencia (
      tenant_id, idempotency_key, operacion_id, request_fingerprint
    ) VALUES (
      v_tenant_id, p_idempotency_key, v_operacion_id, v_request_fingerprint
    );
  END IF;

  RETURN v_operacion_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(
  public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb,
  timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(
  public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb,
  timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid, jsonb, boolean
) TO authenticated, service_role, postgres;

NOTIFY pgrst, 'reload schema';
