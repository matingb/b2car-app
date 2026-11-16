-- ============================================================================
-- Cargos de operación (percepciones de la factura de compra)
--
-- Importes que suman al total de una operación sin ser mercadería. Por ahora solo
-- percepciones, cargadas en el alta de una COMPRA junto con su factura recibida.
--
-- Reglas:
--   * operaciones.monto_total = Σ líneas de mercadería + Σ cargos. Se calcula al crear la
--     operación; desde ahí el pago inicial, estado_pago (trigger), el saldo pendiente y los
--     pagos posteriores (limitados al saldo) incluyen los cargos sin cambios adicionales.
--   * Los cargos pertenecen a la operación, no a la factura: editar o eliminar la factura
--     recibida no modifica la deuda (los documentos siguen sin mover dinero).
--   * Solo operaciones COMPRA: la FK apunta a operaciones_compra. Los gastos no admiten
--     cargos: su edición reescribe monto_total con el importe informado
--     (rpc_actualizar_movimiento_cuenta).
--   * Escritura solo dentro del alta (RPC SECURITY DEFINER, que usa el tenant de la propia
--     operación); el cliente solo lee.
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
  -- operaciones_compra solo tiene filas de COMPRA: la FK impone "solo compras" y borra los
  -- cargos en cascada junto con la operación.
  CONSTRAINT operaciones_cargos_operacion_id_fkey
    FOREIGN KEY (operacion_id) REFERENCES public.operaciones_compra(operacion_id) ON DELETE CASCADE,
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
  'Importes de una operación que no son mercadería (hoy: percepciones de la factura de compra). Suman a operaciones.monto_total.';

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
-- 3. Alta de operaciones con stock: nuevo parámetro p_cargos (al final, con default)
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
  v_cargo              jsonb;
  v_cargo_orden        integer := 0;
  v_cargo_tipo         text;
  v_cargo_codigo       text;
  v_cargo_descripcion  text;
  v_cargo_importe      numeric;
  v_total_cargos       numeric(14,2) := 0;
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
  IF p_cargos IS NOT NULL AND jsonb_typeof(p_cargos) <> 'array' THEN
    RAISE EXCEPTION 'Los cargos deben ser una lista' USING ERRCODE = '22023';
  END IF;
  IF p_cargos IS NOT NULL AND jsonb_array_length(p_cargos) > 0 THEN
    IF p_tipo <> 'COMPRA' THEN
      RAISE EXCEPTION 'Solo las compras admiten cargos' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_cargos) > 100 THEN
      RAISE EXCEPTION 'La operación admite hasta 100 cargos' USING ERRCODE = '22023';
    END IF;
    FOR v_cargo IN SELECT elem FROM jsonb_array_elements(p_cargos) AS elem
    LOOP
      v_cargo_orden := v_cargo_orden + 1;
      v_cargo_tipo := COALESCE(v_cargo ->> 'tipo', 'PERCEPCION');
      v_cargo_codigo := v_cargo ->> 'percepcion_codigo';
      v_cargo_descripcion := btrim(COALESCE(v_cargo ->> 'descripcion', ''));
      BEGIN
        v_cargo_importe := (v_cargo ->> 'importe')::numeric;
      EXCEPTION WHEN others THEN
        v_cargo_importe := NULL;
      END;
      IF v_cargo_tipo <> 'PERCEPCION' THEN
        RAISE EXCEPTION 'Cargo %: tipo no admitido', v_cargo_orden USING ERRCODE = '22023';
      END IF;
      IF v_cargo_codigo IS NULL OR v_cargo_codigo <> ALL (ARRAY['GANANCIAS', 'IVA', 'IIBB_BUENOS_AIRES', 'IIBB_CABA', 'OTRA']) THEN
        RAISE EXCEPTION 'Cargo %: la percepción no es válida', v_cargo_orden USING ERRCODE = '22023';
      END IF;
      IF char_length(v_cargo_descripcion) NOT BETWEEN 1 AND 200 THEN
        RAISE EXCEPTION 'Cargo %: la descripción es obligatoria (hasta 200 caracteres)', v_cargo_orden USING ERRCODE = '22023';
      END IF;
      IF v_cargo_importe IS NULL OR v_cargo_importe <= 0 OR round(v_cargo_importe, 2) <> v_cargo_importe THEN
        RAISE EXCEPTION 'Cargo %: el importe debe ser mayor a 0 y tener hasta 2 decimales', v_cargo_orden USING ERRCODE = '22023';
      END IF;
      v_total_cargos := v_total_cargos + v_cargo_importe;
    END LOOP;
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
    INSERT INTO public.operaciones_cargos (
      tenant_id, operacion_id, orden, tipo, percepcion_codigo, descripcion, importe
    )
    SELECT
      v_tenant_id,
      v_operacion_id,
      c.orden::integer,
      COALESCE(c.elem ->> 'tipo', 'PERCEPCION'),
      c.elem ->> 'percepcion_codigo',
      btrim(c.elem ->> 'descripcion'),
      (c.elem ->> 'importe')::numeric
    FROM jsonb_array_elements(p_cargos) WITH ORDINALITY AS c(elem, orden);
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
