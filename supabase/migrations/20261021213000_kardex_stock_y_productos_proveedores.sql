-- ============================================================================
-- Migración: Kardex de Stock Inmutable, Catálogo N:M Productos-Proveedores y Proveedor en Operaciones
-- ============================================================================

-- 1. Función para bloquear mutación directa en movimientos_stock (Ledger inmutable)
CREATE OR REPLACE FUNCTION public._stock_bloquear_mutacion_ledger()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
BEGIN
  IF current_setting('app.stock_tenant_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'Los registros del kardex de stock son inmutables.' USING ERRCODE = '55000';
END;
$function$;

GRANT EXECUTE ON FUNCTION public._stock_bloquear_mutacion_ledger() TO "anon", "authenticated", "service_role", "postgres";

-- 2. Tabla public.movimientos_stock (Kardex físico)
CREATE TABLE IF NOT EXISTS public.movimientos_stock (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  taller_id           uuid NOT NULL REFERENCES public.talleres(id) ON DELETE RESTRICT,
  producto_id         uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  stock_id            uuid NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  operacion_id        uuid REFERENCES public.operaciones(id) ON DELETE SET NULL,
  detalle_arreglo_id  uuid REFERENCES public.detalle_arreglo(id) ON DELETE SET NULL,
  tipo_movimiento     text NOT NULL,
  cantidad            integer NOT NULL,
  saldo_anterior      integer NOT NULL,
  saldo_posterior     integer NOT NULL,
  fecha               timestamptz NOT NULL DEFAULT now(),
  motivo              text,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT movimientos_stock_cantidad_nonzero CHECK (cantidad <> 0),
  CONSTRAINT movimientos_stock_saldo_ant_nonneg CHECK (saldo_anterior >= 0),
  CONSTRAINT movimientos_stock_saldo_post_nonneg CHECK (saldo_posterior >= 0),
  CONSTRAINT movimientos_stock_consistencia CHECK (saldo_posterior = saldo_anterior + cantidad),
  CONSTRAINT movimientos_stock_tipo_check CHECK (
    tipo_movimiento IN ('COMPRA', 'VENTA', 'ASIGNACION_ARREGLO', 'AJUSTE', 'REVERSION', 'INICIAL', 'DEVOLUCION_NC')
  )
);

ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_access ON public.movimientos_stock;
CREATE POLICY tenant_access ON public.movimientos_stock
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_mov_stock_prod_taller ON public.movimientos_stock USING btree (producto_id, taller_id, fecha DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_stock_operacion ON public.movimientos_stock USING btree (operacion_id) WHERE operacion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mov_stock_tenant_fecha ON public.movimientos_stock USING btree (tenant_id, fecha DESC);

DROP TRIGGER IF EXISTS movimientos_stock_bloquear_mutacion ON public.movimientos_stock;
CREATE TRIGGER movimientos_stock_bloquear_mutacion
  BEFORE UPDATE OR DELETE ON public.movimientos_stock
  FOR EACH ROW
  EXECUTE FUNCTION public._stock_bloquear_mutacion_ledger();

GRANT SELECT, INSERT ON TABLE public.movimientos_stock TO "anon", "authenticated";
GRANT ALL ON TABLE public.movimientos_stock TO "service_role", "postgres";

-- 3. Función auxiliar para asentar en el ledger de stock
CREATE OR REPLACE FUNCTION public._stock_ledger_insertar (
  p_tenant_id          uuid,
  p_taller_id          uuid,
  p_producto_id        uuid,
  p_stock_id           uuid,
  p_operacion_id       uuid,
  p_tipo_movimiento    text,
  p_cantidad           integer,
  p_saldo_anterior     integer,
  p_saldo_posterior    integer,
  p_fecha              timestamptz DEFAULT now(),
  p_motivo             text DEFAULT NULL,
  p_created_by         uuid DEFAULT NULL,
  p_detalle_arreglo_id uuid DEFAULT NULL
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.movimientos_stock (
    tenant_id,
    taller_id,
    producto_id,
    stock_id,
    operacion_id,
    detalle_arreglo_id,
    tipo_movimiento,
    cantidad,
    saldo_anterior,
    saldo_posterior,
    fecha,
    motivo,
    created_by
  )
  VALUES (
    p_tenant_id,
    p_taller_id,
    p_producto_id,
    p_stock_id,
    p_operacion_id,
    p_detalle_arreglo_id,
    p_tipo_movimiento,
    p_cantidad,
    p_saldo_anterior,
    p_saldo_posterior,
    COALESCE(p_fecha, now()),
    p_motivo,
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public._stock_ledger_insertar TO "anon", "authenticated", "service_role", "postgres";

-- 4. Backfill de saldo inicial para stocks existentes que tengan cantidad > 0
INSERT INTO public.movimientos_stock (
  tenant_id, taller_id, producto_id, stock_id, tipo_movimiento,
  cantidad, saldo_anterior, saldo_posterior, fecha, motivo
)
SELECT
  s.tenant_id, s.taller_id, s.producto_id, s.id, 'INICIAL',
  s.cantidad, 0, s.cantidad, s.created_at, 'Stock inicial registrado'
FROM public.stocks s
WHERE s.cantidad > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.movimientos_stock ms WHERE ms.stock_id = s.id
  );

-- 5. Tabla public.productos_proveedores (Catálogo N a N)
CREATE TABLE IF NOT EXISTS public.productos_proveedores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  producto_id       uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  proveedor_id      uuid NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  codigo_proveedor  text,
  costo_referencia  numeric(14,2) NOT NULL DEFAULT 0.00,
  es_predeterminado boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT productos_proveedores_costo_nonneg CHECK (costo_referencia >= 0),
  CONSTRAINT uq_productos_proveedores UNIQUE (tenant_id, producto_id, proveedor_id)
);

ALTER TABLE public.productos_proveedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_access ON public.productos_proveedores;
CREATE POLICY tenant_access ON public.productos_proveedores
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_prod_prov_proveedor ON public.productos_proveedores USING btree (tenant_id, proveedor_id);
CREATE INDEX IF NOT EXISTS idx_prod_prov_producto ON public.productos_proveedores USING btree (tenant_id, producto_id);

DROP TRIGGER IF EXISTS productos_proveedores_set_updated_at ON public.productos_proveedores;
CREATE TRIGGER productos_proveedores_set_updated_at
  BEFORE UPDATE ON public.productos_proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON TABLE public.productos_proveedores TO "anon", "authenticated", "service_role", "postgres";

-- 6. Agregar columna proveedor_id en public.operaciones
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operaciones_proveedor_id ON public.operaciones (proveedor_id)
  WHERE proveedor_id IS NOT NULL;

-- 7. Actualizar rpc_crear_operacion_con_stock con Kardex y proveedor_id
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean, uuid);

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
  p_proveedor_id    uuid                     DEFAULT NULL::uuid
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

  -- Validar proveedor si se especificó
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

  -- Insertar operación inicial
  INSERT INTO public.operaciones (
    tenant_id, tipo, taller_id, fecha, observaciones,
    proveedor_id,
    estado_pago,
    estado_stock
  )
  VALUES (
    v_tenant_id, v_tipo, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''),
    p_proveedor_id,
    v_estado_pago,
    CASE
      WHEN v_tipo NOT IN ('COMPRA', 'VENTA') THEN 'ENTREGADO'::public.estado_stock_operacion
      WHEN v_mover_stock THEN 'ENTREGADO'::public.estado_stock_operacion
      ELSE 'PENDIENTE'::public.estado_stock_operacion
    END
  )
  RETURNING id INTO v_operacion_id;

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

-- 8. Actualizar rpc_confirmar_stock_operacion con Kardex
CREATE OR REPLACE FUNCTION public.rpc_confirmar_stock_operacion (
  p_operacion_id uuid,
  p_fecha        timestamp with time zone DEFAULT now(),
  p_lineas       jsonb                    DEFAULT NULL::jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id        uuid := public.current_tenant_id();
  v_op               record;
  v_linea            record;
  v_item             jsonb;
  v_item_linea_id    uuid;
  v_item_stock_id    uuid;
  v_item_cant        int;
  v_pendiente        int;
  v_confirmar        int;
  v_confirmadas      int := 0;
  v_total_pactadas   int := 0;
  v_total_cumplidas  int := 0;
  v_saldo_ant        int;
  v_saldo_post       int;
  v_producto_id      uuid;
  v_nuevo_estado     public.estado_stock_operacion;
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

  IF v_op.tipo NOT IN ('COMPRA', 'VENTA') THEN
    RAISE EXCEPTION 'Solo se puede confirmar stock de compras o ventas' USING ERRCODE = '22023';
  END IF;

  IF v_op.estado_stock = 'ENTREGADO' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'operacion_id', p_operacion_id,
      'estado_stock', 'ENTREGADO',
      'unidades_confirmadas', 0,
      'mensaje', 'El stock de esta operación ya se encontraba entregado'
    );
  END IF;

  IF p_lineas IS NULL OR jsonb_array_length(p_lineas) = 0 THEN
    -- Confirmar todo lo pendiente en todas las líneas
    FOR v_linea IN
      SELECT id, stock_id, cantidad, cantidad_cumplida
      FROM public.operaciones_lineas
      WHERE operacion_id = p_operacion_id
      FOR UPDATE
    LOOP
      v_pendiente := v_linea.cantidad - v_linea.cantidad_cumplida;
      IF v_pendiente > 0 THEN
        SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
        FROM public.stocks s
        WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id
        FOR UPDATE;

        IF v_op.tipo = 'COMPRA' THEN
          v_saldo_post := v_saldo_ant + v_pendiente;
          UPDATE public.stocks AS s
          SET cantidad = v_saldo_post,
              cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_pendiente),
              updated_at = now()
          WHERE s.id = v_linea.stock_id;

          PERFORM public._stock_ledger_insertar(
            v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
            'COMPRA', v_pendiente, v_saldo_ant, v_saldo_post,
            COALESCE(p_fecha, now()), 'Recepción diferida de Compra #' || substr(p_operacion_id::text, 1, 8)
          );

        ELSIF v_op.tipo = 'VENTA' THEN
          IF v_saldo_ant < v_pendiente THEN
            RAISE EXCEPTION 'Stock físico insuficiente en taller para entregar la venta diferida' USING ERRCODE = 'P0001';
          END IF;

          v_saldo_post := v_saldo_ant - v_pendiente;
          UPDATE public.stocks AS s
          SET cantidad = v_saldo_post,
              cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_pendiente),
              updated_at = now()
          WHERE s.id = v_linea.stock_id;

          PERFORM public._stock_ledger_insertar(
            v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
            'VENTA', -v_pendiente, v_saldo_ant, v_saldo_post,
            COALESCE(p_fecha, now()), 'Entrega diferida de Venta #' || substr(p_operacion_id::text, 1, 8)
          );
        END IF;

        UPDATE public.operaciones_lineas
        SET cantidad_cumplida = cantidad,
            delta_cantidad = CASE WHEN v_op.tipo = 'VENTA' THEN -cantidad ELSE cantidad END
        WHERE id = v_linea.id;

        v_confirmadas := v_confirmadas + v_pendiente;
      END IF;
    END LOOP;

  ELSE
    -- Confirmación selectiva o parcial por línea
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas)
    LOOP
      v_item_linea_id := NULL;
      v_item_stock_id := NULL;

      IF (v_item->>'linea_id') IS NOT NULL AND (v_item->>'linea_id') <> '' THEN
        v_item_linea_id := (v_item->>'linea_id')::uuid;
      END IF;
      IF (v_item->>'stock_id') IS NOT NULL AND (v_item->>'stock_id') <> '' THEN
        v_item_stock_id := (v_item->>'stock_id')::uuid;
      END IF;

      v_item_cant := COALESCE((v_item->>'cantidad')::int, 0);

      IF v_item_cant < 0 THEN
        RAISE EXCEPTION 'La cantidad a confirmar no puede ser negativa' USING ERRCODE = '22023';
      END IF;

      IF v_item_cant = 0 THEN
        CONTINUE;
      END IF;

      SELECT id, stock_id, cantidad, cantidad_cumplida
      INTO v_linea
      FROM public.operaciones_lineas
      WHERE operacion_id = p_operacion_id
        AND (
          (v_item_linea_id IS NOT NULL AND id = v_item_linea_id) OR
          (v_item_linea_id IS NULL AND v_item_stock_id IS NOT NULL AND stock_id = v_item_stock_id)
        )
      LIMIT 1
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Línea de operación no encontrada' USING ERRCODE = 'P0002';
      END IF;

      v_pendiente := v_linea.cantidad - v_linea.cantidad_cumplida;
      IF v_item_cant > v_pendiente THEN
        RAISE EXCEPTION 'La cantidad a confirmar (%) excede el remanente pendiente (%)', v_item_cant, v_pendiente USING ERRCODE = '22023';
      END IF;

      v_confirmar := v_item_cant;

      SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
      FROM public.stocks s
      WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id
      FOR UPDATE;

      IF v_op.tipo = 'COMPRA' THEN
        v_saldo_post := v_saldo_ant + v_confirmar;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            cantidad_pendiente = GREATEST(0, s.cantidad_pendiente - v_confirmar),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'COMPRA', v_confirmar, v_saldo_ant, v_saldo_post,
          COALESCE(p_fecha, now()), 'Recepción parcial de Compra #' || substr(p_operacion_id::text, 1, 8)
        );

      ELSIF v_op.tipo = 'VENTA' THEN
        IF v_saldo_ant < v_confirmar THEN
          RAISE EXCEPTION 'Stock físico insuficiente en taller para entregar unidades solicitadas' USING ERRCODE = 'P0001';
        END IF;

        v_saldo_post := v_saldo_ant - v_confirmar;
        UPDATE public.stocks AS s
        SET cantidad = v_saldo_post,
            cantidad_reservada = GREATEST(0, s.cantidad_reservada - v_confirmar),
            updated_at = now()
        WHERE s.id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'VENTA', -v_confirmar, v_saldo_ant, v_saldo_post,
          COALESCE(p_fecha, now()), 'Entrega parcial de Venta #' || substr(p_operacion_id::text, 1, 8)
        );
      END IF;

      UPDATE public.operaciones_lineas
      SET cantidad_cumplida = cantidad_cumplida + v_confirmar,
          delta_cantidad = CASE WHEN v_op.tipo = 'VENTA' THEN -(cantidad_cumplida + v_confirmar) ELSE (cantidad_cumplida + v_confirmar) END
      WHERE id = v_linea.id;

      v_confirmadas := v_confirmadas + v_confirmar;
    END LOOP;
  END IF;

  -- Recalcular estado_stock de la operación
  SELECT coalesce(sum(cantidad), 0), coalesce(sum(cantidad_cumplida), 0)
  INTO v_total_pactadas, v_total_cumplidas
  FROM public.operaciones_lineas
  WHERE operacion_id = p_operacion_id;

  IF v_total_cumplidas >= v_total_pactadas AND v_total_pactadas > 0 THEN
    v_nuevo_estado := 'ENTREGADO'::public.estado_stock_operacion;
  ELSIF v_total_cumplidas > 0 THEN
    v_nuevo_estado := 'PARCIAL'::public.estado_stock_operacion;
  ELSE
    v_nuevo_estado := 'PENDIENTE'::public.estado_stock_operacion;
  END IF;

  UPDATE public.operaciones
  SET estado_stock = v_nuevo_estado
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'estado_stock', v_nuevo_estado,
    'unidades_confirmadas', v_confirmadas,
    'total_cumplidas', v_total_cumplidas,
    'total_pactadas', v_total_pactadas
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_confirmar_stock_operacion TO "anon", "authenticated", "service_role", "postgres";

-- 9. Actualizar rpc_borrar_operacion_con_stock con Kardex (movimientos compensatorios de REVERSION)
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
      -- Lo cumplido salió físicamente del taller
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
      -- Lo entregado regresa al stock físico del taller
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
  DELETE FROM public.operaciones WHERE id = p_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock TO "anon", "authenticated", "service_role", "postgres";

-- 10. Nueva RPC: rpc_listar_movimientos_stock (Kardex)
CREATE OR REPLACE FUNCTION public.rpc_listar_movimientos_stock (
  p_producto_id  uuid,
  p_taller_id    uuid DEFAULT NULL,
  p_limite       int  DEFAULT 50,
  p_offset       int  DEFAULT 0
)
  RETURNS TABLE (
    id                uuid,
    tenant_id         uuid,
    taller_id         uuid,
    taller_nombre     text,
    producto_id       uuid,
    producto_nombre   text,
    producto_codigo   text,
    stock_id          uuid,
    operacion_id      uuid,
    operacion_tipo    text,
    tipo_movimiento   text,
    cantidad          int,
    saldo_anterior    int,
    saldo_posterior   int,
    fecha             timestamptz,
    motivo            text,
    created_by        uuid,
    created_at        timestamptz
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
  SELECT
    ms.id,
    ms.tenant_id,
    ms.taller_id,
    t.nombre AS taller_nombre,
    ms.producto_id,
    p.nombre AS producto_nombre,
    p.codigo AS producto_codigo,
    ms.stock_id,
    ms.operacion_id,
    o.tipo::text AS operacion_tipo,
    ms.tipo_movimiento,
    ms.cantidad,
    ms.saldo_anterior,
    ms.saldo_posterior,
    ms.fecha,
    ms.motivo,
    ms.created_by,
    ms.created_at
  FROM public.movimientos_stock ms
  JOIN public.talleres t ON t.id = ms.taller_id
  JOIN public.productos p ON p.id = ms.producto_id
  LEFT JOIN public.operaciones o ON o.id = ms.operacion_id
  WHERE ms.tenant_id = public.current_tenant_id()
    AND ms.producto_id = p_producto_id
    AND (p_taller_id IS NULL OR ms.taller_id = p_taller_id)
  ORDER BY ms.fecha DESC, ms.created_at DESC
  LIMIT LEAST(COALESCE(p_limite, 50), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_movimientos_stock TO "anon", "authenticated", "service_role", "postgres";
