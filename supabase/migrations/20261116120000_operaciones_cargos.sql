-- ============================================================================
-- Cargos de operación (percepciones de la factura de compra)
--
-- Importes que suman al total de una operación sin ser mercadería. La escritura
-- habilita percepciones al dar de alta o editar una compra.
--
-- Reglas:
--   * operaciones.monto_total = Σ líneas de mercadería + Σ cargos. Los cargos
--     se incluyen en los pagos al crear la operación y en el saldo al editarla.
--   * La gestión documental conserva los cargos y el saldo de la operación.
--   * Las RPC de alta y edición de compras escriben los cargos. El cliente solo lee.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla
-- ----------------------------------------------------------------------------

CREATE TABLE public.operaciones_cargos (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id         uuid                     NOT NULL,
  operacion_id      uuid                     NOT NULL,
  orden             integer                  NOT NULL,
  tipo              text                     NOT NULL,
  percepcion_codigo text,
  descripcion       text                     NOT NULL,
  importe           numeric(14,2)            NOT NULL,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  created_by        uuid                     DEFAULT auth.uid(),
  CONSTRAINT operaciones_cargos_pkey PRIMARY KEY (id),
  CONSTRAINT operaciones_cargos_operacion_id_fkey
    FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT operaciones_cargos_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT operaciones_cargos_orden_key UNIQUE (operacion_id, orden),
  CONSTRAINT operaciones_cargos_tipo_check CHECK (tipo = ANY (ARRAY['PERCEPCION'::text])),
  CONSTRAINT operaciones_cargos_percepcion_check CHECK (
    tipo <> 'PERCEPCION'
    OR percepcion_codigo = ANY (ARRAY['GANANCIAS'::text, 'IVA'::text, 'IIBB_BUENOS_AIRES'::text, 'IIBB_CABA'::text, 'OTRA'::text])
  ),
  CONSTRAINT operaciones_cargos_descripcion_check CHECK (char_length(btrim(descripcion)) BETWEEN 1 AND 200),
  CONSTRAINT operaciones_cargos_importe_check CHECK (importe > 0)
);

COMMENT ON TABLE public.operaciones_cargos IS
  'Cargos que integran el monto total de una operación. El alta y la edición admiten percepciones de compra.';

-- Los cargos de una operación se leen (y se borran en cascada) por el índice del
-- UNIQUE (operacion_id, orden).
CREATE INDEX idx_operaciones_cargos_tenant ON public.operaciones_cargos (tenant_id);

-- ----------------------------------------------------------------------------
-- 2. RLS y grants: lectura por tenant con permiso de operaciones; escritura solo por RPC
-- ----------------------------------------------------------------------------

ALTER TABLE public.operaciones_cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY operaciones_cargos_select ON public.operaciones_cargos
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public._b2c179_tiene_permiso('operaciones:view')
  );

REVOKE ALL ON public.operaciones_cargos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.operaciones_cargos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operaciones_cargos TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Validación y guardado de cargos compartidos por el alta y la edición
-- ----------------------------------------------------------------------------

CREATE FUNCTION public._validar_y_sumar_cargos_operacion(p_cargos jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  v_cargo jsonb;
  v_orden bigint;
  v_importe numeric;
  v_total numeric := 0;
BEGIN
  IF jsonb_typeof(p_cargos) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Los cargos deben ser una lista' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_cargos) > 100 THEN
    RAISE EXCEPTION 'La operación admite hasta 100 cargos' USING ERRCODE = '22023';
  END IF;

  FOR v_cargo, v_orden IN SELECT value, ordinality FROM jsonb_array_elements(p_cargos) WITH ORDINALITY LOOP
    IF jsonb_typeof(v_cargo) <> 'object' OR COALESCE(v_cargo ->> 'tipo', 'PERCEPCION') <> 'PERCEPCION' THEN
      RAISE EXCEPTION 'Cargo %: tipo no admitido', v_orden USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_cargo ->> 'percepcion_codigo', '') NOT IN ('GANANCIAS', 'IVA', 'IIBB_BUENOS_AIRES', 'IIBB_CABA', 'OTRA') THEN
      RAISE EXCEPTION 'Cargo %: la percepción no es válida', v_orden USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_cargo -> 'descripcion') IS DISTINCT FROM 'string'
      OR char_length(btrim(v_cargo ->> 'descripcion')) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'Cargo %: la descripción es obligatoria (hasta 200 caracteres)', v_orden USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_cargo -> 'importe') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Cargo %: el importe debe ser numérico', v_orden USING ERRCODE = '22023';
    END IF;
    v_importe := (v_cargo ->> 'importe')::numeric;
    IF v_importe <= 0 OR v_importe <> round(v_importe, 2) THEN
      RAISE EXCEPTION 'Cargo %: el importe debe ser mayor a 0 y tener hasta 2 decimales', v_orden USING ERRCODE = '22023';
    END IF;
    v_total := v_total + v_importe;
  END LOOP;

  RETURN v_total;
END;
$function$;

CREATE FUNCTION public._guardar_cargos_operacion(p_tenant_id uuid, p_operacion_id uuid, p_cargos jsonb)
RETURNS void
LANGUAGE sql
SET search_path TO ''
AS $function$
  INSERT INTO public.operaciones_cargos AS cargo (
    tenant_id, operacion_id, orden, tipo, percepcion_codigo, descripcion, importe
  )
  SELECT p_tenant_id, p_operacion_id, orden::integer, 'PERCEPCION',
    elem ->> 'percepcion_codigo', btrim(elem ->> 'descripcion'), (elem ->> 'importe')::numeric
  FROM jsonb_array_elements(p_cargos) WITH ORDINALITY AS entrada(elem, orden)
  ON CONFLICT (operacion_id, orden) DO UPDATE
    SET percepcion_codigo = EXCLUDED.percepcion_codigo, descripcion = EXCLUDED.descripcion, importe = EXCLUDED.importe
    WHERE (cargo.percepcion_codigo, cargo.descripcion, cargo.importe)
      IS DISTINCT FROM (EXCLUDED.percepcion_codigo, EXCLUDED.descripcion, EXCLUDED.importe);

  DELETE FROM public.operaciones_cargos
  WHERE operacion_id = p_operacion_id AND tenant_id = p_tenant_id
    AND orden > jsonb_array_length(p_cargos);
$function$;

REVOKE ALL ON FUNCTION public._validar_y_sumar_cargos_operacion(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._guardar_cargos_operacion(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Alta de operaciones con stock: nuevo parámetro p_cargos (al final, con default)
--
-- Se reemplazan las firmas para no dejar sobrecargas ambiguas con argumentos nombrados.
-- Los llamadores existentes (posicionales o nombrados) no cambian.
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid);

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
  p_cliente_id      uuid                     DEFAULT NULL::uuid,
  p_cargos          jsonb                    DEFAULT NULL::jsonb
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
  v_total_cargos       numeric := 0;
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

  -- Cargos: se validan antes de crear nada para no dejar operaciones a medias.
  IF p_cargos IS NOT NULL THEN
    v_total_cargos := public._validar_y_sumar_cargos_operacion(p_cargos);
    IF v_total_cargos > 0 AND p_tipo <> 'COMPRA' THEN
      RAISE EXCEPTION 'Solo las compras admiten cargos' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_sentido := CASE WHEN p_tipo = 'COMPRA' THEN 1::smallint ELSE -1::smallint END;

  IF p_lineas IS NOT NULL AND jsonb_array_length(p_lineas) > 0 THEN
    SELECT COALESCE(SUM(((elem ->> 'cantidad')::integer * (elem ->> 'monto_unitario')::numeric)), 0)
    INTO v_monto_total
    FROM jsonb_array_elements(p_lineas) AS elem;
  END IF;

  -- El total de la operación incluye los cargos: pagos, estado_pago y saldo los consideran.
  v_monto_total := v_monto_total + v_total_cargos;

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

  IF v_total_cargos > 0 THEN
    PERFORM public._guardar_cargos_operacion(v_tenant_id, v_operacion_id, p_cargos);
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

-- Función interna: no chequea permisos (eso lo hace el wrapper rpc_), así que solo la ejecutan el
-- wrapper y service_role. DROP + CREATE reinicia las ACL y los default privileges de Supabase
-- dan EXECUTE a anon y authenticated: hay que revocarlo explícitamente (como en 20261101120000).
REVOKE ALL ON FUNCTION public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamptz, uuid, text, text, numeric, boolean, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamptz, uuid, text, text, numeric, boolean, uuid, uuid, jsonb) TO postgres, service_role;

CREATE FUNCTION public.rpc_crear_operacion_con_stock (
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
  p_cliente_id      uuid                     DEFAULT NULL::uuid,
  p_cargos          jsonb                    DEFAULT NULL::jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  RETURN public._crear_operacion_con_stock(
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
    p_monto_inicial := p_monto_inicial,
    p_mover_stock := p_mover_stock,
    p_proveedor_id := p_proveedor_id,
    p_cliente_id := p_cliente_id,
    p_cargos := p_cargos
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamptz, uuid, text, text, numeric, boolean, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamptz, uuid, text, text, numeric, boolean, uuid, uuid, jsonb) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Edición de cargos de compra
-- ----------------------------------------------------------------------------

-- La firma sin p_cargos conserva el contrato de quienes solo editan fecha u observaciones.
CREATE FUNCTION public.rpc_actualizar_operacion(
  p_operacion_id uuid,
  p_fecha timestamptz,
  p_observaciones text,
  p_cargos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_resultado jsonb;
  v_op record;
  v_total_cargos numeric;
  v_cargos_anteriores numeric;
  v_total numeric;
BEGIN
  -- Reutiliza la autorización y el bloqueo de la fila que también usa el registro de pagos.
  v_resultado := public.rpc_actualizar_operacion(p_operacion_id, p_fecha, p_observaciones);

  SELECT tenant_id, tipo, monto_total, total_pagado INTO STRICT v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = public.current_tenant_id();

  IF v_op.tipo <> 'COMPRA' THEN
    RAISE EXCEPTION 'Solo las compras admiten cargos' USING ERRCODE = '22023';
  END IF;

  v_total_cargos := public._validar_y_sumar_cargos_operacion(p_cargos);

  SELECT COALESCE(sum(importe), 0) INTO v_cargos_anteriores
  FROM public.operaciones_cargos
  WHERE operacion_id = p_operacion_id AND tenant_id = v_op.tenant_id;

  v_total := v_op.monto_total - v_cargos_anteriores + v_total_cargos;
  IF v_total < v_op.total_pagado THEN
    RAISE EXCEPTION 'El total de la compra no puede quedar por debajo del importe ya pagado'
      USING ERRCODE = '22023';
  END IF;
  IF v_total >= 1000000000000 THEN
    RAISE EXCEPTION 'El total supera el importe máximo de la compra' USING ERRCODE = '22023';
  END IF;

  PERFORM public._guardar_cargos_operacion(v_op.tenant_id, p_operacion_id, p_cargos);

  UPDATE public.operaciones
  SET monto_total = v_total
  WHERE id = p_operacion_id AND tenant_id = v_op.tenant_id AND monto_total IS DISTINCT FROM v_total;

  RETURN v_resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_actualizar_operacion(uuid, timestamptz, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_operacion(uuid, timestamptz, text, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
