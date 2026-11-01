-- =============================================================================
-- Migración C: Rediseño de Operaciones - Stock, OMS y Kardex
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Esquema de Stock
-- -----------------------------------------------------------------------------

-- Acotar trigger_recalcular_precio_operaciones_lineas antes de tocar operaciones_lineas
DROP TRIGGER IF EXISTS trigger_recalcular_precio_operaciones_lineas ON public.operaciones_lineas;
CREATE TRIGGER trigger_recalcular_precio_operaciones_lineas
  AFTER INSERT OR DELETE OR UPDATE OF cantidad, monto_unitario, stock_id, iva_alicuota_id ON public.operaciones_lineas
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

-- 1.1 operaciones_lineas: sentido, cantidad_cancelada, constraints e índices
ALTER TABLE public.operaciones_lineas
  ADD COLUMN IF NOT EXISTS sentido smallint;

-- Backfill sentido para datos existentes antes de NOT NULL
UPDATE public.operaciones_lineas l
SET sentido = CASE
  WHEN l.delta_cantidad <> 0 THEN sign(l.delta_cantidad)::smallint
  WHEN o.tipo = 'COMPRA' THEN 1::smallint
  WHEN o.tipo IN ('VENTA', 'ASIGNACION_ARREGLO') THEN -1::smallint
  ELSE 1::smallint
END
FROM public.operaciones o
WHERE o.id = l.operacion_id AND l.sentido IS NULL;

UPDATE public.operaciones_lineas SET sentido = 1 WHERE sentido IS NULL;

ALTER TABLE public.operaciones_lineas
  ALTER COLUMN sentido SET NOT NULL;

ALTER TABLE public.operaciones_lineas
  DROP CONSTRAINT IF EXISTS operaciones_lineas_sentido_check;
ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_sentido_check CHECK (sentido IN (-1, 1));

ALTER TABLE public.operaciones_lineas
  ADD COLUMN IF NOT EXISTS cantidad_cancelada integer NOT NULL DEFAULT 0;

ALTER TABLE public.operaciones_lineas
  DROP CONSTRAINT IF EXISTS operaciones_lineas_cancelada_nonneg;
ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_cancelada_nonneg CHECK (cantidad_cancelada >= 0);

ALTER TABLE public.operaciones_lineas
  DROP CONSTRAINT IF EXISTS operaciones_lineas_cumplida_cancelada_pactada;
ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_cumplida_cancelada_pactada CHECK (cantidad_cumplida + cantidad_cancelada <= cantidad);

-- delta_cantidad como columna generada (sentido * cantidad)
ALTER TABLE public.operaciones_lineas
  DROP COLUMN IF EXISTS delta_cantidad CASCADE;

ALTER TABLE public.operaciones_lineas
  ADD COLUMN delta_cantidad integer GENERATED ALWAYS AS (sentido * cantidad) STORED;

CREATE INDEX IF NOT EXISTS idx_operaciones_lineas_abiertas
  ON public.operaciones_lineas (stock_id)
  WHERE (cantidad_cumplida + cantidad_cancelada < cantidad);

-- 1.2 Tabla operaciones_movimiento_stock (OMS)
CREATE TABLE IF NOT EXISTS public.operaciones_movimiento_stock (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  operacion_id        uuid NOT NULL REFERENCES public.operaciones(id) ON DELETE CASCADE,
  operacion_linea_id  uuid NOT NULL REFERENCES public.operaciones_lineas(id) ON DELETE CASCADE,
  stock_id            uuid NOT NULL REFERENCES public.stocks(id) ON DELETE RESTRICT,
  cantidad            integer NOT NULL CHECK (cantidad <> 0),
  fecha               timestamp with time zone NOT NULL,
  motivo              text,
  idempotency_key     uuid,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_oms_tenant_idempotency
  ON public.operaciones_movimiento_stock (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_oms_operacion_id ON public.operaciones_movimiento_stock (operacion_id);
CREATE INDEX IF NOT EXISTS idx_oms_linea_id ON public.operaciones_movimiento_stock (operacion_linea_id);
CREATE INDEX IF NOT EXISTS idx_oms_stock_id ON public.operaciones_movimiento_stock (stock_id);
CREATE INDEX IF NOT EXISTS idx_oms_tenant_fecha ON public.operaciones_movimiento_stock (tenant_id, fecha DESC);

ALTER TABLE public.operaciones_movimiento_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operaciones_movimiento_stock_tenant_select ON public.operaciones_movimiento_stock;
CREATE POLICY operaciones_movimiento_stock_tenant_select ON public.operaciones_movimiento_stock
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

GRANT SELECT ON TABLE public.operaciones_movimiento_stock TO authenticated;
GRANT ALL ON TABLE public.operaciones_movimiento_stock TO postgres, service_role;

-- 1.3 movimientos_stock: oms_id, quitar FKs y revocar escritura directa
ALTER TABLE public.movimientos_stock
  ADD COLUMN IF NOT EXISTS oms_id uuid;

CREATE INDEX IF NOT EXISTS idx_mov_stock_oms_id
  ON public.movimientos_stock (oms_id)
  WHERE oms_id IS NOT NULL;

ALTER TABLE public.movimientos_stock
  DROP CONSTRAINT IF EXISTS movimientos_stock_operacion_id_fkey;

ALTER TABLE public.movimientos_stock
  DROP CONSTRAINT IF EXISTS movimientos_stock_detalle_arreglo_id_fkey;

REVOKE INSERT, UPDATE, DELETE ON public.movimientos_stock FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Triggers y Helpers de Derivados
-- -----------------------------------------------------------------------------

-- 2.1 Helper _sync_stock_derivados: recalcula cantidad_reservada y cantidad_pendiente
CREATE OR REPLACE FUNCTION public._sync_stock_derivados(p_stock_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reservada int;
  v_pendiente int;
  v_cant_actual int;
BEGIN
  IF p_stock_id IS NULL THEN RETURN; END IF;

  -- Reservada: ventas abiertas
  SELECT COALESCE(SUM(l.cantidad - l.cantidad_cumplida - l.cantidad_cancelada), 0)
  INTO v_reservada
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  WHERE l.stock_id = p_stock_id
    AND o.tipo = 'VENTA'
    AND (l.cantidad - l.cantidad_cumplida - l.cantidad_cancelada) > 0;

  -- Pendiente: compras abiertas
  SELECT COALESCE(SUM(l.cantidad - l.cantidad_cumplida - l.cantidad_cancelada), 0)
  INTO v_pendiente
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  WHERE l.stock_id = p_stock_id
    AND o.tipo = 'COMPRA'
    AND (l.cantidad - l.cantidad_cumplida - l.cantidad_cancelada) > 0;

  SELECT s.cantidad INTO v_cant_actual FROM public.stocks s WHERE s.id = p_stock_id;

  IF (v_cant_actual - v_reservada) < 0 THEN
    RAISE EXCEPTION 'STOCK_INSUFICIENTE' USING ERRCODE = '55002';
  END IF;

  PERFORM set_config('app.stock_derivados_write', 'on', true);
  UPDATE public.stocks
  SET cantidad_reservada = v_reservada,
      cantidad_pendiente = v_pendiente,
      updated_at = now()
  WHERE id = p_stock_id
    AND (cantidad_reservada IS DISTINCT FROM v_reservada OR cantidad_pendiente IS DISTINCT FROM v_pendiente);
END;
$function$;

GRANT EXECUTE ON FUNCTION public._sync_stock_derivados(uuid) TO postgres, service_role;

-- 2.2 Helper _sync_operacion_estado_stock
CREATE OR REPLACE FUNCTION public._sync_operacion_estado_stock(p_operacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo public.tipo_operacion;
  v_pactada int;
  v_cumplida int;
  v_cancelada int;
  v_nuevo public.estado_stock_operacion;
BEGIN
  IF p_operacion_id IS NULL THEN RETURN; END IF;

  SELECT tipo INTO v_tipo FROM public.operaciones WHERE id = p_operacion_id;
  IF v_tipo NOT IN ('COMPRA', 'VENTA') THEN RETURN; END IF;

  SELECT COALESCE(SUM(cantidad), 0),
         COALESCE(SUM(cantidad_cumplida), 0),
         COALESCE(SUM(cantidad_cancelada), 0)
  INTO v_pactada, v_cumplida, v_cancelada
  FROM public.operaciones_lineas
  WHERE operacion_id = p_operacion_id;

  IF v_pactada = 0 THEN
    v_nuevo := 'ENTREGADO';
  ELSIF (v_cumplida + v_cancelada) >= v_pactada THEN
    v_nuevo := 'ENTREGADO';
  ELSIF v_cumplida > 0 OR v_cancelada > 0 THEN
    v_nuevo := 'PARCIAL';
  ELSE
    v_nuevo := 'PENDIENTE';
  END IF;

  UPDATE public.operaciones
  SET estado_stock = v_nuevo
  WHERE id = p_operacion_id
    AND estado_stock IS DISTINCT FROM v_nuevo;
END;
$function$;

GRANT EXECUTE ON FUNCTION public._sync_operacion_estado_stock(uuid) TO postgres, service_role;

-- 2.3 Trigger _stock_aplicar_movimiento: único escritor de stocks.cantidad
CREATE OR REPLACE FUNCTION public._stock_aplicar_movimiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saldo_ant int;
  v_saldo_post int;
BEGIN
  SELECT s.cantidad INTO v_saldo_ant
  FROM public.stocks s
  WHERE s.id = NEW.stock_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock no encontrado: %', NEW.stock_id USING ERRCODE = 'P0002';
  END IF;

  NEW.saldo_anterior := v_saldo_ant;
  v_saldo_post := v_saldo_ant + NEW.cantidad;
  NEW.saldo_posterior := v_saldo_post;

  IF v_saldo_post < 0 THEN
    IF NEW.reversion_de_id IS NOT NULL THEN
      RAISE EXCEPTION 'STOCK_INSUFICIENTE: Stock insuficiente para revertir la operación' USING ERRCODE = '55005';
    ELSE
      RAISE EXCEPTION 'STOCK_INSUFICIENTE' USING ERRCODE = '55002';
    END IF;
  END IF;

  PERFORM set_config('app.stock_ledger_write', 'on', true);
  UPDATE public.stocks
  SET cantidad = v_saldo_post,
      updated_at = now()
  WHERE id = NEW.stock_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_stock_aplicar_movimiento ON public.movimientos_stock;
CREATE TRIGGER trg_stock_aplicar_movimiento
  BEFORE INSERT ON public.movimientos_stock
  FOR EACH ROW EXECUTE FUNCTION public._stock_aplicar_movimiento();

-- 2.4 Trigger _stocks_proteger_saldos
CREATE OR REPLACE FUNCTION public._stocks_proteger_saldos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.cantidad := 0;
    NEW.cantidad_reservada := 0;
    NEW.cantidad_pendiente := 0;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.cantidad IS DISTINCT FROM OLD.cantidad THEN
      IF current_setting('app.stock_ledger_write', true) IS DISTINCT FROM 'on'
         AND current_setting('app.stock_cleanup', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'La cantidad de stock solo puede modificarse a través del kardex' USING ERRCODE = '55000';
      END IF;
    END IF;

    IF NEW.cantidad_reservada IS DISTINCT FROM OLD.cantidad_reservada
       OR NEW.cantidad_pendiente IS DISTINCT FROM OLD.cantidad_pendiente THEN
      IF current_setting('app.stock_derivados_write', true) IS DISTINCT FROM 'on'
         AND current_setting('app.stock_cleanup', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'Las cantidades reservada y pendiente de stock solo pueden modificarse a través de derivados' USING ERRCODE = '55000';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_stocks_proteger_saldos ON public.stocks;
CREATE TRIGGER trg_stocks_proteger_saldos
  BEFORE INSERT OR UPDATE ON public.stocks
  FOR EACH ROW EXECUTE FUNCTION public._stocks_proteger_saldos();

-- 2.5 Trigger _oms_validar
CREATE OR REPLACE FUNCTION public._oms_validar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_linea record;
  v_op record;
BEGIN
  SELECT l.id, l.operacion_id, l.stock_id, l.sentido, l.cantidad, l.cantidad_cumplida, l.cantidad_cancelada
  INTO v_linea
  FROM public.operaciones_lineas l
  WHERE l.id = NEW.operacion_linea_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Línea de operación no encontrada: %', NEW.operacion_linea_id USING ERRCODE = '22023';
  END IF;

  IF v_linea.operacion_id <> NEW.operacion_id OR v_linea.stock_id <> NEW.stock_id THEN
    RAISE EXCEPTION 'Línea de operación no coincide con operacion_id o stock_id' USING ERRCODE = '22023';
  END IF;

  SELECT o.id, o.tenant_id, o.fecha, o.tipo
  INTO v_op
  FROM public.operaciones o
  WHERE o.id = NEW.operacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', NEW.operacion_id USING ERRCODE = '22023';
  END IF;

  IF v_op.tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'tenant_id no coincide con el de la operación' USING ERRCODE = '22023';
  END IF;

  NEW.fecha := COALESCE(NEW.fecha, v_op.fecha, now());

  IF (v_linea.sentido * NEW.cantidad) <= 0 THEN
    RAISE EXCEPTION 'El impacto de stock debe tener el mismo signo que el sentido de la línea' USING ERRCODE = '22023';
  END IF;

  IF (v_linea.cantidad_cumplida + (v_linea.sentido * NEW.cantidad)) > (v_linea.cantidad - v_linea.cantidad_cancelada) THEN
    RAISE EXCEPTION 'El impacto de stock excede la cantidad pendiente de la línea' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_oms_validar ON public.operaciones_movimiento_stock;
CREATE TRIGGER trg_oms_validar
  BEFORE INSERT ON public.operaciones_movimiento_stock
  FOR EACH ROW EXECUTE FUNCTION public._oms_validar();

-- 2.6 Trigger OMS BEFORE UPDATE (Inmutable)
CREATE OR REPLACE FUNCTION public._oms_bloquear_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Los impactos de stock son inmutables' USING ERRCODE = '55000';
END;
$function$;

DROP TRIGGER IF EXISTS trg_oms_bloquear_update ON public.operaciones_movimiento_stock;
CREATE TRIGGER trg_oms_bloquear_update
  BEFORE UPDATE ON public.operaciones_movimiento_stock
  FOR EACH ROW EXECUTE FUNCTION public._oms_bloquear_update();

-- 2.7 Trigger _oms_after_insert
CREATE OR REPLACE FUNCTION public._oms_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_op record;
  v_stock record;
  v_tipo_mov text;
  v_motivo_ajuste text;
BEGIN
  SELECT o.id, o.tipo, o.taller_id, o.tenant_id
  INTO v_op
  FROM public.operaciones o
  WHERE o.id = NEW.operacion_id;

  SELECT s.id, s.taller_id, s.producto_id
  INTO v_stock
  FROM public.stocks s
  WHERE s.id = NEW.stock_id;

  IF v_op.tipo = 'COMPRA' THEN
    v_tipo_mov := 'COMPRA';
  ELSIF v_op.tipo = 'VENTA' THEN
    v_tipo_mov := 'VENTA';
  ELSIF v_op.tipo = 'ASIGNACION_ARREGLO' THEN
    v_tipo_mov := 'ASIGNACION_ARREGLO';
  ELSIF v_op.tipo = 'AJUSTE' THEN
    SELECT motivo INTO v_motivo_ajuste
    FROM public.operaciones_ajuste
    WHERE operacion_id = NEW.operacion_id;

    IF v_motivo_ajuste = 'INICIAL' THEN
      v_tipo_mov := 'INICIAL';
    ELSIF v_motivo_ajuste = 'DEVOLUCION_NC' THEN
      v_tipo_mov := 'DEVOLUCION_NC';
    ELSE
      v_tipo_mov := 'AJUSTE';
    END IF;
  ELSE
    v_tipo_mov := 'AJUSTE';
  END IF;

  INSERT INTO public.movimientos_stock (
    tenant_id,
    taller_id,
    producto_id,
    stock_id,
    operacion_id,
    oms_id,
    tipo_movimiento,
    cantidad,
    saldo_anterior,
    saldo_posterior,
    fecha,
    motivo,
    created_by
  ) VALUES (
    NEW.tenant_id,
    COALESCE(v_op.taller_id, v_stock.taller_id),
    v_stock.producto_id,
    NEW.stock_id,
    NEW.operacion_id,
    NEW.id,
    v_tipo_mov,
    NEW.cantidad,
    0,
    0,
    NEW.fecha,
    NEW.motivo,
    NEW.created_by
  );

  UPDATE public.operaciones_lineas
  SET cantidad_cumplida = (
    SELECT COALESCE(SUM(l.sentido * oms.cantidad), 0)
    FROM public.operaciones_movimiento_stock oms
    JOIN public.operaciones_lineas l ON l.id = oms.operacion_linea_id
    WHERE oms.operacion_linea_id = NEW.operacion_linea_id
  )
  WHERE id = NEW.operacion_linea_id;

  PERFORM public._sync_operacion_estado_stock(NEW.operacion_id);
  PERFORM public._sync_stock_derivados(NEW.stock_id);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_oms_after_insert ON public.operaciones_movimiento_stock;
CREATE TRIGGER trg_oms_after_insert
  AFTER INSERT ON public.operaciones_movimiento_stock
  FOR EACH ROW EXECUTE FUNCTION public._oms_after_insert();

-- 2.8 Trigger _oms_after_delete
CREATE OR REPLACE FUNCTION public._oms_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orig record;
BEGIN
  SELECT *
  INTO v_orig
  FROM public.movimientos_stock m
  WHERE m.oms_id = OLD.id
    AND m.reversion_de_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.movimientos_stock rev
      WHERE rev.reversion_de_id = m.id
    )
  ORDER BY m.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.movimientos_stock (
      tenant_id,
      taller_id,
      producto_id,
      stock_id,
      operacion_id,
      oms_id,
      tipo_movimiento,
      cantidad,
      saldo_anterior,
      saldo_posterior,
      fecha,
      motivo,
      created_by,
      reversion_de_id
    ) VALUES (
      v_orig.tenant_id,
      v_orig.taller_id,
      v_orig.producto_id,
      v_orig.stock_id,
      v_orig.operacion_id,
      OLD.id,
      'REVERSION',
      -v_orig.cantidad,
      0,
      0,
      now(),
      COALESCE(OLD.motivo, 'Reversión de impacto de stock'),
      OLD.created_by,
      v_orig.id
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.operaciones_lineas WHERE id = OLD.operacion_linea_id) THEN
    UPDATE public.operaciones_lineas
    SET cantidad_cumplida = (
      SELECT COALESCE(SUM(l.sentido * oms.cantidad), 0)
      FROM public.operaciones_movimiento_stock oms
      JOIN public.operaciones_lineas l ON l.id = oms.operacion_linea_id
      WHERE oms.operacion_linea_id = OLD.operacion_linea_id
    )
    WHERE id = OLD.operacion_linea_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.operaciones WHERE id = OLD.operacion_id) THEN
    PERFORM public._sync_operacion_estado_stock(OLD.operacion_id);
  END IF;

  IF EXISTS (SELECT 1 FROM public.stocks WHERE id = OLD.stock_id) THEN
    PERFORM public._sync_stock_derivados(OLD.stock_id);
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_oms_after_delete ON public.operaciones_movimiento_stock;
CREATE TRIGGER trg_oms_after_delete
  AFTER DELETE ON public.operaciones_movimiento_stock
  FOR EACH ROW EXECUTE FUNCTION public._oms_after_delete();

-- 2.9 Trigger _lineas_recalcular_stock
CREATE OR REPLACE FUNCTION public._lineas_recalcular_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM public._sync_stock_derivados(NEW.stock_id);
    IF TG_OP = 'UPDATE' AND OLD.stock_id IS DISTINCT FROM NEW.stock_id THEN
      PERFORM public._sync_stock_derivados(OLD.stock_id);
    END IF;
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (NEW.cantidad IS DISTINCT FROM OLD.cantidad OR NEW.cantidad_cancelada IS DISTINCT FROM OLD.cantidad_cancelada)) THEN
      PERFORM public._sync_operacion_estado_stock(NEW.operacion_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public._sync_stock_derivados(OLD.stock_id);
    PERFORM public._sync_operacion_estado_stock(OLD.operacion_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_lineas_recalcular_stock ON public.operaciones_lineas;
CREATE TRIGGER trg_lineas_recalcular_stock
  AFTER INSERT OR DELETE OR UPDATE OF cantidad, stock_id, cantidad_cancelada ON public.operaciones_lineas
  FOR EACH ROW EXECUTE FUNCTION public._lineas_recalcular_stock();

-- 2.10 Acotar trigger_recalcular_precio_operaciones_lineas
DROP TRIGGER IF EXISTS trigger_recalcular_precio_operaciones_lineas ON public.operaciones_lineas;
CREATE TRIGGER trigger_recalcular_precio_operaciones_lineas
  AFTER INSERT OR DELETE OR UPDATE OF cantidad, monto_unitario, stock_id, iva_alicuota_id ON public.operaciones_lineas
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

-- -----------------------------------------------------------------------------
-- 3. RPCs de Stock y Arreglos
-- -----------------------------------------------------------------------------

-- 3.1 rpc_crear_operacion_con_stock
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid);
CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock (
  p_tipo              public.tipo_operacion,
  p_taller_id         uuid,
  p_lineas            jsonb,
  p_arreglo_id        uuid                     DEFAULT NULL::uuid,
  p_cuenta_id         uuid                     DEFAULT NULL::uuid,
  p_pagos             jsonb                    DEFAULT NULL::jsonb,
  p_fecha             timestamp with time zone DEFAULT now(),
  p_idempotency_key   uuid                     DEFAULT NULL::uuid,
  p_observaciones     text                     DEFAULT NULL::text,
  p_estado_pago       text                     DEFAULT NULL::text,
  p_monto_inicial     numeric                  DEFAULT NULL::numeric,
  p_mover_stock       boolean                  DEFAULT true,
  p_proveedor_id      uuid                     DEFAULT NULL::uuid,
  p_cliente_id        uuid                     DEFAULT NULL::uuid
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
  ELSIF p_cuenta_id IS NOT NULL AND (p_monto_inicial IS NOT NULL OR v_monto_total > 0) THEN
    v_total_pagos := COALESCE(p_monto_inicial, v_monto_total);
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

GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamptz, uuid, text, text, numeric, boolean, uuid, uuid) TO authenticated, service_role, postgres;

-- 3.2 rpc_confirmar_stock_operacion
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
  v_fecha            timestamp with time zone := COALESCE(p_fecha, now());
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

  -- CASO 1: Confirmación global (entrega total del remanente pendiente)
  IF p_lineas IS NULL OR jsonb_array_length(p_lineas) = 0 THEN
    FOR v_linea IN
      SELECT ol.id, ol.stock_id, ol.cantidad, ol.cantidad_cumplida, ol.cantidad_cancelada, ol.sentido
      FROM public.operaciones_lineas ol
      WHERE ol.operacion_id = p_operacion_id
      ORDER BY ol.stock_id
      FOR UPDATE
    LOOP
      v_pendiente := v_linea.cantidad - v_linea.cantidad_cumplida - v_linea.cantidad_cancelada;
      IF v_pendiente <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant_id, p_operacion_id, v_linea.id, v_linea.stock_id,
        v_linea.sentido * v_pendiente,
        v_fecha,
        CASE WHEN v_op.tipo = 'COMPRA' THEN 'Recepción de Compra' ELSE 'Entrega de Venta' END
      );

      v_confirmadas := v_confirmadas + v_pendiente;
    END LOOP;

  -- CASO 2: Confirmación parcial por líneas
  ELSE
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineas)
    LOOP
      v_item_linea_id := (v_item ->> 'linea_id')::uuid;
      v_item_stock_id := (v_item ->> 'stock_id')::uuid;
      v_item_cant     := (v_item ->> 'cantidad')::int;

      IF v_item_cant IS NULL OR v_item_cant <= 0 THEN
        CONTINUE;
      END IF;

      IF v_item_linea_id IS NOT NULL THEN
        SELECT ol.id, ol.stock_id, ol.cantidad, ol.cantidad_cumplida, ol.cantidad_cancelada, ol.sentido
        INTO v_linea
        FROM public.operaciones_lineas ol
        WHERE ol.id = v_item_linea_id AND ol.operacion_id = p_operacion_id
        FOR UPDATE;
      ELSE
        SELECT ol.id, ol.stock_id, ol.cantidad, ol.cantidad_cumplida, ol.cantidad_cancelada, ol.sentido
        INTO v_linea
        FROM public.operaciones_lineas ol
        WHERE ol.stock_id = v_item_stock_id AND ol.operacion_id = p_operacion_id
        ORDER BY ol.id
        LIMIT 1
        FOR UPDATE;
      END IF;

      IF v_linea.id IS NULL THEN
        RAISE EXCEPTION 'Línea de operación no encontrada' USING ERRCODE = 'P0002';
      END IF;

      v_pendiente := v_linea.cantidad - v_linea.cantidad_cumplida - v_linea.cantidad_cancelada;
      v_confirmar := LEAST(v_pendiente, v_item_cant);

      IF v_confirmar <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant_id, p_operacion_id, v_linea.id, v_linea.stock_id,
        v_linea.sentido * v_confirmar,
        v_fecha,
        CASE WHEN v_op.tipo = 'COMPRA' THEN 'Recepción parcial de Compra' ELSE 'Entrega parcial de Venta' END
      );

      v_confirmadas := v_confirmadas + v_confirmar;
    END LOOP;
  END IF;

  SELECT estado_stock INTO v_op.estado_stock FROM public.operaciones WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'estado_stock', v_op.estado_stock,
    'unidades_confirmadas', v_confirmadas
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_confirmar_stock_operacion(uuid, timestamptz, jsonb) TO authenticated, service_role, postgres;

-- 3.3 rpc_revertir_movimiento_stock_operacion
CREATE OR REPLACE FUNCTION public.rpc_revertir_movimiento_stock_operacion (
  p_operacion_id  uuid,
  p_movimiento_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op        record;
  v_mov       record;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_operacion_id IS NULL OR p_movimiento_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos' USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'Solo se pueden revertir movimientos de stock en compras o ventas' USING ERRCODE = '22023';
  END IF;

  SELECT id, tipo_movimiento, cantidad, stock_id, reversion_de_id, oms_id
  INTO v_mov
  FROM public.movimientos_stock
  WHERE id = p_movimiento_id AND operacion_id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento de stock no encontrado: %', p_movimiento_id USING ERRCODE = 'P0002';
  END IF;

  IF v_mov.reversion_de_id IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede revertir una reversión' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.movimientos_stock
    WHERE reversion_de_id = p_movimiento_id
  ) THEN
    RAISE EXCEPTION 'Este movimiento ya fue revertido' USING ERRCODE = '22023';
  END IF;

  IF v_mov.oms_id IS NULL THEN
    RAISE EXCEPTION 'No se puede revertir un movimiento histórico previo al rediseño' USING ERRCODE = '22023';
  END IF;

  -- Borra la OMS: el trigger _oms_after_delete registra la reversión en kardex y recalcula stock y estado
  DELETE FROM public.operaciones_movimiento_stock
  WHERE id = v_mov.oms_id;

  SELECT estado_stock INTO v_op.estado_stock FROM public.operaciones WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'estado_stock', v_op.estado_stock
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_revertir_movimiento_stock_operacion(uuid, uuid) TO authenticated, service_role, postgres;

-- 3.4 y 3.5 DROP de rpc_revertir_operacion_linea y _stock_ledger_insertar
DROP FUNCTION IF EXISTS public.rpc_revertir_operacion_linea(uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_revertir_operacion_linea(uuid);
DROP FUNCTION IF EXISTS public._stock_ledger_insertar(uuid, uuid, uuid, uuid, uuid, text, integer, integer, integer, timestamp with time zone, text);

-- 3.6 rpc_set_asignacion_arreglo_linea
CREATE OR REPLACE FUNCTION public.rpc_set_asignacion_arreglo_linea (
  p_arreglo_id           uuid,
  p_taller_id            uuid,
  p_stock_id             uuid,
  p_cantidad             integer,
  p_monto_unitario       numeric DEFAULT 0,
  p_categoria_arreglo_id uuid    DEFAULT NULL::uuid,
  p_empleado_id          uuid    DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion_id uuid;
  v_arreglo_fecha timestamp with time zone;
  v_linea_id uuid;
  v_linea_cant integer;
  v_stock_taller_id uuid;
  v_diff integer;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida (%)', p_cantidad USING ERRCODE = '22023'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario inválido (%)', p_monto_unitario USING ERRCODE = '22023'; END IF;

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;

  SELECT s.taller_id INTO v_stock_taller_id
  FROM public.stocks s WHERE s.id = p_stock_id FOR UPDATE;

  IF v_stock_taller_id IS NULL THEN RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id USING ERRCODE = 'P0002'; END IF;
  IF v_stock_taller_id <> p_taller_id THEN RAISE EXCEPTION 'stock_id no pertenece al taller' USING ERRCODE = '22023'; END IF;

  -- Buscar o crear la operación de ASIGNACION_ARREGLO
  SELECT oa.operacion_id INTO v_operacion_id
  FROM public.operaciones_asignacion_arreglo oa
  WHERE oa.arreglo_id = p_arreglo_id LIMIT 1;

  IF v_operacion_id IS NULL THEN
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, monto_total)
    VALUES (v_tenant_id, 'ASIGNACION_ARREGLO', p_taller_id, COALESCE(v_arreglo_fecha, now()), 0)
    RETURNING id INTO v_operacion_id;

    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, tenant_id, arreglo_id)
    VALUES (v_operacion_id, v_tenant_id, p_arreglo_id);
  END IF;

  -- Buscar línea existente
  SELECT l.id, l.cantidad INTO v_linea_id, v_linea_cant
  FROM public.operaciones_lineas l
  WHERE l.operacion_id = v_operacion_id AND l.stock_id = p_stock_id
  FOR UPDATE;

  IF v_linea_id IS NULL THEN
    -- Alta de línea
    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, sentido,
      categoria_arreglo_id, empleado_id
    ) VALUES (
      v_operacion_id, p_stock_id, p_cantidad, p_monto_unitario, -1,
      p_categoria_arreglo_id, p_empleado_id
    ) RETURNING id INTO v_linea_id;

    INSERT INTO public.operaciones_movimiento_stock (
      tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
    ) VALUES (
      v_tenant_id, v_operacion_id, v_linea_id, p_stock_id,
      -p_cantidad, COALESCE(v_arreglo_fecha, now()), 'Asignación a arreglo'
    );
  ELSE
    -- Modificación de línea
    IF p_cantidad > v_linea_cant THEN
      v_diff := p_cantidad - v_linea_cant;
      UPDATE public.operaciones_lineas
      SET cantidad = p_cantidad,
          monto_unitario = p_monto_unitario,
          categoria_arreglo_id = p_categoria_arreglo_id,
          empleado_id = p_empleado_id
      WHERE id = v_linea_id;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant_id, v_operacion_id, v_linea_id, p_stock_id,
        -v_diff, COALESCE(v_arreglo_fecha, now()), 'Aumento de asignación a arreglo'
      );
    ELSIF p_cantidad < v_linea_cant THEN
      -- Al bajar la cantidad, primero la devolución (borrado/reemplazo de OMS) y después baja la cantidad
      DELETE FROM public.operaciones_movimiento_stock WHERE operacion_linea_id = v_linea_id;

      UPDATE public.operaciones_lineas
      SET cantidad = p_cantidad,
          monto_unitario = p_monto_unitario,
          categoria_arreglo_id = p_categoria_arreglo_id,
          empleado_id = p_empleado_id
      WHERE id = v_linea_id;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant_id, v_operacion_id, v_linea_id, p_stock_id,
        -p_cantidad, COALESCE(v_arreglo_fecha, now()), 'Reajuste de asignación a arreglo'
      );
    ELSE
      UPDATE public.operaciones_lineas
      SET monto_unitario = p_monto_unitario,
          categoria_arreglo_id = p_categoria_arreglo_id,
          empleado_id = p_empleado_id
      WHERE id = v_linea_id;
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, integer, numeric, uuid, uuid) TO authenticated, service_role, postgres;

-- 3.7 rpc_delete_asignacion_arreglo_linea
DROP FUNCTION IF EXISTS public.rpc_delete_asignacion_arreglo_linea(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_delete_asignacion_arreglo_linea(uuid);
CREATE OR REPLACE FUNCTION public.rpc_delete_asignacion_arreglo_linea (
  p_operacion_linea_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_linea_id IS NULL THEN RAISE EXCEPTION 'operacion_linea_id requerido' USING ERRCODE = '22023'; END IF;

  SELECT l.operacion_id INTO v_operacion_id
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  WHERE l.id = p_operacion_linea_id
    AND o.tenant_id = v_tenant_id
    AND o.tipo = 'ASIGNACION_ARREGLO'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'línea no encontrada (%)', p_operacion_linea_id USING ERRCODE = 'P0002';
  END IF;

  -- Borrar la línea (la cascada borra OMS y el trigger _oms_after_delete revierte en kardex)
  DELETE FROM public.operaciones_lineas WHERE id = p_operacion_linea_id;

  -- Si la operación no tiene más líneas, se borra (cascada elimina el vínculo con el arreglo)
  IF NOT EXISTS (SELECT 1 FROM public.operaciones_lineas WHERE operacion_id = v_operacion_id) THEN
    DELETE FROM public.operaciones WHERE id = v_operacion_id;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_delete_asignacion_arreglo_linea(uuid) TO authenticated, service_role, postgres;

-- 3.8 rpc_asignar_repuesto_existente_con_compra y rpc_crear_producto_inline_para_arreglo
CREATE OR REPLACE FUNCTION public.rpc_asignar_repuesto_existente_con_compra(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_stock_id uuid,
  p_cantidad integer,
  p_monto_unitario numeric,
  p_precio_compra numeric DEFAULT NULL,
  p_categoria_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo_fecha timestamptz;
  v_stock_cantidad integer;
  v_old_cantidad integer;
  v_delta_diff integer;
  v_faltante integer;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad invalida' USING ERRCODE = '22023'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario invalido' USING ERRCODE = '22023'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id;

  IF v_arreglo_fecha IS NULL THEN
    RAISE EXCEPTION 'arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002';
  END IF;

  SELECT s.cantidad INTO v_stock_cantidad
  FROM public.stocks AS s
  WHERE s.id = p_stock_id AND s.tenant_id = v_tenant_id AND s.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id USING ERRCODE = 'P0002';
  END IF;

  SELECT l.cantidad INTO v_old_cantidad
  FROM public.operaciones_lineas AS l
  JOIN public.operaciones_asignacion_arreglo AS oa ON oa.operacion_id = l.operacion_id
  WHERE oa.arreglo_id = p_arreglo_id AND l.stock_id = p_stock_id;

  v_delta_diff := p_cantidad - COALESCE(v_old_cantidad, 0);

  IF v_delta_diff > 0 THEN
    v_faltante := v_delta_diff - v_stock_cantidad;
    IF v_faltante > 0 THEN
      IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN
        RAISE EXCEPTION 'PRECIO_COMPRA_REQUERIDO faltante=%', v_faltante USING ERRCODE = 'P0001';
      END IF;

      PERFORM public.rpc_crear_operacion_con_stock(
        p_tipo := 'COMPRA'::public.tipo_operacion,
        p_taller_id := p_taller_id,
        p_lineas := jsonb_build_array(jsonb_build_object(
          'stock_id', p_stock_id,
          'cantidad', v_faltante,
          'monto_unitario', p_precio_compra
        )),
        p_arreglo_id := NULL::uuid,
        p_fecha := v_arreglo_fecha,
        p_cuenta_id := p_cuenta_id,
        p_idempotency_key := p_idempotency_key
      );
    END IF;
  END IF;

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := p_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_monto_unitario,
    p_categoria_arreglo_id := p_categoria_arreglo_id,
    p_empleado_id := p_empleado_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, integer, numeric, numeric, uuid, uuid, uuid, uuid) TO authenticated, service_role, postgres;

CREATE OR REPLACE FUNCTION public.rpc_crear_producto_inline_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_codigo text,
  p_nombre text,
  p_precio_compra numeric,
  p_precio_venta numeric,
  p_cantidad integer,
  p_categoria_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_stock_id uuid;
  v_arreglo_fecha timestamptz;
  v_codigo text := trim(coalesce(p_codigo, ''));
  v_nombre text := trim(coalesce(p_nombre, ''));
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF v_codigo = '' THEN RAISE EXCEPTION 'codigo requerido' USING ERRCODE = '22023'; END IF;
  IF v_nombre = '' THEN RAISE EXCEPTION 'nombre requerido' USING ERRCODE = '22023'; END IF;
  IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN RAISE EXCEPTION 'precio_compra invalido' USING ERRCODE = '22023'; END IF;
  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN RAISE EXCEPTION 'precio_venta invalido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad invalida' USING ERRCODE = '22023'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);
  PERFORM public._check_codigo_no_existe_en_productos(v_codigo);

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id;

  IF v_arreglo_fecha IS NULL THEN
    RAISE EXCEPTION 'arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002';
  END IF;

  v_stock_id := public._crear_producto_y_stock(
    p_taller_id := p_taller_id,
    p_codigo := v_codigo,
    p_nombre := v_nombre,
    p_precio_compra := p_precio_compra,
    p_precio_venta := p_precio_venta
  );

  PERFORM public.rpc_crear_operacion_con_stock(
    p_tipo := 'COMPRA'::public.tipo_operacion,
    p_taller_id := p_taller_id,
    p_lineas := jsonb_build_array(jsonb_build_object(
      'stock_id', v_stock_id,
      'cantidad', p_cantidad,
      'monto_unitario', p_precio_compra
    )),
    p_arreglo_id := NULL::uuid,
    p_fecha := v_arreglo_fecha,
    p_cuenta_id := p_cuenta_id,
    p_idempotency_key := p_idempotency_key
  );

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := v_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_precio_venta,
    p_categoria_arreglo_id := p_categoria_arreglo_id,
    p_empleado_id := p_empleado_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, integer, uuid, uuid, uuid, uuid) TO authenticated, service_role, postgres;

-- 3.9 rpc_crear_stock y rpc_ajustar_stock
CREATE OR REPLACE FUNCTION public.rpc_crear_stock (
  p_taller_id         uuid,
  p_producto_id       uuid,
  p_cantidad_inicial  integer                  DEFAULT 0,
  p_stock_minimo      integer                  DEFAULT 0,
  p_stock_maximo      integer                  DEFAULT 0,
  p_idempotency_key   uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id   uuid := public.current_tenant_id();
  v_stock_id    uuid;
  v_op_id       uuid;
  v_linea_id    uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_producto_id IS NULL THEN RAISE EXCEPTION 'producto_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad_inicial < 0 THEN RAISE EXCEPTION 'cantidad_inicial no puede ser negativa' USING ERRCODE = '22023'; END IF;

  SELECT id INTO v_stock_id
  FROM public.stocks
  WHERE tenant_id = v_tenant_id AND taller_id = p_taller_id AND producto_id = p_producto_id;

  IF v_stock_id IS NULL THEN
    INSERT INTO public.stocks (
      tenant_id, taller_id, producto_id, cantidad, stock_minimo, stock_maximo
    ) VALUES (
      v_tenant_id, p_taller_id, p_producto_id, 0, COALESCE(p_stock_minimo, 0), COALESCE(p_stock_maximo, 0)
    ) RETURNING id INTO v_stock_id;
  END IF;

  IF p_cantidad_inicial > 0 THEN
    INSERT INTO public.operaciones (
      tenant_id, taller_id, tipo, fecha, monto_total
    ) VALUES (
      v_tenant_id, p_taller_id, 'AJUSTE', now(), 0
    ) RETURNING id INTO v_op_id;

    INSERT INTO public.operaciones_ajuste (operacion_id, tenant_id, motivo, descripcion)
    VALUES (v_op_id, v_tenant_id, 'INICIAL', 'Stock inicial');

    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, sentido
    ) VALUES (
      v_op_id, v_stock_id, p_cantidad_inicial, 0, 1
    ) RETURNING id INTO v_linea_id;

    INSERT INTO public.operaciones_movimiento_stock (
      tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo, idempotency_key
    ) VALUES (
      v_tenant_id, v_op_id, v_linea_id, v_stock_id, p_cantidad_inicial, now(), 'Stock inicial', p_idempotency_key
    );
  END IF;

  RETURN v_stock_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_stock(uuid, uuid, integer, integer, integer, uuid) TO authenticated, service_role, postgres;

CREATE OR REPLACE FUNCTION public.rpc_ajustar_stock (
  p_stock_id          uuid,
  p_cantidad_nueva    integer,
  p_motivo            text DEFAULT NULL,
  p_idempotency_key   uuid DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_stock     record;
  v_diff      integer;
  v_sentido   smallint;
  v_op_id     uuid;
  v_linea_id  uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_cantidad_nueva < 0 THEN RAISE EXCEPTION 'cantidad_nueva no puede ser negativa' USING ERRCODE = '22023'; END IF;

  SELECT s.id, s.tenant_id, s.taller_id, s.cantidad
  INTO v_stock
  FROM public.stocks s
  WHERE s.id = p_stock_id AND s.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock no encontrado: %', p_stock_id USING ERRCODE = 'P0002';
  END IF;

  v_diff := p_cantidad_nueva - v_stock.cantidad;

  IF v_diff = 0 THEN
    RETURN jsonb_build_object('ok', true, 'stock_id', p_stock_id, 'cantidad', v_stock.cantidad);
  END IF;

  v_sentido := CASE WHEN v_diff > 0 THEN 1::smallint ELSE -1::smallint END;

  INSERT INTO public.operaciones (
    tenant_id, taller_id, tipo, fecha, monto_total
  ) VALUES (
    v_tenant_id, v_stock.taller_id, 'AJUSTE', now(), 0
  ) RETURNING id INTO v_op_id;

  INSERT INTO public.operaciones_ajuste (operacion_id, tenant_id, motivo, descripcion)
  VALUES (v_op_id, v_tenant_id, 'MANUAL', COALESCE(p_motivo, 'Ajuste manual de stock'));

  INSERT INTO public.operaciones_lineas (
    operacion_id, stock_id, cantidad, monto_unitario, sentido
  ) VALUES (
    v_op_id, p_stock_id, abs(v_diff), 0, v_sentido
  ) RETURNING id INTO v_linea_id;

  INSERT INTO public.operaciones_movimiento_stock (
    tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo, idempotency_key
  ) VALUES (
    v_tenant_id, v_op_id, v_linea_id, p_stock_id, v_diff, now(), COALESCE(p_motivo, 'Ajuste manual de stock'), p_idempotency_key
  );

  SELECT s.cantidad INTO v_stock.cantidad FROM public.stocks s WHERE s.id = p_stock_id;

  RETURN jsonb_build_object('ok', true, 'stock_id', p_stock_id, 'cantidad', v_stock.cantidad);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_ajustar_stock(uuid, integer, text, uuid) TO authenticated, service_role, postgres;

-- 3.10 eliminar_tenant: borra OMS antes que las líneas
CREATE OR REPLACE FUNCTION public.eliminar_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'El tenant_id es obligatorio' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.tenants AS t WHERE t.id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el tenant %', p_tenant_id USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.empleado_salarios WHERE tenant_id = p_tenant_id;
  DELETE FROM public.detalle_form_custom WHERE tenant_id = p_tenant_id;
  DELETE FROM public.detalle_arreglo WHERE tenant_id = p_tenant_id;

  -- Borrar OMS antes que las líneas
  DELETE FROM public.operaciones_movimiento_stock WHERE tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_lineas AS ol
  USING public.operaciones AS o
  WHERE ol.operacion_id = o.id AND o.tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_asignacion_arreglo AS oaa
  USING public.operaciones AS o
  WHERE oaa.operacion_id = o.id AND o.tenant_id = p_tenant_id;

  DELETE FROM public.turnos WHERE tenant_id = p_tenant_id;
  DELETE FROM public.formularios WHERE tenant_id = p_tenant_id;
  DELETE FROM public.arreglos WHERE tenant_id = p_tenant_id;
  DELETE FROM public.empleados WHERE tenant_id = p_tenant_id;
  DELETE FROM public.vehiculos WHERE tenant_id = p_tenant_id;
  DELETE FROM public.clientes WHERE tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_movimiento_cuenta WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_gasto WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_ingreso WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_transferencia WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_apertura_cuenta WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_ajuste WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_venta WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_compra WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_cobro_arreglo WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones WHERE tenant_id = p_tenant_id;

  DELETE FROM public.cuentas_financieras WHERE tenant_id = p_tenant_id;
  DELETE FROM public.categorias_arreglo WHERE tenant_id = p_tenant_id;
  DELETE FROM public.talleres WHERE tenant_id = p_tenant_id;
  DELETE FROM public.user_roles WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenants WHERE id = p_tenant_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Backfill de Stock (Decisión 15)
-- -----------------------------------------------------------------------------

ALTER TABLE public.operaciones_movimiento_stock DISABLE TRIGGER USER;
ALTER TABLE public.movimientos_stock DISABLE TRIGGER USER;
ALTER TABLE public.stocks DISABLE TRIGGER USER;
ALTER TABLE public.operaciones_lineas DISABLE TRIGGER USER;
ALTER TABLE public.operaciones DISABLE TRIGGER USER;

DO $$
DECLARE
  v_rec record;
  v_oms_id uuid;
  v_last_saldo int;
BEGIN
  -- Desactivar temporalmente triggers de inmutabilidad del kardex durante el backfill
  ALTER TABLE public.movimientos_stock DISABLE TRIGGER movimientos_stock_bloquear_mutacion;

  -- 4.1 Completar operaciones_ajuste para operaciones históricas de tipo AJUSTE
  INSERT INTO public.operaciones_ajuste (operacion_id, tenant_id, motivo, descripcion)
  SELECT
    o.id,
    o.tenant_id,
    CASE
      WHEN EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones d WHERE d.operacion_ajuste_id = o.id) THEN 'DEVOLUCION_NC'
      ELSE 'MANUAL'
    END,
    'Migración: ajuste histórico'
  FROM public.operaciones o
  LEFT JOIN public.operaciones_ajuste oa ON oa.operacion_id = o.id
  WHERE o.tipo = 'AJUSTE' AND oa.operacion_id IS NULL;

  -- 4.2 Crear OMS para líneas existentes cumplidas
  FOR v_rec IN
    SELECT l.id AS linea_id, l.operacion_id, l.stock_id, l.sentido, l.cantidad_cumplida,
           o.tenant_id, o.fecha, o.tipo
    FROM public.operaciones_lineas l
    JOIN public.operaciones o ON o.id = l.operacion_id
    WHERE l.cantidad_cumplida > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.operaciones_movimiento_stock oms WHERE oms.operacion_linea_id = l.id
      )
  LOOP
    v_oms_id := gen_random_uuid();
    INSERT INTO public.operaciones_movimiento_stock (
      id, tenant_id, operacion_id, operacion_linea_id, stock_id,
      cantidad, fecha, motivo
    ) VALUES (
      v_oms_id, v_rec.tenant_id, v_rec.operacion_id, v_rec.linea_id, v_rec.stock_id,
      v_rec.sentido * v_rec.cantidad_cumplida,
      COALESCE(v_rec.fecha, now()),
      'Migración: estado previo'
    );

    -- Vincular filas correspondientes del kardex
    UPDATE public.movimientos_stock m
    SET oms_id = v_oms_id
    WHERE m.operacion_id = v_rec.operacion_id
      AND m.stock_id = v_rec.stock_id
      AND m.oms_id IS NULL;
  END LOOP;

  -- 4.3 Conciliación de kardex si stocks.cantidad difiere de saldo_posterior
  FOR v_rec IN
    SELECT s.id AS stock_id, s.tenant_id, s.taller_id, s.producto_id, s.cantidad
    FROM public.stocks s
  LOOP
    SELECT m.saldo_posterior INTO v_last_saldo
    FROM public.movimientos_stock m
    WHERE m.stock_id = v_rec.stock_id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1;

    IF v_last_saldo IS NOT NULL AND v_last_saldo <> v_rec.cantidad THEN
      RAISE NOTICE 'Conciliando stock %: cantidad actual %, último saldo kardex %', v_rec.stock_id, v_rec.cantidad, v_last_saldo;
      INSERT INTO public.movimientos_stock (
        tenant_id, taller_id, producto_id, stock_id,
        tipo_movimiento, cantidad, saldo_anterior, saldo_posterior,
        fecha, motivo
      ) VALUES (
        v_rec.tenant_id, v_rec.taller_id, v_rec.producto_id, v_rec.stock_id,
        'AJUSTE', v_rec.cantidad - v_last_saldo, v_last_saldo, v_rec.cantidad,
        now(), 'Conciliación de kardex (rediseño de operaciones)'
      );
    END IF;
  END LOOP;

  ALTER TABLE public.movimientos_stock ENABLE TRIGGER movimientos_stock_bloquear_mutacion;

  -- 4.4 Recalcular derivados de todos los stocks y estado_stock de operaciones
  FOR v_rec IN SELECT id FROM public.stocks
  LOOP
    PERFORM public._sync_stock_derivados(v_rec.id);
  END LOOP;

  FOR v_rec IN SELECT id FROM public.operaciones WHERE tipo IN ('COMPRA', 'VENTA')
  LOOP
    PERFORM public._sync_operacion_estado_stock(v_rec.id);
  END LOOP;
END;
$$;

ALTER TABLE public.operaciones_movimiento_stock ENABLE TRIGGER USER;
ALTER TABLE public.movimientos_stock ENABLE TRIGGER USER;
ALTER TABLE public.stocks ENABLE TRIGGER USER;
ALTER TABLE public.operaciones_lineas ENABLE TRIGGER USER;
ALTER TABLE public.operaciones ENABLE TRIGGER USER;

-- -----------------------------------------------------------------------------
-- 5. Nota de Crédito (Task 8.1 & Decisión 9)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_facturacion_finalizar_nc(
  p_tenant_id uuid,
  p_nota_id uuid,
  p_cae text,
  p_cae_vencimiento date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := p_tenant_id;
  v_nota public.facturas_electronicas%ROWTYPE;
  v_original public.facturas_electronicas%ROWTYPE;
  v_linea_id uuid;
  v_source record;
  v_taller_id uuid;
  v_operacion uuid;
  v_item record;
  v_used bigint;
  v_cancelar integer;
  v_ajuste_linea_id uuid;
BEGIN
  IF v_tenant IS NULL OR auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Finalización reservada al servicio de facturación';
  END IF;

  SELECT * INTO v_nota
  FROM public.facturas_electronicas
  WHERE id = p_nota_id AND tenant_id = v_tenant
  FOR UPDATE;

  IF NOT FOUND OR v_nota.documento_tipo <> 'NOTA_CREDITO' THEN
    RAISE EXCEPTION 'Nota de crédito no encontrada';
  END IF;

  IF v_nota.estado = 'AUTORIZADA' THEN
    IF EXISTS (
      SELECT 1 FROM public.facturacion_nc_devoluciones
      WHERE nota_credito_id = p_nota_id AND cantidad > 0 AND operacion_ajuste_id IS NULL
    ) THEN
      RAISE EXCEPTION 'La nota autorizada tiene devoluciones pendientes de aplicar';
    END IF;
    RETURN p_nota_id;
  END IF;

  IF v_nota.estado NOT IN ('ENVIANDO','INCIERTA') OR p_cae IS NULL OR p_cae !~ '^[0-9]{14}$' OR p_cae_vencimiento IS NULL THEN
    RAISE EXCEPTION 'Datos de autorización inválidos';
  END IF;

  SELECT * INTO v_original
  FROM public.facturas_electronicas
  WHERE id = v_nota.documento_asociado_id AND tenant_id = v_tenant
  FOR UPDATE;

  IF NOT FOUND OR v_original.documento_tipo <> 'FACTURA' OR v_original.estado <> 'AUTORIZADA'
     OR v_original.origen_tipo NOT IN ('VENTA','ARREGLO')
     OR v_nota.origen_tipo IS DISTINCT FROM v_original.origen_tipo THEN
    RAISE EXCEPTION 'Factura original no autorizada o con origen inconsistente';
  END IF;

  IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE nota_credito_id=p_nota_id AND operacion_ajuste_id IS NOT NULL) THEN
    RAISE EXCEPTION 'La nota tiene un ajuste de stock previo y requiere reconciliación';
  END IF;

  -- 1. Tratar cada línea acreditada: cancelar pendientes y validar devoluciones físicas
  FOR v_linea_id IN
    SELECT DISTINCT d.operacion_linea_id
    FROM public.facturacion_nc_devoluciones d
    WHERE d.nota_credito_id = p_nota_id
    ORDER BY d.operacion_linea_id
  LOOP
    SELECT sfo.operacion_origen_id, sfo.stock_id, sfo.taller_id, sfo.producto_id,
           ol.cantidad, ol.cantidad_cumplida, ol.cantidad_cancelada
    INTO v_source
    FROM public.facturacion_factura_stock_origenes sfo
    JOIN public.operaciones_lineas ol
      ON ol.id = sfo.operacion_linea_id AND ol.operacion_id = sfo.operacion_origen_id AND ol.stock_id = sfo.stock_id
    WHERE sfo.tenant_id = v_tenant AND sfo.factura_id = v_original.id AND sfo.operacion_linea_id = v_linea_id
    FOR UPDATE OF ol;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La devolución perdió una procedencia física verificable';
    END IF;

    -- Cancelar unidades acreditadas no entregadas
    v_cancelar := LEAST(
      (SELECT COALESCE(SUM(d.cantidad), 0) FROM public.facturacion_nc_devoluciones d WHERE d.nota_credito_id = p_nota_id AND d.operacion_linea_id = v_linea_id),
      GREATEST(0, v_source.cantidad - v_source.cantidad_cumplida - v_source.cantidad_cancelada)
    );

    IF v_cancelar > 0 THEN
      UPDATE public.operaciones_lineas
      SET cantidad_cancelada = cantidad_cancelada + v_cancelar
      WHERE id = v_linea_id;
    END IF;

    -- Validar que la devolución física total no supere lo entregado neto
    SELECT COALESCE(sum(d.cantidad), 0)::bigint INTO v_used
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id AND n.tenant_id = v_tenant
    WHERE d.operacion_linea_id = v_linea_id AND n.estado IN ('ENVIANDO','INCIERTA','AUTORIZADA') AND d.cantidad > 0;

    IF v_used > v_source.cantidad_cumplida THEN
      RAISE EXCEPTION 'La devolución física excede las unidades entregadas de la línea' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- 2. Crear las operaciones AJUSTE DEVOLUCION_NC con sus líneas y OMS
  FOR v_taller_id IN
    SELECT DISTINCT sfo.taller_id
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturacion_factura_stock_origenes sfo
      ON sfo.factura_id = d.factura_original_id AND sfo.operacion_linea_id = d.operacion_linea_id
      AND sfo.stock_id = d.stock_id AND sfo.tenant_id = v_tenant
    WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0
    ORDER BY sfo.taller_id
  LOOP
    INSERT INTO public.operaciones(tenant_id, tipo, taller_id, fecha, monto_total)
    VALUES (v_tenant, 'AJUSTE', v_taller_id, now(), 0)
    RETURNING id INTO v_operacion;

    INSERT INTO public.operaciones_ajuste (operacion_id, tenant_id, motivo, descripcion)
    VALUES (v_operacion, v_tenant, 'DEVOLUCION_NC', 'Devolución de stock por Nota de Crédito #' || COALESCE(v_nota.numero_comprobante::text, p_nota_id::text));

    FOR v_item IN
      SELECT d.stock_id, sum(d.cantidad)::integer AS cantidad
      FROM public.facturacion_nc_devoluciones d
      JOIN public.facturacion_factura_stock_origenes sfo
        ON sfo.factura_id = d.factura_original_id AND sfo.operacion_linea_id = d.operacion_linea_id
        AND sfo.stock_id = d.stock_id AND sfo.taller_id = v_taller_id AND sfo.tenant_id = v_tenant
      WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0
      GROUP BY d.stock_id ORDER BY d.stock_id
    LOOP
      INSERT INTO public.operaciones_lineas(operacion_id, stock_id, cantidad, monto_unitario, sentido)
      VALUES (v_operacion, v_item.stock_id, v_item.cantidad, 0, 1)
      RETURNING id INTO v_ajuste_linea_id;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant, v_operacion, v_ajuste_linea_id, v_item.stock_id,
        v_item.cantidad, now(), 'Devolución por Nota de Crédito'
      );
    END LOOP;

    -- Vincular operacion_ajuste_id DESPUÉS de haber creado líneas y OMS
    UPDATE public.facturacion_nc_devoluciones d
    SET operacion_ajuste_id = v_operacion
    FROM public.facturacion_factura_stock_origenes sfo
    WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0 AND d.operacion_ajuste_id IS NULL
      AND sfo.factura_id = d.factura_original_id AND sfo.operacion_linea_id = d.operacion_linea_id
      AND sfo.stock_id = d.stock_id AND sfo.taller_id = v_taller_id AND sfo.tenant_id = v_tenant;
  END LOOP;

  UPDATE public.facturas_electronicas
  SET estado = 'AUTORIZADA', cae = p_cae, cae_vencimiento = p_cae_vencimiento,
      autorizada_at = now(), error_codigo = NULL, error_mensaje = NULL
  WHERE id = p_nota_id AND tenant_id = v_tenant;

  RETURN p_nota_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid,uuid,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid,uuid,text,date) TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Edición y Borrado de Operaciones (Tasks 9.1 y 9.3)
-- -----------------------------------------------------------------------------

-- 6.1 rpc_actualizar_operacion
CREATE OR REPLACE FUNCTION public.rpc_actualizar_operacion (
  p_operacion_id   uuid,
  p_fecha          timestamp with time zone DEFAULT NULL,
  p_observaciones  text                     DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op        record;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT id, tipo, fecha, observaciones
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF public.facturacion_operacion_autorizada(p_operacion_id) THEN
    RAISE EXCEPTION 'No se puede modificar una venta con comprobante fiscal autorizado';
  END IF;

  UPDATE public.operaciones
  SET fecha = COALESCE(p_fecha, fecha),
      observaciones = CASE WHEN p_observaciones IS NOT NULL THEN p_observaciones ELSE observaciones END
  WHERE id = p_operacion_id;

  -- En los tipos instantáneos actualiza también la fecha de sus OMC
  IF p_fecha IS NOT NULL AND v_op.tipo IN ('TRANSFERENCIA', 'INGRESO', 'APERTURA_CUENTA', 'COBRO_ARREGLO') THEN
    UPDATE public.operaciones_movimiento_cuenta
    SET fecha = p_fecha
    WHERE operacion_id = p_operacion_id;
  END IF;

  RETURN jsonb_build_object(
    'id', p_operacion_id,
    'fecha', COALESCE(p_fecha, v_op.fecha),
    'observaciones', CASE WHEN p_observaciones IS NOT NULL THEN p_observaciones ELSE v_op.observaciones END
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_actualizar_operacion(uuid, timestamp with time zone, text) TO authenticated, service_role, postgres;

DROP FUNCTION IF EXISTS public.rpc_actualizar_operacion_con_stock(uuid, text, numeric, text, text, timestamp with time zone, uuid, text, text, text, jsonb);

-- 6.2 rpc_borrar_operacion_con_stock
CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock (
  p_operacion_id uuid,
  p_unused       uuid DEFAULT NULL::uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op        record;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT id, tipo, taller_id
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF public.facturacion_operacion_autorizada(p_operacion_id) THEN
    RAISE EXCEPTION 'No se puede modificar una venta con comprobante fiscal autorizado';
  END IF;

  -- Al borrar la operación:
  -- - La cascada borra hijas, líneas, OMS y OMC.
  -- - Los triggers de OMS generan reversas en kardex y recalculan stock.
  -- - Los triggers de OMC generan contraasientos en el ledger financiero.
  DELETE FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) TO authenticated, service_role, postgres;
