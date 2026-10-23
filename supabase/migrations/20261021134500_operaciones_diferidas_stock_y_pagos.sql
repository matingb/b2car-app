-- Migración: Operaciones Diferidas (Stock y Pagos Desacoplados)
-- Agrega columnas de estado de stock en public.stocks
-- Agrega cantidad_cumplida en public.operaciones_lineas
-- Agrega estados y acumuladores de pago y stock en public.operaciones
-- Crea public.operaciones_pagos para trazabilidad de pagos sucesivos

-- 1. Estados / Enums
DO $$ BEGIN
  CREATE TYPE public.estado_pago_operacion AS ENUM ('PAGADO', 'PARCIAL', 'PENDIENTE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.estado_stock_operacion AS ENUM ('ENTREGADO', 'PARCIAL', 'PENDIENTE', 'NO_APLICA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Modificaciones en public.stocks
ALTER TABLE public.stocks
  ADD COLUMN IF NOT EXISTS cantidad_reservada integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_pendiente integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.stocks
    ADD CONSTRAINT stocks_reservada_nonneg CHECK (cantidad_reservada >= 0);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.stocks
    ADD CONSTRAINT stocks_pendiente_nonneg CHECK (cantidad_pendiente >= 0);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Columna generada: cantidad_disponible = cantidad (físico en taller) - cantidad_reservada (comprometido)
DO $$ BEGIN
  ALTER TABLE public.stocks
    ADD COLUMN cantidad_disponible integer GENERATED ALWAYS AS (cantidad - cantidad_reservada) STORED;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- 3. Modificaciones en public.operaciones_lineas
ALTER TABLE public.operaciones_lineas
  ADD COLUMN IF NOT EXISTS cantidad_cumplida integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.operaciones_lineas
    ADD CONSTRAINT operaciones_lineas_cumplida_nonneg CHECK (cantidad_cumplida >= 0);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Backfill de líneas históricas con triggers de usuario deshabilitados temporalmente
ALTER TABLE public.operaciones_lineas DISABLE TRIGGER USER;
UPDATE public.operaciones_lineas
SET cantidad_cumplida = cantidad
WHERE cantidad_cumplida = 0;
ALTER TABLE public.operaciones_lineas ENABLE TRIGGER USER;

-- 4. Modificaciones en public.operaciones
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS monto_total numeric(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_pagado numeric(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS esta_pago boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estado_pago public.estado_pago_operacion NOT NULL DEFAULT 'PAGADO',
  ADD COLUMN IF NOT EXISTS estado_stock public.estado_stock_operacion NOT NULL DEFAULT 'ENTREGADO';

-- Trigger para recalcular estado de pago en operaciones
CREATE OR REPLACE FUNCTION public._recalcular_estado_pago_operacion()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  IF COALESCE(NEW.monto_total, 0) <= 0 THEN
    NEW.esta_pago := true;
    NEW.estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSIF COALESCE(NEW.total_pagado, 0) >= NEW.monto_total THEN
    NEW.esta_pago := true;
    NEW.estado_pago := 'PAGADO'::public.estado_pago_operacion;
  ELSIF COALESCE(NEW.total_pagado, 0) > 0 THEN
    NEW.esta_pago := false;
    NEW.estado_pago := 'PARCIAL'::public.estado_pago_operacion;
  ELSE
    NEW.esta_pago := false;
    NEW.estado_pago := 'PENDIENTE'::public.estado_pago_operacion;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operaciones_recalcular_pago ON public.operaciones;
CREATE TRIGGER trg_operaciones_recalcular_pago
  BEFORE INSERT OR UPDATE OF monto_total, total_pagado ON public.operaciones
  FOR EACH ROW
  EXECUTE FUNCTION public._recalcular_estado_pago_operacion();

-- 5. Tabla public.operaciones_pagos
CREATE TABLE IF NOT EXISTS public.operaciones_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid REFERENCES public.tenants(id),
  operacion_id uuid NOT NULL REFERENCES public.operaciones(id) ON DELETE CASCADE,
  operacion_pago_id uuid REFERENCES public.operaciones(id) ON DELETE CASCADE,
  cuenta_financiera_id uuid NOT NULL REFERENCES public.cuentas_financieras(id),
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  fecha timestamptz NOT NULL DEFAULT now(),
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.operaciones_pagos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tenant_access" ON public.operaciones_pagos
    FOR ALL TO authenticated
    USING ((tenant_id = public.current_tenant_id()))
    WITH CHECK ((tenant_id = public.current_tenant_id()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_operaciones_pagos_operacion_id ON public.operaciones_pagos USING btree (operacion_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_pagos_pago_id ON public.operaciones_pagos USING btree (operacion_pago_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_pagos_tenant ON public.operaciones_pagos USING btree (tenant_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.operaciones_pagos TO anon, authenticated, service_role;

-- Trigger para sincronizar operaciones.total_pagado desde operaciones_pagos
CREATE OR REPLACE FUNCTION public._sync_operacion_total_pagado()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_operacion_id uuid;
  v_total numeric;
BEGIN
  v_operacion_id := COALESCE(NEW.operacion_id, OLD.operacion_id);
  SELECT COALESCE(SUM(monto), 0)
  INTO v_total
  FROM public.operaciones_pagos
  WHERE operacion_id = v_operacion_id;

  UPDATE public.operaciones
  SET total_pagado = v_total
  WHERE id = v_operacion_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_operacion_total_pagado ON public.operaciones_pagos;
CREATE TRIGGER trg_sync_operacion_total_pagado
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_pagos
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_operacion_total_pagado();

-- 6. Backfill de operaciones históricas (deshabilitando triggers de usuario temporalmente)
ALTER TABLE public.operaciones DISABLE TRIGGER USER;

-- COMPRA y VENTA
UPDATE public.operaciones o
SET
  monto_total = COALESCE((
    SELECT SUM(l.cantidad * l.monto_unitario)
    FROM public.operaciones_lineas l
    WHERE l.operacion_id = o.id
  ), 0),
  total_pagado = COALESCE((
    SELECT SUM(l.cantidad * l.monto_unitario)
    FROM public.operaciones_lineas l
    WHERE l.operacion_id = o.id
  ), 0),
  esta_pago = true,
  estado_pago = 'PAGADO'::public.estado_pago_operacion,
  estado_stock = 'ENTREGADO'::public.estado_stock_operacion
WHERE o.tipo IN ('COMPRA', 'VENTA');

-- GASTOS / MOVIMIENTO_CUENTA
UPDATE public.operaciones o
SET
  monto_total = COALESCE((
    SELECT abs(omc.importe)
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.operacion_id = o.id
  ), 0),
  total_pagado = COALESCE((
    SELECT abs(omc.importe)
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.operacion_id = o.id
  ), 0),
  esta_pago = true,
  estado_pago = 'PAGADO'::public.estado_pago_operacion,
  estado_stock = 'NO_APLICA'::public.estado_stock_operacion
WHERE o.tipo = 'MOVIMIENTO_CUENTA';

-- Otras operaciones (ASIGNACION_ARREGLO, etc.)
UPDATE public.operaciones o
SET
  estado_stock = 'ENTREGADO'::public.estado_stock_operacion,
  esta_pago = true,
  estado_pago = 'PAGADO'::public.estado_pago_operacion
WHERE o.tipo NOT IN ('COMPRA', 'VENTA', 'MOVIMIENTO_CUENTA');

ALTER TABLE public.operaciones ENABLE TRIGGER USER;

-- Backfill de registros iniciales en operaciones_pagos para compras y ventas existentes con cuenta
INSERT INTO public.operaciones_pagos (
  tenant_id,
  operacion_id,
  operacion_pago_id,
  cuenta_financiera_id,
  monto,
  fecha,
  descripcion,
  created_at
)
SELECT
  o.tenant_id,
  o.id,
  NULL,
  mf.cuenta_financiera_id,
  abs(mf.importe),
  mf.fecha,
  'Pago inicial registrado',
  mf.created_at
FROM public.operaciones o
JOIN public.movimientos_financieros mf ON mf.operacion_id = o.id AND mf.tenant_id = o.tenant_id
WHERE o.tipo IN ('COMPRA', 'VENTA')
  AND NOT EXISTS (
    SELECT 1 FROM public.operaciones_pagos op WHERE op.operacion_id = o.id
  );
