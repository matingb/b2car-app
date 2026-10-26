-- ============================================================================
-- Migración: Tablas independientes para Operaciones de Venta y Compra
-- (Desacopla cliente_id y proveedor_id de public.operaciones)
-- ============================================================================

-- 1. Crear tabla public.operaciones_venta
CREATE TABLE IF NOT EXISTS public.operaciones_venta (
  operacion_id uuid NOT NULL,
  tenant_id    uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  cliente_id   uuid NOT NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT operaciones_venta_pkey PRIMARY KEY (operacion_id),
  CONSTRAINT operaciones_venta_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT operaciones_venta_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT,
  CONSTRAINT operaciones_venta_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE public.operaciones_venta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_access ON public.operaciones_venta;
CREATE POLICY tenant_access ON public.operaciones_venta
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_op_venta_cliente ON public.operaciones_venta USING btree (tenant_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_op_venta_tenant ON public.operaciones_venta USING btree (tenant_id);

GRANT ALL ON TABLE public.operaciones_venta TO "anon", "authenticated", "service_role", "postgres";

-- 2. Crear tabla public.operaciones_compra
CREATE TABLE IF NOT EXISTS public.operaciones_compra (
  operacion_id uuid NOT NULL,
  tenant_id    uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  proveedor_id uuid NOT NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT operaciones_compra_pkey PRIMARY KEY (operacion_id),
  CONSTRAINT operaciones_compra_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT operaciones_compra_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE RESTRICT,
  CONSTRAINT operaciones_compra_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE public.operaciones_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_access ON public.operaciones_compra;
CREATE POLICY tenant_access ON public.operaciones_compra
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_op_compra_proveedor ON public.operaciones_compra USING btree (tenant_id, proveedor_id);
CREATE INDEX IF NOT EXISTS idx_op_compra_tenant ON public.operaciones_compra USING btree (tenant_id);

GRANT ALL ON TABLE public.operaciones_compra TO "anon", "authenticated", "service_role", "postgres";

-- 3. Migración de datos existentes: Backfill desde public.operaciones
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'operaciones' AND column_name = 'cliente_id'
  ) THEN
    INSERT INTO public.operaciones_venta (operacion_id, tenant_id, cliente_id, created_at)
    SELECT id, tenant_id, cliente_id, created_at
    FROM public.operaciones
    WHERE tipo = 'VENTA' AND cliente_id IS NOT NULL
    ON CONFLICT (operacion_id) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'operaciones' AND column_name = 'proveedor_id'
  ) THEN
    INSERT INTO public.operaciones_compra (operacion_id, tenant_id, proveedor_id, created_at)
    SELECT id, tenant_id, proveedor_id, created_at
    FROM public.operaciones
    WHERE tipo = 'COMPRA' AND proveedor_id IS NOT NULL
    ON CONFLICT (operacion_id) DO NOTHING;
  END IF;
END $$;

-- 4. Limpieza de columnas y constraints en public.operaciones
DROP INDEX IF EXISTS public.idx_operaciones_proveedor_id;

ALTER TABLE public.operaciones
  DROP CONSTRAINT IF EXISTS operaciones_proveedor_id_fkey;

ALTER TABLE public.operaciones
  DROP COLUMN IF EXISTS proveedor_id;

-- 5. Actualizar rpc_crear_operacion_con_stock con soporte para cliente y proveedor
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean, uuid);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean, uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock (
  p_tipo            text,
  p_taller_id       uuid,
  p_lineas          jsonb,
  p_arreglo_id      uuid                     DEFAULT NULL::uuid,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
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
  v_tenant_id        uuid := public.current_tenant_id();
  v_tipo             public.tipo_operacion;
  v_operacion_id     uuid;
  v_linea            jsonb;
  v_stock_id         uuid;
  v_producto_id      uuid;
  v_cantidad         int;
  v_monto_unitario   numeric;
  v_delta_cantidad   int;
  v_cantidad_cumpl   int;
  v_saldo_ant        int;
  v_saldo_post       int;
  v_importe          numeric := 0;
  v_rowcount         int;
  v_mover_stock      boolean := COALESCE(p_mover_stock, true);
  v_estado_pago      public.estado_pago_operacion;
  v_monto_pago       numeric := 0;
  v_cuenta_tipo      text;
  v_signo            int := 0;
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

  -- Validar cliente si se especificó para ventas
  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Cliente no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Validar proveedor si se especificó para compras
  IF p_proveedor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.proveedores WHERE id = p_proveedor_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Proveedor no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Resolver estado de pago inicial
  IF p_estado_pago IS NOT NULL THEN
    v_estado_pago := upper(p_estado_pago)::public.estado_pago_operacion;
  ELSIF p_cuenta_id IS NOT NULL THEN
    v_estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSE
    v_estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
  END IF;

  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;

  -- Insertar operación inicial en tabla central (sin columnas nuleables de cliente/proveedor)
  INSERT INTO public.operaciones (
    tenant_id, tipo, taller_id, fecha, observaciones,
    estado_pago,
    estado_stock
  )
  VALUES (
    v_tenant_id, v_tipo, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''),
    v_estado_pago,
    CASE
      WHEN v_tipo NOT IN ('COMPRA', 'VENTA') THEN 'ENTREGADO'::public.estado_stock_operacion
      WHEN v_mover_stock THEN 'ENTREGADO'::public.estado_stock_operacion
      ELSE 'PENDIENTE'::public.estado_stock_operacion
    END
  )
  RETURNING id INTO v_operacion_id;

  -- Asociar a cliente en tabla operaciones_venta
  IF v_tipo = 'VENTA' AND p_cliente_id IS NOT NULL THEN
    INSERT INTO public.operaciones_venta (operacion_id, tenant_id, cliente_id)
    VALUES (v_operacion_id, v_tenant_id, p_cliente_id);
  END IF;

  -- Asociar a proveedor en tabla operaciones_compra
  IF v_tipo = 'COMPRA' AND p_proveedor_id IS NOT NULL THEN
    INSERT INTO public.operaciones_compra (operacion_id, tenant_id, proveedor_id)
    VALUES (v_operacion_id, v_tenant_id, p_proveedor_id);
  END IF;

  IF p_arreglo_id IS NOT NULL AND v_tipo = 'ASIGNACION_ARREGLO' THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  END IF;

  -- Procesar líneas de producto
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

    -- Obtener datos actuales del stock con bloqueo
    SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
    FROM public.stocks s
    WHERE s.id = v_stock_id AND s.tenant_id = v_tenant_id AND s.taller_id = p_taller_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock no encontrado: %', v_stock_id USING ERRCODE = 'P0002';
    END IF;

    -- Movimientos de stock según tipo y diferimiento
    IF v_tipo = 'COMPRA' THEN
      IF v_mover_stock THEN
        v_cantidad_cumpl := v_cantidad;
        v_saldo_post := v_saldo_ant + v_cantidad;

        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            updated_at = now()
        WHERE s.id = v_stock_id;

        -- Registrar en Kardex de stock
        PERFORM public._stock_ledger_insertar(
          v_tenant_id, p_taller_id, v_producto_id, v_stock_id, v_operacion_id,
          'COMPRA', v_cantidad, v_saldo_ant, v_saldo_post,
          COALESCE(p_fecha, now()), 'Ingreso de mercadería por Compra #' || substr(v_operacion_id::text, 1, 8)
        );
      ELSE
        -- Compra diferida: queda en camino (pendiente de recepción física)
        v_cantidad_cumpl := 0;
        UPDATE public.stocks AS s
        SET cantidad_pendiente = s.cantidad_pendiente + v_cantidad,
            updated_at = now()
        WHERE s.id = v_stock_id;
      END IF;

    ELSIF v_tipo = 'VENTA' THEN
      IF v_mover_stock THEN
        IF v_saldo_ant < v_cantidad THEN
          RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
        END IF;

        v_cantidad_cumpl := v_cantidad;
        v_saldo_post := v_saldo_ant - v_cantidad;

        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            updated_at = now()
        WHERE s.id = v_stock_id;

        -- Registrar en Kardex de stock
        PERFORM public._stock_ledger_insertar(
          v_tenant_id, p_taller_id, v_producto_id, v_stock_id, v_operacion_id,
          'VENTA', -v_cantidad, v_saldo_ant, v_saldo_post,
          COALESCE(p_fecha, now()), 'Entrega de mercadería por Venta #' || substr(v_operacion_id::text, 1, 8)
        );
      ELSE
        -- Venta diferida: queda reservada en taller
        v_cantidad_cumpl := 0;
        UPDATE public.stocks AS s
        SET cantidad_reservada = s.cantidad_reservada + v_cantidad,
            updated_at = now()
        WHERE s.id = v_stock_id
          AND (s.cantidad - s.cantidad_reservada) >= v_cantidad;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount = 0 THEN
          RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
        END IF;
      END IF;

    ELSE
      -- ASIGNACION_ARREGLO u otros movimientos directos
      IF v_delta_cantidad < 0 AND v_saldo_ant < -v_delta_cantidad THEN
        RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
      END IF;

      v_cantidad_cumpl := v_cantidad;
      v_saldo_post := v_saldo_ant + v_delta_cantidad;

      UPDATE public.stocks AS s
      SET cantidad = v_saldo_post,
          updated_at = now()
      WHERE s.id = v_stock_id;

      -- Registrar en Kardex de stock
      PERFORM public._stock_ledger_insertar(
        v_tenant_id, p_taller_id, v_producto_id, v_stock_id, v_operacion_id,
        CASE WHEN v_tipo = 'ASIGNACION_ARREGLO' THEN 'ASIGNACION_ARREGLO' ELSE 'AJUSTE' END,
        v_delta_cantidad, v_saldo_ant, v_saldo_post,
        COALESCE(p_fecha, now()),
        'Movimiento de stock por ' || v_tipo::text || ' #' || substr(v_operacion_id::text, 1, 8)
      );
    END IF;

    INSERT INTO public.operaciones_lineas (
      operacion_id,
      stock_id,
      cantidad,
      cantidad_cumplida,
      monto_unitario,
      delta_cantidad
    )
    VALUES (
      v_operacion_id,
      v_stock_id,
      v_cantidad,
      v_cantidad_cumpl,
      v_monto_unitario,
      v_delta_cantidad
    );

    v_importe := v_importe + (v_cantidad * v_monto_unitario);
  END LOOP;

  -- Actualizar monto total en operaciones
  UPDATE public.operaciones
  SET monto_total = v_importe
  WHERE id = v_operacion_id;

  -- Determinar monto pagado inicial
  IF p_cuenta_id IS NOT NULL THEN
    IF v_estado_pago = 'PAGADO' THEN
      v_monto_pago := v_importe;
    ELSIF v_estado_pago = 'PARCIAL' THEN
      IF p_monto_inicial IS NULL OR p_monto_inicial <= 0 OR p_monto_inicial >= v_importe THEN
        RAISE EXCEPTION 'Para estado de pago PARCIAL debe indicar un monto inicial válido menor al total' USING ERRCODE = '22023';
      END IF;
      v_monto_pago := p_monto_inicial;
    END IF;
  ELSE
    v_monto_pago := 0;
  END IF;

  -- Registrar movimiento en ledger financiero y en operaciones_pagos si hay pago inicial
  IF p_cuenta_id IS NOT NULL AND v_monto_pago > 0 THEN
    SELECT tipo INTO v_cuenta_tipo FROM public.cuentas_financieras WHERE id = p_cuenta_id;
    IF v_tipo = 'COMPRA' THEN
      v_signo := -1;
    ELSIF v_tipo = 'VENTA' THEN
      v_signo := 1;
    END IF;

    IF v_signo <> 0 THEN
      PERFORM public._ledger_insertar(v_operacion_id, v_tenant_id, p_cuenta_id, v_signo * v_monto_pago, p_fecha);

      INSERT INTO public.operaciones_pagos (
        tenant_id,
        operacion_id,
        cuenta_financiera_id,
        monto,
        fecha,
        descripcion
      )
      VALUES (
        v_tenant_id,
        v_operacion_id,
        p_cuenta_id,
        v_monto_pago,
        COALESCE(p_fecha, now()),
        'Pago inicial al registrar operación #' || substr(v_operacion_id::text, 1, 8)
      );
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock TO "anon", "authenticated", "service_role", "postgres";

-- 6. Actualizar rpc_borrar_operacion_con_stock para limpiar tablas hijas
DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid);

CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock (
  p_operacion_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id       uuid := public.current_tenant_id();
  v_op              record;
  v_linea           record;
  v_pago            record;
  v_cumplida        int;
  v_remanente       int;
  v_saldo_ant       int;
  v_saldo_post      int;
  v_producto_id     uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT id, tipo, taller_id, estado_stock
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  -- Revertir stock según cantidad física cumplida y reservas/pendientes
  FOR v_linea IN
    SELECT id, stock_id, cantidad, cantidad_cumplida, delta_cantidad
    FROM public.operaciones_lineas
    WHERE operacion_id = p_operacion_id
    FOR UPDATE
  LOOP
    v_cumplida := COALESCE(v_linea.cantidad_cumplida, v_linea.cantidad);
    v_remanente := GREATEST(0, v_linea.cantidad - v_cumplida);

    SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
    FROM public.stocks s
    WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id
    FOR UPDATE;

    IF v_op.tipo = 'COMPRA' THEN
      IF v_cumplida > 0 THEN
        IF v_saldo_ant < v_cumplida THEN
          RAISE EXCEPTION 'Stock insuficiente para revertir la compra (unidades ya consumidas o vendidas)' USING ERRCODE = 'P0001';
        END IF;

        v_saldo_post := v_saldo_ant - v_cumplida;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_remanente),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'REVERSION', -v_cumplida, v_saldo_ant, v_saldo_post,
          now(), 'Reversión por anulación de Compra #' || substr(p_operacion_id::text, 1, 8)
        );
      ELSE
        UPDATE public.stocks AS s
        SET cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_remanente),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;
      END IF;

    ELSIF v_op.tipo = 'VENTA' THEN
      IF v_cumplida > 0 THEN
        v_saldo_post := v_saldo_ant + v_cumplida;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_remanente),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'REVERSION', v_cumplida, v_saldo_ant, v_saldo_post,
          now(), 'Reversión por anulación de Venta #' || substr(p_operacion_id::text, 1, 8)
        );
      ELSE
        UPDATE public.stocks AS s
        SET cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_remanente),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;
      END IF;

    ELSE
      -- ASIGNACION_ARREGLO u otros movimientos
      IF v_linea.delta_cantidad < 0 THEN
        v_saldo_post := v_saldo_ant - v_linea.delta_cantidad;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'REVERSION', -v_linea.delta_cantidad, v_saldo_ant, v_saldo_post,
          now(), 'Reversión por anulación de Asignación #' || substr(p_operacion_id::text, 1, 8)
        );
      ELSIF v_linea.delta_cantidad > 0 THEN
        IF v_saldo_ant < v_linea.delta_cantidad THEN
          RAISE EXCEPTION 'Stock insuficiente para revertir operación' USING ERRCODE = 'P0001';
        END IF;

        v_saldo_post := v_saldo_ant - v_linea.delta_cantidad;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'REVERSION', -v_linea.delta_cantidad, v_saldo_ant, v_saldo_post,
          now(), 'Reversión por anulación de Operación #' || substr(p_operacion_id::text, 1, 8)
        );
      END IF;
    END IF;
  END LOOP;

  -- Revertir movimientos financieros asociados en ledger
  FOR v_pago IN
    SELECT m.id
    FROM public.movimientos_financieros AS m
    WHERE m.operacion_id = p_operacion_id
      AND m.tenant_id = v_tenant_id
  LOOP
    PERFORM public._finanzas_reversar_movimiento(v_pago.id, now());
  END LOOP;

  -- Eliminar registros dependientes
  DELETE FROM public.operaciones_pagos WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_lineas WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_asignacion_arreglo WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_venta WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_compra WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones WHERE id = p_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock TO "anon", "authenticated", "service_role", "postgres";

-- 7. Actualizar rpc_listar_operaciones_con_gastos incorporando cliente_id, cliente_nombre, proveedor_id, proveedor_nombre
DROP FUNCTION IF EXISTS public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer);

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
    monto_total              numeric,
    total_pagado             numeric,
    saldo_pendiente          numeric,
    esta_pago                boolean,
    estado_pago              text,
    estado_stock             text,
    arreglo_id               uuid,
    total_count              bigint,
    observaciones            text,
    proveedor_id             uuid,
    proveedor_nombre         text,
    cliente_id               uuid,
    cliente_nombre           text
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
          'cantidad', l.cantidad, 'cantidad_cumplida', l.cantidad_cumplida,
          'monto_unitario', l.monto_unitario, 'delta_cantidad', l.delta_cantidad,
          'created_at', l.created_at, 'nombre', p.nombre, 'codigo', p.codigo
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
        WHEN EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones d WHERE d.operacion_ajuste_id = o.id) THEN
          'Devolución por NC · ' || COALESCE((
            SELECT 'NC ' || COALESCE(n.numero_comprobante::text, n.id::text)
              || ' · Factura ' || COALESCE(f.numero_comprobante::text, f.id::text)
            FROM public.facturacion_nc_devoluciones d
            JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id
            JOIN public.facturas_electronicas f ON f.id = n.documento_asociado_id
            WHERE d.operacion_ajuste_id = o.id LIMIT 1
          ), '')
        ELSE omc.descripcion
      END AS descripcion,
      omc.categoria_gasto,
      COALESCE(omc.cuenta_id, omc.cuenta_origen_id, mf.cuenta_financiera_id) AS cuenta_financiera_id,
      COALESCE(cf_s.nombre, cf_o.nombre, cf_m.nombre) AS cuenta_financiera_nombre,
      COALESCE(
        abs(omc.importe),
        abs(mf.importe),
        o.monto_total,
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
      )::numeric AS monto,
      o.monto_total,
      o.total_pagado,
      GREATEST(0, COALESCE(o.monto_total, 0) - COALESCE(o.total_pagado, 0))::numeric AS saldo_pendiente,
      COALESCE(o.esta_pago, false) AS esta_pago,
      o.estado_pago::text AS estado_pago,
      o.estado_stock::text AS estado_stock,
      COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id,
      o.observaciones,
      oc.proveedor_id,
      prov.nombre AS proveedor_nombre,
      ov.cliente_id,
      COALESCE(NULLIF(TRIM(concat(part.nombre, ' ', COALESCE(part.apellido, ''))), ''), emp.nombre) AS cliente_nombre
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
    LEFT JOIN public.operaciones_venta AS ov ON ov.operacion_id = o.id
    LEFT JOIN public.particulares AS part ON part.id = ov.cliente_id
    LEFT JOIN public.empresas AS emp ON emp.id = ov.cliente_id
    LEFT JOIN public.operaciones_compra AS oc ON oc.operacion_id = o.id
    LEFT JOIN public.proveedores AS prov ON prov.id = oc.proveedor_id
    LEFT JOIN public.arreglos AS a ON a.id = COALESCE(oca.arreglo_id, oaa.arreglo_id)
    LEFT JOIN public.vehiculos AS v ON v.id = a.vehiculo_id
    LEFT JOIN public.cuentas_financieras AS cf_s ON cf_s.id = omc.cuenta_id
    LEFT JOIN public.cuentas_financieras AS cf_o ON cf_o.id = omc.cuenta_origen_id
    LEFT JOIN public.cuentas_financieras AS cf_m ON cf_m.id = mf.cuenta_financiera_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
  )
  SELECT
    r.id, r.tipo, r.taller_id, r.fecha, r.created_at, r.lineas, r.gasto_id, r.descripcion, r.categoria_gasto,
    r.cuenta_financiera_id, r.cuenta_financiera_nombre, r.monto,
    r.monto_total, r.total_pagado, r.saldo_pendiente, r.esta_pago, r.estado_pago, r.estado_stock,
    r.arreglo_id, COUNT(*) OVER() AS total_count, r.observaciones,
    r.proveedor_id, r.proveedor_nombre, r.cliente_id, r.cliente_nombre
  FROM rows AS r
  WHERE COALESCE(cardinality(p_tipos), 0) = 0 OR r.tipo = ANY(p_tipos)
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO "service_role";
REVOKE ALL ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) FROM "postgres";
GRANT EXECUTE ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO "postgres";
