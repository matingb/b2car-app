-- =============================================================================
-- Migración B: Rediseño de Operaciones - Finanzas y Documentos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tablas Hijas Nuevas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.operaciones_ingreso (
  operacion_id uuid PRIMARY KEY REFERENCES public.operaciones(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  cuenta_id    uuid NOT NULL REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  concepto     text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operaciones_ingreso DROP CONSTRAINT IF EXISTS operaciones_ingreso_concepto_check;
ALTER TABLE public.operaciones_ingreso ADD CONSTRAINT operaciones_ingreso_concepto_check CHECK (btrim(concepto) <> '');

ALTER TABLE public.operaciones_ingreso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operaciones_ingreso_tenant_select ON public.operaciones_ingreso;
CREATE POLICY operaciones_ingreso_tenant_select ON public.operaciones_ingreso
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

GRANT SELECT ON TABLE public.operaciones_ingreso TO authenticated;
GRANT ALL ON TABLE public.operaciones_ingreso TO postgres, service_role;

CREATE TABLE IF NOT EXISTS public.operaciones_transferencia (
  operacion_id      uuid PRIMARY KEY REFERENCES public.operaciones(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  cuenta_origen_id  uuid NOT NULL REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  cuenta_destino_id uuid NOT NULL REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transferencias_cuentas_distintas CHECK (cuenta_origen_id <> cuenta_destino_id)
);

ALTER TABLE public.operaciones_transferencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operaciones_transferencia_tenant_select ON public.operaciones_transferencia;
CREATE POLICY operaciones_transferencia_tenant_select ON public.operaciones_transferencia
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

GRANT SELECT ON TABLE public.operaciones_transferencia TO authenticated;
GRANT ALL ON TABLE public.operaciones_transferencia TO postgres, service_role;

CREATE TABLE IF NOT EXISTS public.operaciones_apertura_cuenta (
  operacion_id uuid PRIMARY KEY REFERENCES public.operaciones(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  cuenta_id    uuid NOT NULL REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operaciones_apertura_cuenta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operaciones_apertura_cuenta_tenant_select ON public.operaciones_apertura_cuenta;
CREATE POLICY operaciones_apertura_cuenta_tenant_select ON public.operaciones_apertura_cuenta
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

GRANT SELECT ON TABLE public.operaciones_apertura_cuenta TO authenticated;
GRANT ALL ON TABLE public.operaciones_apertura_cuenta TO postgres, service_role;

CREATE TABLE IF NOT EXISTS public.operaciones_ajuste (
  operacion_id uuid PRIMARY KEY REFERENCES public.operaciones(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  motivo       text NOT NULL CHECK (motivo IN ('INICIAL', 'MANUAL', 'DEVOLUCION_NC')),
  descripcion  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operaciones_ajuste ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operaciones_ajuste_tenant_select ON public.operaciones_ajuste;
CREATE POLICY operaciones_ajuste_tenant_select ON public.operaciones_ajuste
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

GRANT SELECT ON TABLE public.operaciones_ajuste TO authenticated;
GRANT ALL ON TABLE public.operaciones_ajuste TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- 2. Ajustes en Hijas Existentes y Operaciones
-- -----------------------------------------------------------------------------

ALTER TABLE public.operaciones_venta ALTER COLUMN cliente_id DROP NOT NULL;
ALTER TABLE public.operaciones_compra ALTER COLUMN proveedor_id DROP NOT NULL;

INSERT INTO public.operaciones_venta (operacion_id, tenant_id, cliente_id, created_at)
SELECT o.id, o.tenant_id, NULL, o.created_at
FROM public.operaciones o
WHERE o.tipo = 'VENTA'::public.tipo_operacion
  AND NOT EXISTS (SELECT 1 FROM public.operaciones_venta ov WHERE ov.operacion_id = o.id);

INSERT INTO public.operaciones_compra (operacion_id, tenant_id, proveedor_id, created_at)
SELECT o.id, o.tenant_id, NULL, o.created_at
FROM public.operaciones o
WHERE o.tipo = 'COMPRA'::public.tipo_operacion
  AND NOT EXISTS (SELECT 1 FROM public.operaciones_compra oc WHERE oc.operacion_id = o.id);

ALTER TABLE public.operaciones_asignacion_arreglo ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT;
ALTER TABLE public.operaciones_asignacion_arreglo ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.operaciones_asignacion_arreglo DISABLE TRIGGER USER;

UPDATE public.operaciones_asignacion_arreglo oaa
SET tenant_id = o.tenant_id,
    created_at = COALESCE(oaa.created_at, o.created_at)
FROM public.operaciones o
WHERE o.id = oaa.operacion_id AND oaa.tenant_id IS NULL;

ALTER TABLE public.operaciones_asignacion_arreglo ENABLE TRIGGER USER;

ALTER TABLE public.operaciones_asignacion_arreglo ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.operaciones_asignacion_arreglo ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.operaciones_asignacion_arreglo ALTER COLUMN created_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public._trg_operaciones_asignacion_arreglo_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := (SELECT tenant_id FROM public.operaciones WHERE id = NEW.operacion_id);
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := public.current_tenant_id();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operaciones_asignacion_arreglo_tenant ON public.operaciones_asignacion_arreglo;
CREATE TRIGGER trg_operaciones_asignacion_arreglo_tenant
BEFORE INSERT ON public.operaciones_asignacion_arreglo
FOR EACH ROW EXECUTE FUNCTION public._trg_operaciones_asignacion_arreglo_tenant();

-- CHECK de categorías de gasto en operaciones_gasto
ALTER TABLE public.operaciones_gasto DROP CONSTRAINT IF EXISTS operaciones_gasto_categoria_check;
ALTER TABLE public.operaciones_gasto ADD CONSTRAINT operaciones_gasto_categoria_check CHECK (
  categoria_gasto = ANY (ARRAY[
    'ALQUILER'::text, 'SERVICIOS'::text, 'SUELDOS_HONORARIOS'::text, 'IMPUESTOS'::text,
    'INSUMOS_REPUESTOS'::text, 'HERRAMIENTAS_EQUIPAMIENTO'::text, 'MANTENIMIENTO'::text,
    'SEGUROS'::text, 'TRANSPORTE_COMBUSTIBLE'::text, 'MARKETING_PUBLICIDAD'::text,
    'COMISIONES_GASTOS_BANCARIOS'::text, 'OTROS'::text
  ])
);

-- Taller obligatorio sólo para tipos que mueven mercadería
ALTER TABLE public.operaciones DROP CONSTRAINT IF EXISTS operaciones_taller_requerido;
ALTER TABLE public.operaciones ADD CONSTRAINT operaciones_taller_requerido CHECK (
  tipo NOT IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'ASIGNACION_ARREGLO'::public.tipo_operacion, 'AJUSTE'::public.tipo_operacion)
  OR taller_id IS NOT NULL
);

-- -----------------------------------------------------------------------------
-- 3. Evolución del Ledger Financiero y OMC (Estructura previa al backfill)
-- -----------------------------------------------------------------------------

-- En movimientos_financieros: omc_id y reversion_de_id; remover FK operacion_id
ALTER TABLE public.movimientos_financieros ADD COLUMN IF NOT EXISTS omc_id uuid;
ALTER TABLE public.movimientos_financieros ADD COLUMN IF NOT EXISTS reversion_de_id uuid REFERENCES public.movimientos_financieros(id) ON DELETE SET NULL;
ALTER TABLE public.movimientos_financieros DROP CONSTRAINT IF EXISTS movimientos_financieros_operacion_id_fkey;
CREATE INDEX IF NOT EXISTS idx_mf_omc_id ON public.movimientos_financieros(omc_id);

-- En operaciones_movimiento_cuenta: PK id propia y fecha
ALTER TABLE public.operaciones_movimiento_cuenta ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.operaciones_movimiento_cuenta ADD COLUMN IF NOT EXISTS fecha timestamptz;

-- Apagar triggers antes de actualizar fecha para que el viejo _omc_after_update no duplique asientos en el ledger
ALTER TABLE public.operaciones_movimiento_cuenta DISABLE TRIGGER USER;

UPDATE public.operaciones_movimiento_cuenta omc
SET fecha = COALESCE(o.fecha, omc.created_at, now())
FROM public.operaciones o
WHERE o.id = omc.operacion_id AND omc.fecha IS NULL;

UPDATE public.operaciones_movimiento_cuenta
SET fecha = COALESCE(created_at, now())
WHERE fecha IS NULL;

ALTER TABLE public.operaciones_movimiento_cuenta ENABLE TRIGGER USER;

ALTER TABLE public.operaciones_movimiento_cuenta ALTER COLUMN fecha SET NOT NULL;

-- Cambiar PK de OMC de operacion_id a id
ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS operaciones_movimiento_cuenta_pkey CASCADE;
ALTER TABLE public.operaciones_movimiento_cuenta ADD CONSTRAINT operaciones_movimiento_cuenta_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS idx_omc_operacion_id ON public.operaciones_movimiento_cuenta(operacion_id);

ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS operaciones_movimiento_cuenta_operacion_id_fkey;
ALTER TABLE public.operaciones_movimiento_cuenta ADD CONSTRAINT operaciones_movimiento_cuenta_operacion_id_fkey
  FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

-- Retirar constraints heredados de OMC antes del backfill (para permitir partir transferencias e insertar pagos sin subtipo)
ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS omc_categoria_gasto_check;
ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS omc_cuenta_xor;
ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS omc_ingreso_descripcion_check;
ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS omc_subtipo_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'operaciones_movimiento_cuenta' AND column_name = 'subtipo'
  ) THEN
    ALTER TABLE public.operaciones_movimiento_cuenta ALTER COLUMN subtipo DROP NOT NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Backfill de Finanzas
-- -----------------------------------------------------------------------------

-- Deshabilitar triggers de mutación e inserción de usuario durante el backfill
ALTER TABLE public.movimientos_financieros DISABLE TRIGGER USER;
ALTER TABLE public.operaciones_movimiento_cuenta DISABLE TRIGGER USER;
ALTER TABLE public.operaciones DISABLE TRIGGER USER;

-- 4.1. Vincular asientos existentes con su OMC (1:1 histórica)
UPDATE public.movimientos_financieros mf
SET omc_id = omc.id
FROM public.operaciones_movimiento_cuenta omc
WHERE mf.operacion_id = omc.operacion_id AND mf.omc_id IS NULL;

-- 4.2. Migrar operaciones MOVIMIENTO_CUENTA a su tipo real con su tabla hija
DO $$
DECLARE
  r record;
  v_new_omc_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'operaciones_movimiento_cuenta' AND column_name = 'subtipo'
  ) THEN
    -- A) GASTO
    UPDATE public.operaciones o
    SET tipo = 'GASTO'::public.tipo_operacion,
        monto_total = ABS(omc.importe),
        total_pagado = ABS(omc.importe),
        esta_pago = true,
        estado_pago = 'PAGADO'::public.estado_pago_operacion
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.operacion_id = o.id
      AND o.tipo = 'MOVIMIENTO_CUENTA'::public.tipo_operacion
      AND omc.subtipo = 'GASTO';

    INSERT INTO public.operaciones_gasto (operacion_id, tenant_id, categoria_gasto, descripcion)
    SELECT o.id, o.tenant_id, COALESCE(omc.categoria_gasto, 'OTROS'), omc.descripcion
    FROM public.operaciones o
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = o.id
    WHERE o.tipo = 'GASTO'::public.tipo_operacion
      AND NOT EXISTS (SELECT 1 FROM public.operaciones_gasto og WHERE og.operacion_id = o.id);

    -- B) COBRO_ARREGLO (MOVIMIENTO_CUENTA con subtipo INGRESO vinculado a operaciones_cobro_arreglo)
    UPDATE public.operaciones o
    SET tipo = 'COBRO_ARREGLO'::public.tipo_operacion,
        monto_total = ABS(omc.importe)
    FROM public.operaciones_movimiento_cuenta omc,
         public.operaciones_cobro_arreglo oca
    WHERE oca.operacion_id = o.id
      AND omc.operacion_id = o.id
      AND o.tipo = 'MOVIMIENTO_CUENTA'::public.tipo_operacion
      AND omc.subtipo = 'INGRESO';

    -- C) INGRESO (MOVIMIENTO_CUENTA con subtipo INGRESO no vinculado a cobro de arreglo)
    UPDATE public.operaciones o
    SET tipo = 'INGRESO'::public.tipo_operacion,
        monto_total = ABS(omc.importe)
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.operacion_id = o.id
      AND o.tipo = 'MOVIMIENTO_CUENTA'::public.tipo_operacion
      AND omc.subtipo = 'INGRESO'
      AND NOT EXISTS (SELECT 1 FROM public.operaciones_cobro_arreglo oca WHERE oca.operacion_id = o.id);

    INSERT INTO public.operaciones_ingreso (operacion_id, tenant_id, cuenta_id, concepto)
    SELECT o.id, o.tenant_id, omc.cuenta_id, COALESCE(NULLIF(btrim(omc.descripcion), ''), 'Ingreso')
    FROM public.operaciones o
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = o.id
    WHERE o.tipo = 'INGRESO'::public.tipo_operacion
      AND NOT EXISTS (SELECT 1 FROM public.operaciones_ingreso oi WHERE oi.operacion_id = o.id);

    -- D) APERTURA_CUENTA
    UPDATE public.operaciones o
    SET tipo = 'APERTURA_CUENTA'::public.tipo_operacion,
        monto_total = ABS(omc.importe)
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.operacion_id = o.id
      AND o.tipo = 'MOVIMIENTO_CUENTA'::public.tipo_operacion
      AND omc.subtipo = 'APERTURA_CUENTA';

    INSERT INTO public.operaciones_apertura_cuenta (operacion_id, tenant_id, cuenta_id)
    SELECT o.id, o.tenant_id, omc.cuenta_id
    FROM public.operaciones o
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = o.id
    WHERE o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion
      AND NOT EXISTS (SELECT 1 FROM public.operaciones_apertura_cuenta oac WHERE oac.operacion_id = o.id);

    -- E) TRANSFERENCIA
    UPDATE public.operaciones o
    SET tipo = 'TRANSFERENCIA'::public.tipo_operacion,
        monto_total = ABS(omc.importe)
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.operacion_id = o.id
      AND o.tipo = 'MOVIMIENTO_CUENTA'::public.tipo_operacion
      AND omc.subtipo = 'TRANSFERENCIA';

    INSERT INTO public.operaciones_transferencia (operacion_id, tenant_id, cuenta_origen_id, cuenta_destino_id)
    SELECT o.id, o.tenant_id, omc.cuenta_origen_id, omc.cuenta_destino_id
    FROM public.operaciones o
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = o.id
    WHERE o.tipo = 'TRANSFERENCIA'::public.tipo_operacion
      AND NOT EXISTS (SELECT 1 FROM public.operaciones_transferencia ot WHERE ot.operacion_id = o.id);

    -- Partir las transferencias históricas en 2 filas de OMC (-origen, +destino)
    FOR r IN
      SELECT omc.id AS omc_origen_id, omc.operacion_id, omc.tenant_id, omc.cuenta_origen_id,
             omc.cuenta_destino_id, ABS(omc.importe) AS monto, omc.fecha, omc.descripcion,
             omc.created_by, omc.created_at
      FROM public.operaciones_movimiento_cuenta omc
      JOIN public.operaciones o ON o.id = omc.operacion_id
      WHERE o.tipo = 'TRANSFERENCIA'::public.tipo_operacion
        AND omc.cuenta_destino_id IS NOT NULL
    LOOP
      -- 1. Actualizar la OMC original para que represente el débito de origen
      UPDATE public.operaciones_movimiento_cuenta
      SET cuenta_id = r.cuenta_origen_id,
          importe = -r.monto
      WHERE id = r.omc_origen_id;

      -- Vincular el asiento del ledger de origen
      UPDATE public.movimientos_financieros
      SET omc_id = r.omc_origen_id
      WHERE operacion_id = r.operacion_id AND cuenta_financiera_id = r.cuenta_origen_id;

      -- 2. Crear nueva OMC para el crédito de destino
      v_new_omc_id := gen_random_uuid();
      INSERT INTO public.operaciones_movimiento_cuenta (
        id, operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, created_by, created_at
      )
      VALUES (
        v_new_omc_id, r.operacion_id, r.tenant_id, r.cuenta_destino_id, r.monto, r.fecha,
        r.descripcion, r.created_by, r.created_at
      );

      -- Vincular el asiento del ledger de destino
      UPDATE public.movimientos_financieros
      SET omc_id = v_new_omc_id
      WHERE operacion_id = r.operacion_id AND cuenta_financiera_id = r.cuenta_destino_id;
    END LOOP;
  END IF;
END $$;

-- 4.3. Migrar operaciones_pagos a OMC
DO $$
DECLARE
  v_unmapped_asientos bigint;
  v_diff_count bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'operaciones_pagos') THEN
    -- Insertar en OMC cada pago que no tenga ya una OMC idéntica en ese documento
    INSERT INTO public.operaciones_movimiento_cuenta (
      id, operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, idempotency_key, created_by, created_at
    )
    SELECT
      op.id,
      op.operacion_id,
      op.tenant_id,
      op.cuenta_financiera_id,
      CASE WHEN o.tipo = 'VENTA'::public.tipo_operacion THEN op.monto ELSE -op.monto END,
      op.fecha,
      op.descripcion,
      op.idempotency_key,
      op.created_by,
      op.created_at
    FROM public.operaciones_pagos op
    JOIN public.operaciones o ON o.id = op.operacion_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.operaciones_movimiento_cuenta omc
      WHERE omc.operacion_id = op.operacion_id
        AND omc.cuenta_id = op.cuenta_financiera_id
        AND ABS(omc.importe) = op.monto
    );

    -- Emparejar asientos de movimientos_financieros sin omc_id usando row_number()
    WITH unmapped_mf AS (
      SELECT id, operacion_id, cuenta_financiera_id, ABS(importe) AS monto,
             ROW_NUMBER() OVER (PARTITION BY operacion_id, cuenta_financiera_id, ABS(importe) ORDER BY fecha, id) AS rn
      FROM public.movimientos_financieros
      WHERE omc_id IS NULL AND operacion_id IS NOT NULL
    ),
    omc_unmapped AS (
      SELECT id, operacion_id, cuenta_id, ABS(importe) AS monto,
             ROW_NUMBER() OVER (PARTITION BY operacion_id, cuenta_id, ABS(importe) ORDER BY fecha, id) AS rn
      FROM public.operaciones_movimiento_cuenta
    )
    UPDATE public.movimientos_financieros mf
    SET omc_id = ou.id
    FROM unmapped_mf um
    JOIN omc_unmapped ou ON ou.operacion_id = um.operacion_id
                        AND ou.cuenta_id = um.cuenta_financiera_id
                        AND ou.monto = um.monto
                        AND ou.rn = um.rn
    WHERE mf.id = um.id;

    -- Avisar sobre asientos que queden sin emparejar (pagos anulados)
    SELECT count(*) INTO v_unmapped_asientos
    FROM public.movimientos_financieros
    WHERE omc_id IS NULL;

    IF v_unmapped_asientos > 0 THEN
      RAISE NOTICE 'Asientos financieros históricos sin omc_id (pagos anulados o asientos directos): %', v_unmapped_asientos;
    END IF;

    -- Recalcular y validar total_pagado
    WITH recalculo AS (
      SELECT o.id, o.total_pagado AS viejo_total, COALESCE(SUM(ABS(omc.importe)), 0) AS nuevo_total
      FROM public.operaciones o
      LEFT JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = o.id
      WHERE o.tipo IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion)
      GROUP BY o.id, o.total_pagado
    )
    SELECT count(*) INTO v_diff_count
    FROM recalculo
    WHERE viejo_total IS DISTINCT FROM nuevo_total;

    IF v_diff_count > 0 THEN
      RAISE EXCEPTION 'El recálculo de total_pagado difiere en % operaciones. Abortando migración.', v_diff_count
        USING ERRCODE = '22023';
    END IF;

    -- Actualizar total_pagado por seguridad
    UPDATE public.operaciones o
    SET total_pagado = COALESCE(sub.tot, 0)
    FROM (
      SELECT operacion_id, SUM(ABS(importe)) AS tot
      FROM public.operaciones_movimiento_cuenta
      GROUP BY operacion_id
    ) sub
    WHERE sub.operacion_id = o.id
      AND o.tipo IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion);

  END IF;
END $$;

-- Rehabilitar triggers de usuario
ALTER TABLE public.movimientos_financieros ENABLE TRIGGER USER;
ALTER TABLE public.operaciones_movimiento_cuenta ENABLE TRIGGER USER;
ALTER TABLE public.operaciones ENABLE TRIGGER USER;

-- -----------------------------------------------------------------------------
-- 5. Eliminación de operaciones_pagos y Columnas Viejas de OMC
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'operaciones_pagos') THEN
    DROP TRIGGER IF EXISTS trg_sync_operacion_total_pagado ON public.operaciones_pagos;
    DROP TABLE public.operaciones_pagos CASCADE;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public._sync_operacion_total_pagado CASCADE;

ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS omc_categoria_gasto_check;
ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS omc_cuenta_xor;
ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS omc_ingreso_descripcion_check;
ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS omc_subtipo_check;

ALTER TABLE public.operaciones_movimiento_cuenta DROP COLUMN IF EXISTS subtipo;
ALTER TABLE public.operaciones_movimiento_cuenta DROP COLUMN IF EXISTS cuenta_origen_id;
ALTER TABLE public.operaciones_movimiento_cuenta DROP COLUMN IF EXISTS cuenta_destino_id;
ALTER TABLE public.operaciones_movimiento_cuenta DROP COLUMN IF EXISTS categoria_gasto;

ALTER TABLE public.operaciones_movimiento_cuenta ALTER COLUMN cuenta_id SET NOT NULL;
ALTER TABLE public.operaciones_movimiento_cuenta DROP CONSTRAINT IF EXISTS omc_importe_check;
ALTER TABLE public.operaciones_movimiento_cuenta ADD CONSTRAINT omc_importe_check CHECK (importe <> 0);

DROP FUNCTION IF EXISTS public._finanzas_insertar_movimiento CASCADE;
DROP FUNCTION IF EXISTS public._finanzas_reversar_movimiento CASCADE;

-- -----------------------------------------------------------------------------
-- 6. Triggers de OMC y Ledger Financiero
-- -----------------------------------------------------------------------------

-- 6.1. Nueva firma de _ledger_insertar
DROP FUNCTION IF EXISTS public._ledger_insertar(uuid, uuid, uuid, numeric, timestamptz);
CREATE OR REPLACE FUNCTION public._ledger_insertar(
  p_operacion_id    uuid,
  p_tenant_id       uuid,
  p_cuenta_id       uuid,
  p_importe         numeric,
  p_fecha           timestamptz,
  p_omc_id          uuid DEFAULT NULL,
  p_reversion_de_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.movimientos_financieros (
    tenant_id, cuenta_financiera_id, importe, fecha, operacion_id, omc_id, reversion_de_id
  )
  VALUES (
    p_tenant_id, p_cuenta_id, p_importe, COALESCE(p_fecha, now()), p_operacion_id, p_omc_id, p_reversion_de_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._ledger_insertar(uuid, uuid, uuid, numeric, timestamptz, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ledger_insertar(uuid, uuid, uuid, numeric, timestamptz, uuid, uuid) TO service_role, postgres;

-- 6.2. Trigger _omc_validar: BEFORE INSERT OR UPDATE
CREATE OR REPLACE FUNCTION public._omc_validar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op record;
BEGIN
  SELECT o.tenant_id, o.tipo, o.fecha INTO v_op
  FROM public.operaciones o
  WHERE o.id = NEW.operacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', NEW.operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM v_op.tenant_id THEN
    RAISE EXCEPTION 'Tenant de OMC (%) no coincide con la operación (%)', NEW.tenant_id, v_op.tenant_id USING ERRCODE = '22023';
  END IF;

  NEW.fecha := COALESCE(NEW.fecha, v_op.fecha, now());

  -- Rechazar OMC sobre ASIGNACION_ARREGLO y AJUSTE
  IF v_op.tipo IN ('ASIGNACION_ARREGLO'::public.tipo_operacion, 'AJUSTE'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'Operaciones de tipo % no admiten movimientos de cuenta', v_op.tipo USING ERRCODE = '22023';
  END IF;

  -- Regla de signo según tipo
  IF v_op.tipo IN ('VENTA'::public.tipo_operacion, 'INGRESO'::public.tipo_operacion, 'COBRO_ARREGLO'::public.tipo_operacion) THEN
    IF NEW.importe <= 0 THEN
      RAISE EXCEPTION 'El importe de OMC para % debe ser positivo', v_op.tipo USING ERRCODE = '22023';
    END IF;
  ELSIF v_op.tipo IN ('COMPRA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion) THEN
    IF NEW.importe >= 0 THEN
      RAISE EXCEPTION 'El importe de OMC para % debe ser negativo', v_op.tipo USING ERRCODE = '22023';
    END IF;
  ELSIF v_op.tipo IN ('APERTURA_CUENTA'::public.tipo_operacion, 'TRANSFERENCIA'::public.tipo_operacion) THEN
    IF NEW.importe = 0 THEN
      RAISE EXCEPTION 'El importe de OMC no puede ser cero' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS omc_validar ON public.operaciones_movimiento_cuenta;
CREATE TRIGGER omc_validar
  BEFORE INSERT OR UPDATE ON public.operaciones_movimiento_cuenta
  FOR EACH ROW EXECUTE FUNCTION public._omc_validar();

-- 6.3. Triggers _omc_after_insert/update/delete
CREATE OR REPLACE FUNCTION public._omc_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public._ledger_insertar(
    NEW.operacion_id,
    NEW.tenant_id,
    NEW.cuenta_id,
    NEW.importe,
    NEW.fecha,
    NEW.id,
    NULL
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._omc_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asiento_vigente record;
BEGIN
  IF current_setting('app.finanzas_tenant_cleanup', true) = 'on' THEN
    RETURN NULL;
  END IF;

  -- Busca el asiento vigente de OLD.id (que no haya sido revertido)
  SELECT mf.id, mf.importe, mf.cuenta_financiera_id
  INTO v_asiento_vigente
  FROM public.movimientos_financieros mf
  WHERE mf.omc_id = OLD.id
    AND NOT EXISTS (
      SELECT 1 FROM public.movimientos_financieros rev
      WHERE rev.reversion_de_id = mf.id
    )
  ORDER BY mf.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    PERFORM public._ledger_insertar(
      OLD.operacion_id,
      OLD.tenant_id,
      v_asiento_vigente.cuenta_financiera_id,
      -v_asiento_vigente.importe,
      now(),
      OLD.id,
      v_asiento_vigente.id
    );
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._omc_after_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asiento_vigente record;
BEGIN
  -- Si cambian cuenta_id, importe o fecha
  IF (OLD.cuenta_id IS DISTINCT FROM NEW.cuenta_id)
     OR (OLD.importe IS DISTINCT FROM NEW.importe)
     OR (OLD.fecha IS DISTINCT FROM NEW.fecha) THEN

    -- Contraasiento del vigente
    SELECT mf.id, mf.importe, mf.cuenta_financiera_id
    INTO v_asiento_vigente
    FROM public.movimientos_financieros mf
    WHERE mf.omc_id = OLD.id
      AND NOT EXISTS (
        SELECT 1 FROM public.movimientos_financieros rev
        WHERE rev.reversion_de_id = mf.id
      )
    ORDER BY mf.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      PERFORM public._ledger_insertar(
        OLD.operacion_id,
        OLD.tenant_id,
        v_asiento_vigente.cuenta_financiera_id,
        -v_asiento_vigente.importe,
        now(),
        OLD.id,
        v_asiento_vigente.id
      );
    END IF;

    -- Asiento nuevo
    PERFORM public._ledger_insertar(
      NEW.operacion_id,
      NEW.tenant_id,
      NEW.cuenta_id,
      NEW.importe,
      NEW.fecha,
      NEW.id,
      NULL
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS omc_after_insert ON public.operaciones_movimiento_cuenta;
CREATE TRIGGER omc_after_insert
  AFTER INSERT ON public.operaciones_movimiento_cuenta
  FOR EACH ROW EXECUTE FUNCTION public._omc_after_insert();

DROP TRIGGER IF EXISTS omc_after_delete ON public.operaciones_movimiento_cuenta;
CREATE TRIGGER omc_after_delete
  AFTER DELETE ON public.operaciones_movimiento_cuenta
  FOR EACH ROW EXECUTE FUNCTION public._omc_after_delete();

DROP TRIGGER IF EXISTS omc_after_update ON public.operaciones_movimiento_cuenta;
CREATE TRIGGER omc_after_update
  AFTER UPDATE ON public.operaciones_movimiento_cuenta
  FOR EACH ROW EXECUTE FUNCTION public._omc_after_update();

-- 6.4. Trigger _omc_sync_total_pagado: recalcula total_pagado
CREATE OR REPLACE FUNCTION public._omc_sync_total_pagado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op_id uuid;
  v_tot numeric;
  v_tipo public.tipo_operacion;
  v_actual numeric;
BEGIN
  IF current_setting('app.finanzas_tenant_cleanup', true) = 'on' THEN
    RETURN NULL;
  END IF;

  v_op_id := COALESCE(NEW.operacion_id, OLD.operacion_id);

  SELECT tipo, total_pagado INTO v_tipo, v_actual
  FROM public.operaciones
  WHERE id = v_op_id;

  IF FOUND AND v_tipo IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion) THEN
    SELECT COALESCE(ABS(SUM(importe)), 0) INTO v_tot
    FROM public.operaciones_movimiento_cuenta
    WHERE operacion_id = v_op_id;

    IF v_actual IS DISTINCT FROM v_tot THEN
      UPDATE public.operaciones
      SET total_pagado = v_tot
      WHERE id = v_op_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.operacion_id IS DISTINCT FROM NEW.operacion_id THEN
    SELECT tipo, total_pagado INTO v_tipo, v_actual
    FROM public.operaciones
    WHERE id = OLD.operacion_id;

    IF FOUND AND v_tipo IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion) THEN
      SELECT COALESCE(ABS(SUM(importe)), 0) INTO v_tot
      FROM public.operaciones_movimiento_cuenta
      WHERE operacion_id = OLD.operacion_id;

      IF v_actual IS DISTINCT FROM v_tot THEN
        UPDATE public.operaciones
        SET total_pagado = v_tot
        WHERE id = OLD.operacion_id;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_omc_sync_total_pagado ON public.operaciones_movimiento_cuenta;
CREATE TRIGGER trg_omc_sync_total_pagado
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_movimiento_cuenta
  FOR EACH ROW EXECUTE FUNCTION public._omc_sync_total_pagado();

-- -----------------------------------------------------------------------------
-- 7. Guards de Facturación: Lista blanca de columnas derivadas
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_operacion_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    v_operacion_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_operacion_id := COALESCE(NEW.operacion_id, OLD.operacion_id);
  END IF;

  IF public.facturacion_operacion_autorizada(v_operacion_id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'No se puede eliminar una venta con comprobante fiscal autorizado';
    ELSIF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'No se pueden agregar líneas a una venta con comprobante fiscal autorizado';
    ELSIF TG_OP = 'UPDATE' THEN
      IF TG_TABLE_NAME = 'operaciones' THEN
        IF NEW.tipo IS DISTINCT FROM OLD.tipo
           OR NEW.fecha IS DISTINCT FROM OLD.fecha
           OR NEW.taller_id IS DISTINCT FROM OLD.taller_id
           OR NEW.monto_total IS DISTINCT FROM OLD.monto_total
           OR NEW.observaciones IS DISTINCT FROM OLD.observaciones THEN
          RAISE EXCEPTION 'No se pueden modificar datos fiscales de una venta con comprobante fiscal autorizado';
        END IF;
      ELSIF TG_TABLE_NAME = 'operaciones_lineas' THEN
        IF NEW.stock_id IS DISTINCT FROM OLD.stock_id
           OR NEW.cantidad IS DISTINCT FROM OLD.cantidad
           OR NEW.monto_unitario IS DISTINCT FROM OLD.monto_unitario
           OR NEW.iva_alicuota_id IS DISTINCT FROM OLD.iva_alicuota_id THEN
          RAISE EXCEPTION 'No se pueden modificar líneas de una venta con comprobante fiscal autorizado';
        END IF;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    v_id := COALESCE(NEW.id, OLD.id);
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE operacion_ajuste_id = v_id) THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'No se puede eliminar un ajuste generado por una nota de crédito';
      ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.tipo IS DISTINCT FROM OLD.tipo
           OR NEW.fecha IS DISTINCT FROM OLD.fecha
           OR NEW.taller_id IS DISTINCT FROM OLD.taller_id
           OR NEW.monto_total IS DISTINCT FROM OLD.monto_total
           OR NEW.observaciones IS DISTINCT FROM OLD.observaciones THEN
          RAISE EXCEPTION 'No se puede modificar un ajuste generado por una nota de crédito';
        END IF;
      END IF;
    END IF;
  ELSE
    v_id := COALESCE(NEW.operacion_id, OLD.operacion_id);
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE operacion_ajuste_id = v_id) THEN
      IF TG_OP = 'DELETE' OR TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'No se pueden modificar líneas de un ajuste generado por una nota de crédito';
      ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.stock_id IS DISTINCT FROM OLD.stock_id
           OR NEW.cantidad IS DISTINCT FROM OLD.cantidad
           OR NEW.monto_unitario IS DISTINCT FROM OLD.monto_unitario THEN
          RAISE EXCEPTION 'No se pueden modificar líneas de un ajuste generado por una nota de crédito';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Constraint Trigger Diferido: Coherencia de Operaciones Instantáneas
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._operacion_validar_instantanea()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op_id uuid;
  v_op record;
  v_omc_count integer;
  v_omc_sum numeric;
  v_hija_ingreso record;
  v_hija_trans record;
  v_hija_apertura record;
  v_omc_rec record;
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    IF TG_OP = 'DELETE' THEN
      v_op_id := OLD.id;
    ELSE
      v_op_id := NEW.id;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_op_id := OLD.operacion_id;
    ELSE
      v_op_id := NEW.operacion_id;
    END IF;
  END IF;

  IF v_op_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, tipo, monto_total INTO v_op
  FROM public.operaciones
  WHERE id = v_op_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_op.tipo = 'INGRESO'::public.tipo_operacion THEN
    SELECT * INTO v_hija_ingreso FROM public.operaciones_ingreso WHERE operacion_id = v_op_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Operación INGRESO % debe tener su registro en operaciones_ingreso', v_op_id USING ERRCODE = '22023';
    END IF;
    SELECT count(*), COALESCE(SUM(importe), 0) INTO v_omc_count, v_omc_sum
    FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 1 THEN
      RAISE EXCEPTION 'Operación INGRESO % debe tener exactamente 1 OMC (tiene %)', v_op_id, v_omc_count USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_omc_rec FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id LIMIT 1;
    IF v_omc_rec.cuenta_id IS DISTINCT FROM v_hija_ingreso.cuenta_id OR v_omc_rec.importe IS DISTINCT FROM v_op.monto_total THEN
      RAISE EXCEPTION 'OMC de INGRESO no coincide con la cuenta o el monto de la operación' USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN
    SELECT * INTO v_hija_apertura FROM public.operaciones_apertura_cuenta WHERE operacion_id = v_op_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Operación APERTURA_CUENTA % debe tener su registro en operaciones_apertura_cuenta', v_op_id USING ERRCODE = '22023';
    END IF;
    SELECT count(*), COALESCE(SUM(ABS(importe)), 0) INTO v_omc_count, v_omc_sum
    FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 1 THEN
      RAISE EXCEPTION 'Operación APERTURA_CUENTA % debe tener exactamente 1 OMC (tiene %)', v_op_id, v_omc_count USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_omc_rec FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id LIMIT 1;
    IF v_omc_rec.cuenta_id IS DISTINCT FROM v_hija_apertura.cuenta_id OR ABS(v_omc_rec.importe) IS DISTINCT FROM v_op.monto_total THEN
      RAISE EXCEPTION 'OMC de APERTURA_CUENTA no coincide con la cuenta o el monto de la operación' USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN
    SELECT * INTO v_hija_trans FROM public.operaciones_transferencia WHERE operacion_id = v_op_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Operación TRANSFERENCIA % debe tener su registro en operaciones_transferencia', v_op_id USING ERRCODE = '22023';
    END IF;
    IF v_hija_trans.cuenta_origen_id = v_hija_trans.cuenta_destino_id THEN
      RAISE EXCEPTION 'Las cuentas de origen y destino de TRANSFERENCIA deben ser distintas' USING ERRCODE = '22023';
    END IF;
    SELECT count(*), COALESCE(SUM(importe), 0) INTO v_omc_count, v_omc_sum
    FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 2 OR v_omc_sum <> 0 THEN
      RAISE EXCEPTION 'Operación TRANSFERENCIA % debe tener exactamente 2 OMC que sumen 0 (tiene % con suma %)', v_op_id, v_omc_count, v_omc_sum USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id AND cuenta_id = v_hija_trans.cuenta_origen_id AND importe = -v_op.monto_total)
       OR NOT EXISTS (SELECT 1 FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id AND cuenta_id = v_hija_trans.cuenta_destino_id AND importe = v_op.monto_total) THEN
      RAISE EXCEPTION 'Las OMC de TRANSFERENCIA deben coincidir con cuenta_origen (-monto) y cuenta_destino (+monto)' USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_cobro_arreglo WHERE operacion_id = v_op_id) THEN
      RAISE EXCEPTION 'Operación COBRO_ARREGLO % debe tener su registro en operaciones_cobro_arreglo', v_op_id USING ERRCODE = '22023';
    END IF;
    SELECT count(*), COALESCE(SUM(importe), 0) INTO v_omc_count, v_omc_sum
    FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 1 OR v_omc_sum <> v_op.monto_total THEN
      RAISE EXCEPTION 'Operación COBRO_ARREGLO % debe tener exactamente 1 OMC por el monto total', v_op_id USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_operacion_validar_instantanea ON public.operaciones;
CREATE CONSTRAINT TRIGGER trg_operacion_validar_instantanea
  AFTER INSERT OR UPDATE ON public.operaciones
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_instantanea();

DROP TRIGGER IF EXISTS trg_omc_validar_instantanea ON public.operaciones_movimiento_cuenta;
CREATE CONSTRAINT TRIGGER trg_omc_validar_instantanea
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_movimiento_cuenta
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_instantanea();

DROP TRIGGER IF EXISTS trg_ingreso_validar_instantanea ON public.operaciones_ingreso;
CREATE CONSTRAINT TRIGGER trg_ingreso_validar_instantanea
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_ingreso
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_instantanea();

DROP TRIGGER IF EXISTS trg_transferencia_validar_instantanea ON public.operaciones_transferencia;
CREATE CONSTRAINT TRIGGER trg_transferencia_validar_instantanea
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_transferencia
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_instantanea();

DROP TRIGGER IF EXISTS trg_apertura_validar_instantanea ON public.operaciones_apertura_cuenta;
CREATE CONSTRAINT TRIGGER trg_apertura_validar_instantanea
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_apertura_cuenta
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_instantanea();

DROP TRIGGER IF EXISTS trg_cobro_arreglo_validar_instantanea ON public.operaciones_cobro_arreglo;
CREATE CONSTRAINT TRIGGER trg_cobro_arreglo_validar_instantanea
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_cobro_arreglo
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_instantanea();

-- -----------------------------------------------------------------------------
-- 9. Reescritura de RPCs de Finanzas y Pagos
-- -----------------------------------------------------------------------------

-- 9.1. rpc_registrar_pago_operacion
CREATE OR REPLACE FUNCTION public.rpc_registrar_pago_operacion (
  p_operacion_id       uuid,
  p_cuenta_id          uuid,
  p_monto              numeric,
  p_fecha              timestamp with time zone DEFAULT now(),
  p_descripcion        text                     DEFAULT NULL::text,
  p_idempotency_key    uuid                     DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id          uuid := public.current_tenant_id();
  v_op                 record;
  v_pago_existente     uuid;
  v_saldo_pendiente    numeric;
  v_pago_id            uuid;
  v_importe_signado    numeric;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificar una cuenta financiera' USING ERRCODE = '22023';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a 0' USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

  -- Idempotencia en OMC
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':pago:' || p_idempotency_key::text));

    SELECT omc.id
    INTO v_pago_existente
    FROM public.operaciones_movimiento_cuenta AS omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;

    IF v_pago_existente IS NOT NULL THEN
      SELECT monto_total, total_pagado, esta_pago, estado_pago
      INTO v_op FROM public.operaciones WHERE id = p_operacion_id;

      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'operacion_id', p_operacion_id,
        'pago_id', v_pago_existente,
        'total_pagado', v_op.total_pagado,
        'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
        'esta_pago', v_op.esta_pago,
        'estado_pago', v_op.estado_pago
      );
    END IF;
  END IF;

  SELECT id, tipo, monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_op.tipo NOT IN ('VENTA'::public.tipo_operacion, 'COMPRA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'La operación de tipo % no admite pagos', v_op.tipo USING ERRCODE = '22023';
  END IF;

  v_saldo_pendiente := GREATEST(0, COALESCE(v_op.monto_total, 0) - COALESCE(v_op.total_pagado, 0));
  IF v_saldo_pendiente <= 0 THEN
    RAISE EXCEPTION 'Esta operación ya se encuentra totalmente saldada' USING ERRCODE = '22023';
  END IF;

  IF p_monto > v_saldo_pendiente THEN
    RAISE EXCEPTION 'El monto ingresado ($%) supera el saldo pendiente ($%)', p_monto, v_saldo_pendiente
      USING ERRCODE = '22023';
  END IF;

  v_importe_signado := CASE WHEN v_op.tipo = 'VENTA'::public.tipo_operacion THEN p_monto ELSE -p_monto END;

  -- Insertar OMC (el trigger genera el asiento en el ledger y recalcula total_pagado)
  INSERT INTO public.operaciones_movimiento_cuenta (
    tenant_id,
    operacion_id,
    cuenta_id,
    importe,
    fecha,
    descripcion,
    idempotency_key,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_operacion_id,
    p_cuenta_id,
    v_importe_signado,
    COALESCE(p_fecha, now()),
    COALESCE(
      NULLIF(btrim(p_descripcion), ''),
      CASE
        WHEN v_op.tipo = 'VENTA'::public.tipo_operacion THEN 'Cobro de venta'
        WHEN v_op.tipo = 'COMPRA'::public.tipo_operacion THEN 'Pago de compra'
        ELSE 'Pago de gasto'
      END
    ),
    p_idempotency_key,
    auth.uid()
  )
  RETURNING id INTO v_pago_id;

  -- Leer estado resultante actualizado
  SELECT monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'operacion_id', p_operacion_id,
    'pago_id', v_pago_id,
    'monto_registrado', p_monto,
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_registrar_pago_operacion(uuid, uuid, numeric, timestamp with time zone, text, uuid) TO authenticated, service_role, postgres;

-- 9.2. rpc_finanzas_anular_pago_operacion
CREATE OR REPLACE FUNCTION public.rpc_finanzas_anular_pago_operacion (
  p_operacion_id uuid,
  p_pago_id      uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id        uuid := public.current_tenant_id();
  v_op               record;
  v_omc              record;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_operacion_id IS NULL OR p_pago_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos' USING ERRCODE = '22023';
  END IF;

  SELECT id, tipo, monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_op.tipo NOT IN ('VENTA'::public.tipo_operacion, 'COMPRA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'La operación de tipo % no admite pagos', v_op.tipo USING ERRCODE = '22023';
  END IF;

  SELECT id, cuenta_id, importe
  INTO v_omc
  FROM public.operaciones_movimiento_cuenta
  WHERE operacion_id = p_operacion_id
    AND tenant_id = v_tenant_id
    AND id = p_pago_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado para esta operación' USING ERRCODE = 'P0002';
  END IF;

  -- Borrar la OMC: el trigger _omc_after_delete genera el contraasiento en el ledger y recalcula total_pagado
  DELETE FROM public.operaciones_movimiento_cuenta
  WHERE id = v_omc.id
    AND tenant_id = v_tenant_id;

  SELECT monto_total, total_pagado, esta_pago, estado_pago
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'anulada_pago_id', v_omc.id,
    'importe_anulado', ABS(v_omc.importe),
    'total_pagado', v_op.total_pagado,
    'saldo_pendiente', GREATEST(0, v_op.monto_total - v_op.total_pagado),
    'esta_pago', v_op.esta_pago,
    'estado_pago', v_op.estado_pago
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_finanzas_anular_pago_operacion(uuid, uuid) TO authenticated, service_role, postgres;

-- 9.3. rpc_crear_operacion_gasto (vía OMC)
CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_gasto (
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

GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_gasto(text, numeric, text, timestamp with time zone, text, uuid, uuid, text, uuid, numeric, jsonb, uuid) TO authenticated, service_role, postgres;

-- 9.4. rpc_crear_operacion_con_stock: actualizar pagos iniciales a OMC
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
  v_stock_id           uuid;
  v_cantidad           integer;
  v_monto_unitario     numeric;
  v_iva_alicuota_id    smallint;
  v_monto_total        numeric := 0;
  v_signo              integer;
  v_monto_pago         numeric := 0;
  v_estado_pago        public.estado_pago_operacion;
  v_estado_stock       public.estado_stock_operacion;
  v_tiene_pagos        boolean := false;
  v_pago               jsonb;
  v_pago_cuenta_id     uuid;
  v_pago_monto         numeric;
  v_pago_fecha         timestamp with time zone;
  v_pago_desc          text;
  v_linea_id           uuid;
  v_producto_id        uuid;
  v_saldo_ant          integer;
  v_saldo_post         integer;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_tipo IS NULL THEN RAISE EXCEPTION 'tipo es requerido' USING ERRCODE = '22023'; END IF;

  IF p_tipo NOT IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'ASIGNACION_ARREGLO'::public.tipo_operacion, 'AJUSTE'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'tipo no soportado por esta RPC: %', p_tipo USING ERRCODE = '22023';
  END IF;

  IF p_tipo IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'ASIGNACION_ARREGLO'::public.tipo_operacion, 'AJUSTE'::public.tipo_operacion) AND p_taller_id IS NULL THEN
    RAISE EXCEPTION 'taller_id es requerido para %', p_tipo USING ERRCODE = '22023';
  END IF;

  IF p_taller_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.talleres WHERE id = p_taller_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Taller no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_tipo = 'COMPRA'::public.tipo_operacion AND p_proveedor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.proveedores WHERE id = p_proveedor_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Proveedor no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_tipo = 'VENTA'::public.tipo_operacion AND p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Cliente no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion AND p_arreglo_id IS NULL THEN
    RAISE EXCEPTION 'arreglo_id es requerido para ASIGNACION_ARREGLO' USING ERRCODE = '22023';
  END IF;

  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'Debe incluir al menos una línea' USING ERRCODE = '22023';
  END IF;

  v_signo := CASE
    WHEN p_tipo = 'VENTA'::public.tipo_operacion THEN 1
    WHEN p_tipo = 'COMPRA'::public.tipo_operacion THEN -1
    ELSE 0
  END;

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

  v_estado_stock := CASE
    WHEN p_tipo IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion) AND NOT COALESCE(p_mover_stock, true) THEN 'PENDIENTE'::public.estado_stock_operacion
    WHEN p_tipo IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion) THEN 'ENTREGADO'::public.estado_stock_operacion
    ELSE 'NO_APLICA'::public.estado_stock_operacion
  END;

  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;

  -- Calcular monto total sumando líneas
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_cantidad := coalesce((v_linea->>'cantidad')::integer, 0);
    v_monto_unitario := coalesce((v_linea->>'monto_unitario')::numeric, 0);
    IF v_cantidad <= 0 THEN RAISE EXCEPTION 'Cantidad debe ser mayor a 0' USING ERRCODE = '22023'; END IF;
    IF v_monto_unitario < 0 THEN RAISE EXCEPTION 'Monto unitario no puede ser negativo' USING ERRCODE = '22023'; END IF;
    v_monto_total := v_monto_total + (v_cantidad * v_monto_unitario);
  END LOOP;

  -- Insertar operación
  INSERT INTO public.operaciones (
    tenant_id, tipo, taller_id, fecha, observaciones,
    monto_total, total_pagado, esta_pago,
    estado_pago, estado_stock
  )
  VALUES (
    v_tenant_id, p_tipo, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''),
    v_monto_total, 0, false,
    'PENDIENTE'::public.estado_pago_operacion, v_estado_stock
  )
  RETURNING id INTO v_operacion_id;

  -- Tablas hijas 1:1
  IF p_tipo = 'VENTA'::public.tipo_operacion THEN
    INSERT INTO public.operaciones_venta (operacion_id, tenant_id, cliente_id)
    VALUES (v_operacion_id, v_tenant_id, p_cliente_id);
  ELSIF p_tipo = 'COMPRA'::public.tipo_operacion THEN
    INSERT INTO public.operaciones_compra (operacion_id, tenant_id, proveedor_id)
    VALUES (v_operacion_id, v_tenant_id, p_proveedor_id);
  ELSIF p_tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, tenant_id, arreglo_id)
    VALUES (v_operacion_id, v_tenant_id, p_arreglo_id);
  END IF;

  -- Insertar líneas
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_stock_id := (v_linea->>'stock_id')::uuid;
    v_cantidad := (v_linea->>'cantidad')::integer;
    v_monto_unitario := coalesce((v_linea->>'monto_unitario')::numeric, 0);
    v_iva_alicuota_id := coalesce((v_linea->>'iva_alicuota_id')::smallint, 5::smallint);

    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, cantidad_cumplida, monto_unitario, delta_cantidad, iva_alicuota_id
    )
    VALUES (
      v_operacion_id, v_stock_id, v_cantidad,
      CASE WHEN COALESCE(p_mover_stock, true) THEN v_cantidad ELSE 0 END,
      v_monto_unitario,
      CASE
        WHEN NOT COALESCE(p_mover_stock, true) THEN 0
        WHEN p_tipo = 'COMPRA'::public.tipo_operacion THEN v_cantidad
        WHEN p_tipo IN ('VENTA'::public.tipo_operacion, 'ASIGNACION_ARREGLO'::public.tipo_operacion) THEN -v_cantidad
        ELSE 0
      END,
      v_iva_alicuota_id
    )
    RETURNING id INTO v_linea_id;

    -- Movimiento de stock si aplica inmediatamente (hasta que migración C migre a OMS)
    IF COALESCE(p_mover_stock, true) AND p_tipo IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'ASIGNACION_ARREGLO'::public.tipo_operacion) THEN
      SELECT s.producto_id, s.cantidad INTO v_producto_id, v_saldo_ant
      FROM public.stocks s WHERE s.id = v_stock_id FOR UPDATE;

      IF p_tipo IN ('VENTA'::public.tipo_operacion, 'ASIGNACION_ARREGLO'::public.tipo_operacion) AND v_saldo_ant < v_cantidad THEN
        RAISE EXCEPTION 'STOCK_INSUFICIENTE: Stock actual % menor a lo requerido %', v_saldo_ant, v_cantidad USING ERRCODE = '55002';
      END IF;

      v_saldo_post := CASE
        WHEN p_tipo = 'COMPRA'::public.tipo_operacion THEN v_saldo_ant + v_cantidad
        ELSE v_saldo_ant - v_cantidad
      END;

      UPDATE public.stocks SET cantidad = v_saldo_post WHERE id = v_stock_id;

      INSERT INTO public.movimientos_stock (
        tenant_id, taller_id, producto_id, stock_id, operacion_id,
        tipo_movimiento, cantidad, saldo_anterior, saldo_posterior, fecha, created_by
      )
      VALUES (
        v_tenant_id, p_taller_id, v_producto_id, v_stock_id, v_operacion_id,
        p_tipo::text,
        CASE WHEN p_tipo = 'COMPRA'::public.tipo_operacion THEN v_cantidad ELSE -v_cantidad END,
        v_saldo_ant, v_saldo_post, COALESCE(p_fecha, now()), auth.uid()
      );
    END IF;
  END LOOP;

  -- Procesar pagos como OMC
  IF v_signo <> 0 THEN
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
            v_tenant_id, v_operacion_id, v_pago_cuenta_id, v_signo * v_pago_monto, v_pago_fecha,
            coalesce(v_pago_desc, 'Pago inicial operación #' || substr(v_operacion_id::text, 1, 8)),
            (v_pago->>'idempotency_key')::uuid, auth.uid()
          );
        END IF;
      END LOOP;

    ELSE
      IF p_cuenta_id IS NOT NULL THEN
        IF v_estado_pago = 'PAGADO' THEN
          v_monto_pago := v_monto_total;
        ELSIF v_estado_pago = 'PARCIAL' THEN
          v_monto_pago := coalesce(p_monto_inicial, 0);
        ELSE
          v_monto_pago := 0;
        END IF;

        IF v_monto_pago > 0 THEN
          INSERT INTO public.operaciones_movimiento_cuenta (
            tenant_id, operacion_id, cuenta_id, importe, fecha, descripcion, idempotency_key, created_by
          )
          VALUES (
            v_tenant_id, v_operacion_id, p_cuenta_id, v_signo * v_monto_pago, COALESCE(p_fecha, now()),
            'Pago inicial operación #' || substr(v_operacion_id::text, 1, 8),
            p_idempotency_key, auth.uid()
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp with time zone, uuid, text, text, numeric, boolean, uuid, uuid) TO authenticated, service_role, postgres;

-- 9.5. rpc_crear_movimiento_cuenta: crea tipo real con su tabla hija y OMC
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
  p_observaciones     text                     DEFAULT NULL::text,
  p_taller_id         uuid                     DEFAULT NULL::uuid
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
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('finanzas:edit') THEN
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

  IF p_taller_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.talleres WHERE id = p_taller_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Taller no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_existente
    FROM public.operaciones_movimiento_cuenta AS omc
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

  IF v_subtipo = 'GASTO' THEN
    v_op_id := public.rpc_crear_operacion_gasto(
      p_categoria_gasto := p_categoria_gasto,
      p_monto := p_importe,
      p_descripcion := p_descripcion,
      p_fecha := p_fecha,
      p_observaciones := p_observaciones,
      p_taller_id := p_taller_id,
      p_cuenta_id := p_cuenta_id,
      p_idempotency_key := p_idempotency_key
    );

  ELSIF v_subtipo = 'INGRESO' THEN
    IF btrim(coalesce(p_descripcion, '')) = '' THEN
      RAISE EXCEPTION 'La descripción es requerida para un ingreso' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, observaciones, monto_total)
    VALUES (v_tenant_id, 'INGRESO'::public.tipo_operacion, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''), p_importe)
    RETURNING id INTO v_op_id;

    INSERT INTO public.operaciones_ingreso (operacion_id, tenant_id, cuenta_id, concepto)
    VALUES (v_op_id, v_tenant_id, p_cuenta_id, btrim(p_descripcion));

    INSERT INTO public.operaciones_movimiento_cuenta (
      operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, idempotency_key, created_by
    ) VALUES (
      v_op_id, v_tenant_id, p_cuenta_id, p_importe, COALESCE(p_fecha, now()),
      btrim(p_descripcion), p_idempotency_key, auth.uid()
    );

  ELSIF v_subtipo = 'TRANSFERENCIA' THEN
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, observaciones, monto_total)
    VALUES (v_tenant_id, 'TRANSFERENCIA'::public.tipo_operacion, p_taller_id, COALESCE(p_fecha, now()), NULLIF(btrim(p_observaciones), ''), p_importe)
    RETURNING id INTO v_op_id;

    INSERT INTO public.operaciones_transferencia (operacion_id, tenant_id, cuenta_origen_id, cuenta_destino_id)
    VALUES (v_op_id, v_tenant_id, p_cuenta_origen_id, p_cuenta_destino_id);

    -- 2 OMC: débito en origen, crédito en destino
    INSERT INTO public.operaciones_movimiento_cuenta (
      operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, idempotency_key, created_by
    ) VALUES (
      v_op_id, v_tenant_id, p_cuenta_origen_id, -p_importe, COALESCE(p_fecha, now()),
      COALESCE(NULLIF(btrim(p_descripcion), ''), 'Transferencia saliente'), p_idempotency_key, auth.uid()
    );

    INSERT INTO public.operaciones_movimiento_cuenta (
      operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, created_by
    ) VALUES (
      v_op_id, v_tenant_id, p_cuenta_destino_id, p_importe, COALESCE(p_fecha, now()),
      COALESCE(NULLIF(btrim(p_descripcion), ''), 'Transferencia entrante'), auth.uid()
    );
  END IF;

  RETURN v_op_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, text, uuid) TO anon, authenticated, service_role, postgres;

-- 9.6. rpc_actualizar_movimiento_cuenta
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
  p_observaciones     text                     DEFAULT NULL::text,
  p_taller_id         uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op record;
  v_omc_count integer;
  v_omc_primaria record;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_id IS NULL THEN RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023'; END IF;

  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('finanzas:edit') THEN
    RAISE EXCEPTION 'permiso finanzas:edit requerido' USING ERRCODE = '42501';
  END IF;

  SELECT id, tipo, monto_total INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_op.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN
    RAISE EXCEPTION 'Un cobro de arreglo no puede modificarse como movimiento manual' USING ERRCODE = '22023';
  END IF;

  IF v_op.tipo NOT IN ('GASTO'::public.tipo_operacion, 'INGRESO'::public.tipo_operacion, 'TRANSFERENCIA'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'Tipo de operación % no admite actualización por esta RPC', v_op.tipo USING ERRCODE = '22023';
  END IF;

  IF p_importe IS NOT NULL AND p_importe <= 0 THEN
    RAISE EXCEPTION 'importe debe ser mayor a 0' USING ERRCODE = '22023';
  END IF;

  IF p_taller_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.talleres WHERE id = p_taller_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'Taller no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Actualizar encabezado de la operación
  UPDATE public.operaciones
  SET fecha = COALESCE(p_fecha, fecha),
      observaciones = COALESCE(p_observaciones, observaciones),
      taller_id = COALESCE(p_taller_id, taller_id),
      monto_total = COALESCE(p_importe, monto_total)
  WHERE id = p_operacion_id;

  IF v_op.tipo = 'GASTO'::public.tipo_operacion THEN
    SELECT count(*), min(id) INTO v_omc_count, v_omc_primaria.id
    FROM public.operaciones_movimiento_cuenta
    WHERE operacion_id = p_operacion_id;

    -- Si tiene pagos parciales o más de un pago, no se permite cambiar monto ni cuenta
    IF v_omc_count > 1 THEN
      IF p_importe IS NOT NULL AND p_importe <> v_op.monto_total THEN
        RAISE EXCEPTION 'No se puede cambiar el monto de un gasto con múltiples pagos' USING ERRCODE = '22023';
      END IF;
      IF p_cuenta_id IS NOT NULL THEN
        RAISE EXCEPTION 'No se puede cambiar la cuenta de un gasto con múltiples pagos' USING ERRCODE = '22023';
      END IF;
    ELSE
      IF p_cuenta_id IS NOT NULL THEN
        PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
      END IF;
      UPDATE public.operaciones_movimiento_cuenta
      SET cuenta_id = COALESCE(p_cuenta_id, cuenta_id),
          importe = -COALESCE(p_importe, ABS(importe)),
          fecha = COALESCE(p_fecha, fecha),
          descripcion = COALESCE(p_descripcion, descripcion)
      WHERE operacion_id = p_operacion_id;
    END IF;

    UPDATE public.operaciones_gasto
    SET categoria_gasto = COALESCE(p_categoria_gasto, categoria_gasto),
        descripcion = COALESCE(p_descripcion, descripcion)
    WHERE operacion_id = p_operacion_id;

  ELSIF v_op.tipo = 'INGRESO'::public.tipo_operacion THEN
    IF p_cuenta_id IS NOT NULL THEN
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
    END IF;

    UPDATE public.operaciones_ingreso
    SET cuenta_id = COALESCE(p_cuenta_id, cuenta_id),
        concepto = COALESCE(p_descripcion, concepto)
    WHERE operacion_id = p_operacion_id;

    UPDATE public.operaciones_movimiento_cuenta
    SET cuenta_id = COALESCE(p_cuenta_id, cuenta_id),
        importe = COALESCE(p_importe, importe),
        fecha = COALESCE(p_fecha, fecha),
        descripcion = COALESCE(p_descripcion, descripcion)
    WHERE operacion_id = p_operacion_id;

  ELSIF v_op.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN
    IF p_cuenta_origen_id IS NOT NULL AND p_cuenta_destino_id IS NOT NULL AND p_cuenta_origen_id = p_cuenta_destino_id THEN
      RAISE EXCEPTION 'Las cuentas de origen y destino deben ser distintas' USING ERRCODE = '22023';
    END IF;

    IF p_cuenta_origen_id IS NOT NULL THEN
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_origen_id, v_tenant_id, true);
    END IF;
    IF p_cuenta_destino_id IS NOT NULL THEN
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_destino_id, v_tenant_id, true);
    END IF;

    UPDATE public.operaciones_transferencia
    SET cuenta_origen_id = COALESCE(p_cuenta_origen_id, cuenta_origen_id),
        cuenta_destino_id = COALESCE(p_cuenta_destino_id, cuenta_destino_id)
    WHERE operacion_id = p_operacion_id;

    -- Actualizar las 2 OMC
    UPDATE public.operaciones_movimiento_cuenta
    SET cuenta_id = COALESCE(p_cuenta_origen_id, cuenta_id),
        importe = -COALESCE(p_importe, ABS(importe)),
        fecha = COALESCE(p_fecha, fecha)
    WHERE operacion_id = p_operacion_id AND importe < 0;

    UPDATE public.operaciones_movimiento_cuenta
    SET cuenta_id = COALESCE(p_cuenta_destino_id, cuenta_id),
        importe = COALESCE(p_importe, ABS(importe)),
        fecha = COALESCE(p_fecha, fecha)
    WHERE operacion_id = p_operacion_id AND importe > 0;
  END IF;

  RETURN p_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, text, uuid) TO anon, authenticated, service_role, postgres;

-- 9.7. rpc_eliminar_movimiento_cuenta
CREATE OR REPLACE FUNCTION public.rpc_eliminar_movimiento_cuenta (
  p_operacion_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo      public.tipo_operacion;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_id IS NULL THEN RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023'; END IF;

  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('finanzas:edit') THEN
    RAISE EXCEPTION 'permiso finanzas:edit requerido' USING ERRCODE = '42501';
  END IF;

  SELECT tipo INTO v_tipo
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN
    RAISE EXCEPTION 'Un cobro de arreglo no puede eliminarse con esta RPC; use rpc_finanzas_anular_cobro_arreglo' USING ERRCODE = '22023';
  END IF;

  IF v_tipo NOT IN ('GASTO'::public.tipo_operacion, 'INGRESO'::public.tipo_operacion, 'TRANSFERENCIA'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'Tipo de operación % no admite eliminación por esta RPC', v_tipo USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_eliminar_movimiento_cuenta(uuid) TO anon, authenticated, service_role, postgres;

-- 9.8. _crear_apertura_cuenta
DROP FUNCTION IF EXISTS public._crear_apertura_cuenta(uuid, uuid, numeric, timestamptz);
CREATE OR REPLACE FUNCTION public._crear_apertura_cuenta(
  p_tenant_id  uuid,
  p_cuenta_id  uuid,
  p_saldo      numeric,
  p_fecha      timestamptz,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_operacion_id uuid;
BEGIN
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, monto_total)
  VALUES (p_tenant_id, 'APERTURA_CUENTA'::public.tipo_operacion, NULL, COALESCE(p_fecha, now()), ABS(p_saldo))
  RETURNING id INTO v_operacion_id;

  INSERT INTO public.operaciones_apertura_cuenta (operacion_id, tenant_id, cuenta_id)
  VALUES (v_operacion_id, p_tenant_id, p_cuenta_id);

  INSERT INTO public.operaciones_movimiento_cuenta (
    operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, created_by
  )
  VALUES (
    v_operacion_id, p_tenant_id, p_cuenta_id, p_saldo, COALESCE(p_fecha, now()), 'Apertura de cuenta', p_created_by
  );

  RETURN v_operacion_id;
END;
$$;

-- 9.9. rpc_finanzas_cobrar_arreglo
CREATE OR REPLACE FUNCTION public.rpc_finanzas_cobrar_arreglo(
  p_arreglo_id      uuid,
  p_cuenta_id       uuid        DEFAULT NULL,
  p_monto           numeric     DEFAULT NULL,
  p_fecha_cobro     timestamptz DEFAULT now(),
  p_descripcion     text        DEFAULT NULL,
  p_idempotency_key uuid        DEFAULT NULL,
  p_pagos           jsonb       DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id            uuid    := public.current_tenant_id();
  v_arreglo              record;
  v_operacion_id         uuid;
  v_pago                 jsonb;
  v_pago_cuenta_id       uuid;
  v_pago_monto           numeric;
  v_pago_desc            text;
  v_operaciones_ids      uuid[]  := ARRAY[]::uuid[];
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':cobro:' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_operacion_id
    FROM public.operaciones_movimiento_cuenta omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;
    IF v_operacion_id IS NOT NULL THEN
      SELECT a.total_cobrado, a.precio_final, a.esta_pago
      INTO v_arreglo FROM public.arreglos a
      WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id;
      RETURN jsonb_build_object(
        'operacion_id',    v_operacion_id,
        'idempotent',      true,
        'total_cobrado',   v_arreglo.total_cobrado,
        'saldo_pendiente', GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - v_arreglo.total_cobrado),
        'esta_pago',       v_arreglo.esta_pago
      );
    END IF;
  END IF;

  SELECT a.id, a.precio_final, a.total_cobrado, a.tenant_id, a.estado, v.patente
  INTO v_arreglo
  FROM public.arreglos a
  LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id
  FOR UPDATE OF a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado: %', p_arreglo_id USING ERRCODE = 'P0002'; END IF;

  IF v_arreglo.estado = 'PRESUPUESTO' THEN
    RAISE EXCEPTION 'No se pueden registrar cobros en un presupuesto' USING ERRCODE = '22023';
  END IF;

  IF p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0 THEN
    FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos)
    LOOP
      v_pago_cuenta_id := (v_pago ->> 'cuenta_id')::uuid;
      v_pago_monto := (v_pago ->> 'monto')::numeric;
      v_pago_desc := NULLIF(btrim(v_pago ->> 'descripcion'), '');

      IF v_pago_cuenta_id IS NULL THEN
        RAISE EXCEPTION 'Cada cobro debe especificar una cuenta válida' USING ERRCODE = '22023';
      END IF;
      IF v_pago_monto IS NULL OR v_pago_monto <= 0 THEN
        RAISE EXCEPTION 'El monto de cada cobro debe ser mayor a 0' USING ERRCODE = '22023';
      END IF;

      PERFORM public._finanzas_exigir_cuenta(v_pago_cuenta_id, v_tenant_id, true);

      INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, monto_total)
      VALUES (v_tenant_id, 'COBRO_ARREGLO'::public.tipo_operacion, NULL, COALESCE(p_fecha_cobro, now()), v_pago_monto)
      RETURNING id INTO v_operacion_id;

      INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
      VALUES (v_operacion_id, p_arreglo_id, v_tenant_id);

      INSERT INTO public.operaciones_movimiento_cuenta (
        operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, created_by
      ) VALUES (
        v_operacion_id, v_tenant_id, v_pago_cuenta_id, v_pago_monto, COALESCE(p_fecha_cobro, now()),
        COALESCE(v_pago_desc, NULLIF(btrim(p_descripcion), ''), 'Cobro arreglo ' || COALESCE(v_arreglo.patente, '')),
        auth.uid()
      );

      v_operaciones_ids := array_append(v_operaciones_ids, v_operacion_id);
    END LOOP;

  ELSE
    IF p_cuenta_id IS NULL THEN
      RAISE EXCEPTION 'Debe especificar una cuenta financiera' USING ERRCODE = '22023';
    END IF;
    IF p_monto IS NULL OR p_monto <= 0 THEN
      RAISE EXCEPTION 'El monto del cobro debe ser mayor a 0' USING ERRCODE = '22023';
    END IF;

    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha, monto_total)
    VALUES (v_tenant_id, 'COBRO_ARREGLO'::public.tipo_operacion, NULL, COALESCE(p_fecha_cobro, now()), p_monto)
    RETURNING id INTO v_operacion_id;

    INSERT INTO public.operaciones_cobro_arreglo (operacion_id, arreglo_id, tenant_id)
    VALUES (v_operacion_id, p_arreglo_id, v_tenant_id);

    INSERT INTO public.operaciones_movimiento_cuenta (
      operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, idempotency_key, created_by
    ) VALUES (
      v_operacion_id, v_tenant_id, p_cuenta_id, p_monto, COALESCE(p_fecha_cobro, now()),
      COALESCE(NULLIF(btrim(p_descripcion), ''), 'Cobro arreglo ' || COALESCE(v_arreglo.patente, '')),
      p_idempotency_key, auth.uid()
    );

    v_operaciones_ids := array_append(v_operaciones_ids, v_operacion_id);
  END IF;

  -- Actualizar total_cobrado en el arreglo
  SELECT COALESCE(SUM(omc.importe), 0) INTO v_arreglo.total_cobrado
  FROM public.operaciones_cobro_arreglo oca
  JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = oca.operacion_id
  WHERE oca.arreglo_id = p_arreglo_id AND oca.tenant_id = v_tenant_id;

  UPDATE public.arreglos
  SET total_cobrado = v_arreglo.total_cobrado
  WHERE id = p_arreglo_id;

  SELECT precio_final, total_cobrado, esta_pago INTO v_arreglo
  FROM public.arreglos WHERE id = p_arreglo_id;

  RETURN jsonb_build_object(
    'operaciones_ids', v_operaciones_ids,
    'total_cobrado',   v_arreglo.total_cobrado,
    'saldo_pendiente', GREATEST(0, COALESCE(v_arreglo.precio_final, 0) - v_arreglo.total_cobrado),
    'esta_pago',       v_arreglo.esta_pago
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid, uuid, numeric, timestamptz, text, uuid, jsonb) TO authenticated, service_role;

-- 9.10. rpc_finanzas_anular_cobro_arreglo
CREATE OR REPLACE FUNCTION public.rpc_finanzas_anular_cobro_arreglo(
  p_arreglo_id   uuid,
  p_operacion_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op_id uuid := p_operacion_id;
  v_importe_anulado numeric;
  v_nuevo_total numeric;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  PERFORM 1
  FROM public.arreglos
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arreglo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_op_id IS NULL THEN
    SELECT oca.operacion_id
    INTO v_op_id
    FROM public.operaciones_cobro_arreglo AS oca
    WHERE oca.arreglo_id = p_arreglo_id AND oca.tenant_id = v_tenant_id
    ORDER BY oca.created_at DESC
    LIMIT 1;
  END IF;

  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'No se encontraron cobros para este arreglo' USING ERRCODE = 'P0002';
  END IF;

  SELECT omc.importe
  INTO v_importe_anulado
  FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = omc.operacion_id
  WHERE omc.operacion_id = v_op_id
    AND omc.tenant_id = v_tenant_id
    AND oca.arreglo_id = p_arreglo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobro no encontrado para este arreglo' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.operaciones
  WHERE id = v_op_id AND tenant_id = v_tenant_id;

  SELECT COALESCE(SUM(omc.importe), 0)
  INTO v_nuevo_total
  FROM public.operaciones_cobro_arreglo AS oca
  JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = oca.operacion_id
  WHERE oca.arreglo_id = p_arreglo_id AND oca.tenant_id = v_tenant_id;

  UPDATE public.arreglos
  SET total_cobrado = v_nuevo_total
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'anulada_operacion_id', v_op_id,
    'importe_anulado', v_importe_anulado,
    'total_cobrado', v_nuevo_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid, uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10. Lectores Financieros
-- -----------------------------------------------------------------------------

-- 10.1. rpc_listar_operaciones_con_gastos: LEFT JOIN a hijas sin duplicar filas por OMC
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
      o.tipo::text AS tipo,
      o.taller_id,
      o.fecha,
      o.created_at,
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
      CASE WHEN o.tipo = 'GASTO'::public.tipo_operacion THEN o.id ELSE NULL END AS gasto_id,
      CASE
        WHEN o.tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion AND v.id IS NOT NULL THEN
          'Asignación · ' || TRIM(v.marca || ' ' || v.modelo) || ' (' || v.patente || ')'
        WHEN o.tipo = 'AJUSTE'::public.tipo_operacion AND oaj.motivo = 'DEVOLUCION_NC' THEN
          'Devolución por NC · ' || COALESCE((
            SELECT 'NC ' || COALESCE(n.numero_comprobante::text, n.id::text)
              || ' · Factura ' || COALESCE(f.numero_comprobante::text, f.id::text)
            FROM public.facturacion_nc_devoluciones d
            JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id
            JOIN public.facturas_electronicas f ON f.id = n.documento_asociado_id
            WHERE d.operacion_ajuste_id = o.id LIMIT 1
          ), '')
        WHEN o.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN
          'Transferencia de ' || COALESCE(c_orig.nombre, '') || ' a ' || COALESCE(c_dest.nombre, '')
        WHEN o.tipo = 'INGRESO'::public.tipo_operacion THEN
          COALESCE(oi.concepto, 'Ingreso a ' || COALESCE(c_ing.nombre, ''))
        WHEN o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN
          'Apertura de cuenta ' || COALESCE(c_aper.nombre, '')
        WHEN o.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN
          'Cobro arreglo ' || COALESCE(v_cob.patente, '')
        ELSE COALESCE(og.descripcion, o.observaciones)
      END AS descripcion,
      og.categoria_gasto,
      COALESCE(oi.cuenta_id, oap.cuenta_id, ot.cuenta_origen_id) AS cuenta_financiera_id,
      COALESCE(c_ing.nombre, c_aper.nombre, c_orig.nombre) AS cuenta_financiera_nombre,
      o.monto_total AS monto,
      o.monto_total,
      o.total_pagado,
      GREATEST(0, COALESCE(o.monto_total, 0) - COALESCE(o.total_pagado, 0)) AS saldo_pendiente,
      o.esta_pago,
      o.estado_pago::text AS estado_pago,
      o.estado_stock::text AS estado_stock,
      COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id,
      o.observaciones,
      oc.proveedor_id,
      prov.nombre AS proveedor_nombre,
      ov.cliente_id,
      CASE
        WHEN cl.tipo_cliente = 'empresa' THEN emp.nombre
        WHEN cl.tipo_cliente = 'particular' THEN TRIM(part.nombre || ' ' || part.apellido)
        ELSE NULL
      END AS cliente_nombre
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_gasto og ON og.operacion_id = o.id
    LEFT JOIN public.operaciones_ingreso oi ON oi.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_ing ON c_ing.id = oi.cuenta_id
    LEFT JOIN public.operaciones_transferencia ot ON ot.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_orig ON c_orig.id = ot.cuenta_origen_id
    LEFT JOIN public.cuentas_financieras c_dest ON c_dest.id = ot.cuenta_destino_id
    LEFT JOIN public.operaciones_apertura_cuenta oap ON oap.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_aper ON c_aper.id = oap.cuenta_id
    LEFT JOIN public.operaciones_ajuste oaj ON oaj.operacion_id = o.id
    LEFT JOIN public.operaciones_cobro_arreglo oca ON oca.operacion_id = o.id
    LEFT JOIN public.arreglos a_cob ON a_cob.id = oca.arreglo_id
    LEFT JOIN public.vehiculos v_cob ON v_cob.id = a_cob.vehiculo_id
    LEFT JOIN public.operaciones_asignacion_arreglo oaa ON oaa.operacion_id = o.id
    LEFT JOIN public.arreglos a ON a.id = oaa.arreglo_id
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    LEFT JOIN public.operaciones_compra oc ON oc.operacion_id = o.id
    LEFT JOIN public.proveedores prov ON prov.id = oc.proveedor_id
    LEFT JOIN public.operaciones_venta ov ON ov.operacion_id = o.id
    LEFT JOIN public.clientes cl ON cl.id = ov.cliente_id
    LEFT JOIN public.empresas emp ON emp.id = ov.cliente_id
    LEFT JOIN public.particulares part ON part.id = ov.cliente_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
      AND (
        COALESCE(cardinality(p_tipos), 0) = 0
        OR o.tipo::text = ANY(p_tipos)
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM rows
  )
  SELECT
    r.id, r.tipo, r.taller_id, r.fecha, r.created_at, r.lineas, r.gasto_id,
    r.descripcion, r.categoria_gasto, r.cuenta_financiera_id, r.cuenta_financiera_nombre,
    r.monto, r.monto_total, r.total_pagado, r.saldo_pendiente, r.esta_pago,
    r.estado_pago, r.estado_stock, r.arreglo_id, c.total AS total_count,
    r.observaciones, r.proveedor_id, r.proveedor_nombre, r.cliente_id, r.cliente_nombre
  FROM rows r
  CROSS JOIN counted c
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 500)
  OFFSET GREATEST((COALESCE(p_page, 1) - 1) * COALESCE(p_page_size, 50), 0);
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO authenticated, service_role;

-- 10.2. rpc_operaciones_stats
CREATE OR REPLACE FUNCTION public.rpc_operaciones_stats (
  p_from  timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to    timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_tipos text[]                   DEFAULT NULL::text[]
)
  RETURNS TABLE (
    ventas       numeric,
    compras      numeric,
    asignaciones numeric,
    cobros       numeric,
    gastos       numeric,
    neto         numeric
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  WITH base AS (
    SELECT
      o.tipo::text AS tipo,
      COALESCE(o.monto_total, 0) AS monto
    FROM public.operaciones AS o
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
      AND (
        COALESCE(cardinality(p_tipos), 0) = 0
        OR o.tipo::text = ANY(p_tipos)
      )
  )
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'VENTA' THEN monto ELSE 0 END), 0) AS ventas,
    COALESCE(SUM(CASE WHEN tipo = 'COMPRA' THEN monto ELSE 0 END), 0) AS compras,
    COALESCE(SUM(CASE WHEN tipo = 'ASIGNACION_ARREGLO' THEN monto ELSE 0 END), 0) AS asignaciones,
    COALESCE(SUM(CASE WHEN tipo = 'COBRO_ARREGLO' THEN monto ELSE 0 END), 0) AS cobros,
    COALESCE(SUM(CASE WHEN tipo = 'GASTO' THEN monto ELSE 0 END), 0) AS gastos,
    COALESCE(SUM(CASE
      WHEN tipo IN ('VENTA', 'INGRESO', 'COBRO_ARREGLO') THEN monto
      WHEN tipo IN ('COMPRA', 'GASTO') THEN -monto
      ELSE 0
    END), 0) AS neto
  FROM base;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_operaciones_stats(timestamp with time zone, timestamp with time zone, text[]) TO authenticated, service_role;

-- 10.3. dashboard_gastos_por_periodo y dashboard_gastos_por_dia
CREATE OR REPLACE FUNCTION public.dashboard_gastos_por_periodo(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_taller_id uuid DEFAULT NULL::uuid
)
  RETURNS TABLE(label text, repuestos numeric, sueldos numeric, eventuales numeric)
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);
  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc(b.trunc_name, (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      b.step
    ) AS slot_start
  ),
  compras AS (
    SELECT date_trunc(b.trunc_name, o.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS rep
    FROM public.operaciones AS o
    JOIN public.operaciones_lineas AS ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'COMPRA'::public.tipo_operacion
      AND o.tenant_id = (SELECT public.current_tenant_id())
      AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(
      date_trunc('month', (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc('month', (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      interval '1 month'
    ) AS mes_start
  ),
  sueldo_mes AS (
    SELECT m.mes_start, COALESCE(lat.sueldos, 0)::numeric AS sueldos
    FROM meses AS m
    LEFT JOIN LATERAL (
      SELECT SUM(eff.salario) AS sueldos
      FROM (
        SELECT DISTINCT ON (es.empleado_id) es.salario
        FROM public.empleado_salarios AS es
        JOIN public.empleados AS e ON e.id = es.empleado_id
        WHERE e.tenant_id = (SELECT public.current_tenant_id())
          AND (p_taller_id IS NULL OR e.taller_id = p_taller_id)
          AND es.vigente_desde < (m.mes_start + interval '1 month')::date
          AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
        ORDER BY es.empleado_id, es.vigente_desde DESC
      ) AS eff
    ) AS lat ON true
  ),
  gastos_eventuales AS (
    SELECT date_trunc(b.trunc_name, omc.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS slot_start,
           COALESCE(SUM(abs(omc.importe)), 0)::numeric AS eventual
    FROM public.operaciones_movimiento_cuenta AS omc
    JOIN public.operaciones AS o ON o.id = omc.operacion_id
    WHERE o.tipo = 'GASTO'::public.tipo_operacion
      AND omc.tenant_id = (SELECT public.current_tenant_id())
      AND omc.fecha >= p_from AND omc.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id OR o.taller_id IS NULL)
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt),
         COALESCE(c.rep, 0), COALESCE(sm.sueldos, 0), COALESCE(ge.eventual, 0)
  FROM slots AS s
  LEFT JOIN compras AS c USING (slot_start)
  LEFT JOIN sueldo_mes AS sm ON date_trunc(b.trunc_name, sm.mes_start) = s.slot_start
  LEFT JOIN gastos_eventuales AS ge USING (slot_start)
  ORDER BY s.slot_start;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dashboard_gastos_por_periodo(timestamp with time zone, timestamp with time zone, uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.dashboard_gastos_por_dia(timestamp with time zone, timestamp with time zone, uuid);

CREATE OR REPLACE FUNCTION public.dashboard_gastos_por_dia (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid DEFAULT NULL::uuid
)
  RETURNS TABLE (
    fecha      date,
    repuestos  numeric,
    sueldos    numeric,
    eventuales numeric
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
AS $function$
  WITH dias AS (
    SELECT generate_series(
      date_trunc('day', (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc('day', (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      interval '1 day'
    ) AS dia
  ),
  compras AS (
    SELECT date_trunc('day', o.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS rep
    FROM public.operaciones AS o
    JOIN public.operaciones_lineas AS ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'COMPRA'::public.tipo_operacion
      AND o.tenant_id = (SELECT public.current_tenant_id())
      AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(
      date_trunc('month', (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc('month', (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      interval '1 month'
    ) AS mes_start
  ),
  sueldo_mes AS (
    SELECT m.mes_start AS dia, COALESCE(lat.importe, 0)::numeric AS importe
    FROM meses AS m
    LEFT JOIN LATERAL (
      SELECT SUM(eff.salario) AS importe
      FROM (
        SELECT DISTINCT ON (es.empleado_id) es.salario
        FROM public.empleado_salarios AS es
        JOIN public.empleados AS e ON e.id = es.empleado_id
        WHERE e.tenant_id = (SELECT public.current_tenant_id())
          AND (p_taller_id IS NULL OR e.taller_id = p_taller_id)
          AND es.vigente_desde < (m.mes_start + interval '1 month')::date
          AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
        ORDER BY es.empleado_id, es.vigente_desde DESC
      ) AS eff
    ) AS lat ON true
  ),
  gastos_eventuales AS (
    SELECT date_trunc('day', omc.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
           COALESCE(SUM(abs(omc.importe)), 0)::numeric AS eventual
    FROM public.operaciones_movimiento_cuenta AS omc
    JOIN public.operaciones AS o ON o.id = omc.operacion_id
    WHERE o.tipo = 'GASTO'::public.tipo_operacion
      AND omc.tenant_id = (SELECT public.current_tenant_id())
      AND omc.fecha >= p_from AND omc.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id OR o.taller_id IS NULL)
    GROUP BY 1
  )
  SELECT d.dia::date AS fecha,
         COALESCE(c.rep, 0)::numeric,
         COALESCE(sm.importe, 0)::numeric,
         COALESCE(ge.eventual, 0)::numeric
  FROM dias AS d
  LEFT JOIN compras AS c USING (dia)
  LEFT JOIN sueldo_mes AS sm USING (dia)
  LEFT JOIN gastos_eventuales AS ge USING (dia)
  ORDER BY d.dia;
$function$;

GRANT EXECUTE ON FUNCTION public.dashboard_gastos_por_dia(timestamp with time zone, timestamp with time zone, uuid) TO authenticated, service_role;

-- 10.4. rpc_listar_movimientos_cuenta
CREATE OR REPLACE FUNCTION public.rpc_listar_movimientos_cuenta (
  p_cuenta_id uuid,
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_limit     integer                  DEFAULT 100,
  p_offset    integer                  DEFAULT 0
)
  RETURNS TABLE (
    id                   uuid,
    cuenta_financiera_id uuid,
    importe              numeric,
    fecha                timestamp with time zone,
    created_at           timestamp with time zone,
    operacion_id         uuid,
    tipo                 text,
    descripcion          text,
    categoria_gasto      text,
    arreglo_id           uuid
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  SELECT
    m.id,
    m.cuenta_financiera_id,
    m.importe,
    m.fecha,
    m.created_at,
    m.operacion_id,
    COALESCE(o.tipo::text, 'MOVIMIENTO') AS tipo,
    CASE
      WHEN m.reversion_de_id IS NOT NULL THEN
        'Anulación — ' || COALESCE(
          omc.descripcion,
          og.descripcion,
          oi.concepto,
          CASE
            WHEN o.tipo = 'VENTA'::public.tipo_operacion THEN 'Cobro de venta'
            WHEN o.tipo = 'COMPRA'::public.tipo_operacion THEN 'Pago de compra'
            WHEN o.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN 'Cobro de arreglo'
            WHEN o.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN 'Transferencia entre cuentas'
            WHEN o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN 'Apertura de cuenta'
            ELSE o.observaciones
          END,
          'movimiento'
        )
      ELSE
        COALESCE(
          omc.descripcion,
          og.descripcion,
          oi.concepto,
          CASE
            WHEN o.tipo = 'VENTA'::public.tipo_operacion THEN 'Cobro de venta'
            WHEN o.tipo = 'COMPRA'::public.tipo_operacion THEN 'Pago de compra'
            WHEN o.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN 'Cobro de arreglo'
            WHEN o.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN 'Transferencia entre cuentas'
            WHEN o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN 'Apertura de cuenta'
            ELSE o.observaciones
          END
        )
    END AS descripcion,
    og.categoria_gasto,
    COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id
  FROM public.movimientos_financieros AS m
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.id = m.omc_id
  LEFT JOIN public.operaciones AS o ON o.id = COALESCE(omc.operacion_id, m.operacion_id)
  LEFT JOIN public.operaciones_gasto AS og ON og.operacion_id = o.id
  LEFT JOIN public.operaciones_ingreso AS oi ON oi.operacion_id = o.id
  LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
  LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = o.id
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to IS NULL OR m.fecha < p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp with time zone, timestamp with time zone, integer, integer) TO anon, authenticated, service_role, postgres;

-- 10.5. rpc_cliente_cuenta_corriente: cobros sobre OMC
CREATE OR REPLACE FUNCTION public.rpc_cliente_cuenta_corriente (
  p_cliente_id uuid,
  p_from       timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to         timestamp with time zone DEFAULT NULL::timestamp WITH time zone
)
  RETURNS TABLE (
    id              uuid,
    fecha           timestamp with time zone,
    created_at      timestamp with time zone,
    tipo_movimiento text,
    concepto        text,
    comprobante     text,
    debito          numeric,
    credito         numeric,
    arreglo_id      uuid,
    operacion_id    uuid,
    cuenta_nombre   text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  WITH movimientos AS (
    -- CARGOS: Arreglos no presupuestos
    SELECT
      a.id                                                        AS id,
      a.fecha                                                     AS fecha,
      a.created_at                                                AS created_at,
      'CARGO_ARREGLO'::text                                       AS tipo_movimiento,
      COALESCE(NULLIF(btrim(a.descripcion), ''), 'Arreglo de vehículo') || ' - ' || COALESCE(v.patente, '') AS concepto,
      (
        SELECT fe.clase_comprobante || ' ' || LPAD(fe.punto_venta::text, 4, '0') || '-' || LPAD(fe.numero_comprobante::text, 8, '0')
        FROM public.facturas_electronicas fe
        WHERE fe.arreglo_id = a.id AND fe.tenant_id = a.tenant_id AND fe.estado = 'AUTORIZADA'
        LIMIT 1
      )                                                           AS comprobante,
      COALESCE(a.precio_final, 0)::numeric                        AS debito,
      0::numeric                                                  AS credito,
      a.id                                                        AS arreglo_id,
      NULL::uuid                                                  AS operacion_id,
      NULL::text                                                  AS cuenta_nombre
    FROM public.arreglos a
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    WHERE a.tenant_id = (SELECT public.current_tenant_id())
      AND COALESCE(a.cliente_id, v.cliente_id) = p_cliente_id
      AND a.estado != 'PRESUPUESTO'

    UNION ALL

    -- CRÉDITOS: Cobros registrados sobre arreglos del cliente
    SELECT
      omc.id                                                      AS id,
      omc.fecha                                                   AS fecha,
      omc.created_at                                              AS created_at,
      'COBRO'::text                                               AS tipo_movimiento,
      COALESCE(NULLIF(btrim(omc.descripcion), ''), 'Cobro registrado') || ' (' || COALESCE(v.patente, '') || ')' AS concepto,
      NULL::text                                                  AS comprobante,
      0::numeric                                                  AS debito,
      COALESCE(omc.importe, 0)::numeric                           AS credito,
      a.id                                                        AS arreglo_id,
      oca.operacion_id                                            AS operacion_id,
      cf.nombre                                                   AS cuenta_nombre
    FROM public.operaciones_cobro_arreglo oca
    JOIN public.arreglos a ON a.id = oca.arreglo_id
    JOIN public.operaciones o ON o.id = oca.operacion_id
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = oca.operacion_id
    LEFT JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    WHERE oca.tenant_id = (SELECT public.current_tenant_id())
      AND COALESCE(a.cliente_id, v.cliente_id) = p_cliente_id

    UNION ALL

    -- CARGOS: Ventas de productos al cliente
    SELECT
      o.id                                                        AS id,
      o.fecha                                                     AS fecha,
      o.created_at                                                AS created_at,
      'CARGO_VENTA'::text                                         AS tipo_movimiento,
      COALESCE(NULLIF(btrim(o.observaciones), ''), 'Venta de productos #' || substr(o.id::text, 1, 8)) AS concepto,
      NULL::text                                                  AS comprobante,
      COALESCE(o.monto_total, 0)::numeric                         AS debito,
      0::numeric                                                  AS credito,
      NULL::uuid                                                  AS arreglo_id,
      o.id                                                        AS operacion_id,
      NULL::text                                                  AS cuenta_nombre
    FROM public.operaciones_venta ov
    JOIN public.operaciones o ON o.id = ov.operacion_id
    WHERE ov.tenant_id = (SELECT public.current_tenant_id())
      AND ov.cliente_id = p_cliente_id
      AND o.tipo = 'VENTA'::public.tipo_operacion

    UNION ALL

    -- CRÉDITOS: Cobros registrados sobre ventas del cliente
    SELECT
      omc.id                                                      AS id,
      omc.fecha                                                   AS fecha,
      omc.created_at                                              AS created_at,
      'COBRO'::text                                               AS tipo_movimiento,
      COALESCE(NULLIF(btrim(omc.descripcion), ''), 'Cobro de venta #' || substr(o.id::text, 1, 8)) AS concepto,
      NULL::text                                                  AS comprobante,
      0::numeric                                                  AS debito,
      ABS(COALESCE(omc.importe, 0))::numeric                      AS credito,
      NULL::uuid                                                  AS arreglo_id,
      o.id                                                        AS operacion_id,
      cf.nombre                                                   AS cuenta_nombre
    FROM public.operaciones_movimiento_cuenta omc
    JOIN public.operaciones_venta ov ON ov.operacion_id = omc.operacion_id
    JOIN public.operaciones o ON o.id = omc.operacion_id
    LEFT JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
    WHERE ov.tenant_id = (SELECT public.current_tenant_id())
      AND ov.cliente_id = p_cliente_id
      AND o.tipo = 'VENTA'::public.tipo_operacion
  )
  SELECT
    m.id,
    m.fecha,
    m.created_at,
    m.tipo_movimiento,
    m.concepto,
    m.comprobante,
    m.debito,
    m.credito,
    m.arreglo_id,
    m.operacion_id,
    m.cuenta_nombre
  FROM movimientos m
  WHERE (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to   IS NULL OR m.fecha <  p_to)
  ORDER BY m.fecha DESC, m.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_cliente_cuenta_corriente(uuid, timestamp with time zone, timestamp with time zone) TO anon, authenticated, service_role;

-- 11. Limpieza de sobrecargas obsoletas y RPCs adicionales de finanzas

-- 11.1. Eliminar sobrecargas incompatibles que hacían referencia a operaciones_pagos o subtipo
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text, uuid, jsonb, uuid, timestamp with time zone, uuid, uuid, text, text, numeric, boolean, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.rpc_crear_movimiento_cuenta(text, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.rpc_actualizar_movimiento_cuenta(uuid, numeric, text, text, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text, uuid);

-- 11.2. rpc_borrar_operacion_con_stock sin referencias a operaciones_pagos
DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid, uuid);
DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid);

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
    FROM public.stocks AS s
    WHERE s.id = v_linea.stock_id
    FOR UPDATE;

    IF v_op.tipo = 'VENTA'::public.tipo_operacion THEN
      IF v_linea.delta_cantidad < 0 THEN
        IF v_cumplida > 0 THEN
          v_saldo_post := v_saldo_ant + v_cumplida;
          UPDATE public.stocks
          SET cantidad = v_saldo_post,
              updated_at = now()
          WHERE id = v_linea.stock_id;

          PERFORM public._stock_ledger_insertar(
            v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
            'REVERSION', v_cumplida, v_saldo_ant, v_saldo_post,
            now(), 'Reversión por anulación de Operación #' || substr(p_operacion_id::text, 1, 8)
          );
        END IF;

        IF v_remanente > 0 THEN
          UPDATE public.stocks
          SET reservado = GREATEST(0, reservado - v_remanente),
              updated_at = now()
          WHERE id = v_linea.stock_id;
        END IF;
      END IF;

    ELSIF v_op.tipo = 'COMPRA'::public.tipo_operacion THEN
      IF v_linea.delta_cantidad > 0 THEN
        IF v_cumplida > 0 THEN
          IF v_saldo_ant < v_cumplida THEN
            RAISE EXCEPTION 'No se puede revertir la compra: el stock actual (%) es menor a la cantidad a revertir (%) para el producto %',
              v_saldo_ant, v_cumplida, v_producto_id
              USING ERRCODE = '55005';
          END IF;

          v_saldo_post := v_saldo_ant - v_cumplida;
          UPDATE public.stocks
          SET cantidad = v_saldo_post,
              updated_at = now()
          WHERE id = v_linea.stock_id;

          PERFORM public._stock_ledger_insertar(
            v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
            'REVERSION', -v_cumplida, v_saldo_ant, v_saldo_post,
            now(), 'Reversión por anulación de Operación #' || substr(p_operacion_id::text, 1, 8)
          );
        END IF;

        IF v_remanente > 0 THEN
          UPDATE public.stocks
          SET pendiente = GREATEST(0, pendiente - v_remanente),
              updated_at = now()
          WHERE id = v_linea.stock_id;
        END IF;
      END IF;

    ELSE
      IF v_linea.delta_cantidad <> 0 THEN
        IF v_linea.delta_cantidad > 0 AND v_saldo_ant < v_linea.delta_cantidad THEN
          RAISE EXCEPTION 'No se puede revertir la operación: el stock actual (%) es menor a la cantidad a revertir (%) para el producto %',
            v_saldo_ant, v_linea.delta_cantidad, v_producto_id
            USING ERRCODE = '55005';
        END IF;

        v_saldo_post := v_saldo_ant - v_linea.delta_cantidad;
        UPDATE public.stocks
        SET cantidad = v_saldo_post,
            updated_at = now()
        WHERE id = v_linea.stock_id;

        PERFORM public._stock_ledger_insertar(
          v_tenant_id, v_op.taller_id, v_producto_id, v_linea.stock_id, p_operacion_id,
          'REVERSION', -v_linea.delta_cantidad, v_saldo_ant, v_saldo_post,
          now(), 'Reversión por anulación de Operación #' || substr(p_operacion_id::text, 1, 8)
        );
      END IF;
    END IF;
  END LOOP;

  -- Eliminar registros dependientes
  DELETE FROM public.operaciones_lineas WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_asignacion_arreglo WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_venta WHERE operacion_id = p_operacion_id;
  DELETE FROM public.operaciones_compra WHERE operacion_id = p_operacion_id;

  -- Permitir que las foreign keys ON DELETE SET NULL en auditoría (movimientos_stock, movimientos_financieros) se actualicen
  PERFORM set_config('app.stock_tenant_cleanup', 'on', true);
  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);

  -- La eliminación en cascada de operaciones_movimiento_cuenta dispara trg_omc_after_delete,
  -- el cual inserta los contraasientos necesarios en movimientos_financieros de manera inmutable.
  DELETE FROM public.operaciones WHERE id = p_operacion_id;

  PERFORM set_config('app.stock_tenant_cleanup', 'off', true);
  PERFORM set_config('app.finanzas_tenant_cleanup', 'off', true);

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) TO anon, authenticated, service_role, postgres;

-- 11.4. rpc_borrar_operacion_completa con soporte para los nuevos tipos de operación
CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_completa (
  p_operacion_id    uuid,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo public.tipo_operacion;
  v_arreglo_id uuid;
  v_eliminada boolean;
  v_resultado jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_operacion_id IS NULL THEN
    RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(v_tenant_id::text || ':borrar-operacion:' || p_idempotency_key::text)
    );
  END IF;
  SELECT o.tipo, oca.arreglo_id
  INTO v_tipo, v_arreglo_id
  FROM public.operaciones AS o
  LEFT JOIN public.operaciones_cobro_arreglo AS oca
    ON oca.operacion_id = o.id
   AND oca.tenant_id = v_tenant_id
  WHERE o.id = p_operacion_id
    AND o.tenant_id = v_tenant_id
  FOR UPDATE OF o;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operacion no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_tipo = 'COBRO_ARREGLO'::public.tipo_operacion OR v_arreglo_id IS NOT NULL THEN
    v_resultado := public.rpc_finanzas_anular_cobro_arreglo(
      v_arreglo_id,
      p_operacion_id
    );
    RETURN jsonb_build_object(
      'eliminada', true,
      'tipo', 'COBRO_ARREGLO',
      'arreglo_id', v_arreglo_id,
      'resultado_cobro', v_resultado
    );
  END IF;
  IF v_tipo IN ('GASTO'::public.tipo_operacion, 'INGRESO'::public.tipo_operacion, 'TRANSFERENCIA'::public.tipo_operacion, 'MOVIMIENTO_CUENTA'::public.tipo_operacion) THEN
    v_eliminada := public.rpc_eliminar_movimiento_cuenta(p_operacion_id);
  ELSE
    v_eliminada := public.rpc_borrar_operacion_con_stock(
      p_operacion_id,
      p_idempotency_key
    );
  END IF;
  IF NOT COALESCE(v_eliminada, false) THEN
    RAISE EXCEPTION 'Operacion no encontrada' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'eliminada', true,
    'tipo', v_tipo::text,
    'arreglo_id', NULL
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_completa(uuid, uuid) TO anon, authenticated, service_role, postgres;

-- 11.3. Actualizar rpc_finanzas_listar_cuentas, rpc_finanzas_obtener_cuenta y rpc_finanzas_crear_cuenta
CREATE OR REPLACE FUNCTION public.rpc_finanzas_listar_cuentas()
  RETURNS TABLE (
    id            uuid,
    tenant_id     uuid,
    nombre        text,
    tipo          text,
    activo        boolean,
    favorita      boolean,
    saldo_inicial numeric,
    saldo_actual  numeric,
    saldo         numeric,
    created_at    timestamp with time zone,
    updated_at    timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  SELECT
    c.id, c.tenant_id, c.nombre, c.tipo::text, c.activo, c.favorita,
    COALESCE(SUM(omc.importe), 0)::numeric AS saldo_inicial,
    c.saldo AS saldo_actual,
    c.saldo AS saldo,
    c.created_at, c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN (
    public.operaciones_movimiento_cuenta AS omc
    JOIN public.operaciones AS o ON o.id = omc.operacion_id AND o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion
  ) ON omc.cuenta_id = c.id
  WHERE c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id
  ORDER BY c.activo DESC, c.favorita DESC, lower(c.nombre), c.created_at;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_cuentas() TO anon, authenticated, service_role, postgres;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_obtener_cuenta (
  p_cuenta_id uuid
)
  RETURNS TABLE (
    id            uuid,
    tenant_id     uuid,
    nombre        text,
    tipo          text,
    activo        boolean,
    favorita      boolean,
    saldo_inicial numeric,
    saldo_actual  numeric,
    saldo         numeric,
    created_at    timestamp with time zone,
    updated_at    timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  SELECT
    c.id, c.tenant_id, c.nombre, c.tipo::text, c.activo, c.favorita,
    COALESCE(SUM(omc.importe), 0)::numeric AS saldo_inicial,
    c.saldo AS saldo_actual,
    c.saldo AS saldo,
    c.created_at, c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN (
    public.operaciones_movimiento_cuenta AS omc
    JOIN public.operaciones AS o ON o.id = omc.operacion_id AND o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion
  ) ON omc.cuenta_id = c.id
  WHERE c.id = p_cuenta_id
    AND c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_finanzas_obtener_cuenta(uuid) TO anon, authenticated, service_role, postgres;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_crear_cuenta (
  p_nombre          text,
  p_tipo            text,
  p_saldo_inicial   numeric                  DEFAULT 0,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_idempotency_key uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    id            uuid,
    tenant_id     uuid,
    nombre        text,
    tipo          text,
    activo        boolean,
    saldo_inicial numeric,
    saldo_actual  numeric,
    saldo         numeric,
    created_at    timestamp with time zone,
    updated_at    timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_cuenta_id uuid;
  v_nombre    text := btrim(coalesce(p_nombre, ''));
  v_tipo      text := upper(btrim(coalesce(p_tipo, '')));
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF v_nombre = '' THEN RAISE EXCEPTION 'nombre no puede estar vacío' USING ERRCODE = '22023'; END IF;
  IF v_tipo NOT IN ('EFECTIVO','CUENTA_BANCARIA','BILLETERA_DIGITAL','TARJETA_CREDITO') THEN
    RAISE EXCEPTION 'tipo de cuenta inválido: %', p_tipo USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    SELECT c.id INTO v_cuenta_id FROM public.cuentas_financieras AS c
    WHERE c.tenant_id = v_tenant_id AND c.idempotency_key = p_idempotency_key;
    IF v_cuenta_id IS NOT NULL THEN
      RETURN QUERY
      SELECT
        c.id, c.tenant_id, c.nombre, c.tipo, c.activo,
        COALESCE(SUM(omc.importe), 0)::numeric AS saldo_inicial,
        c.saldo AS saldo_actual,
        c.saldo AS saldo,
        c.created_at, c.updated_at
      FROM public.cuentas_financieras AS c
      LEFT JOIN (
        public.operaciones_movimiento_cuenta AS omc
        JOIN public.operaciones AS o ON o.id = omc.operacion_id AND o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion
      ) ON omc.cuenta_id = c.id
      WHERE c.id = v_cuenta_id
      GROUP BY c.id;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.cuentas_financieras (tenant_id, nombre, tipo, saldo, activo, idempotency_key)
  VALUES (v_tenant_id, v_nombre, v_tipo, 0, true, p_idempotency_key)
  RETURNING cuentas_financieras.id INTO v_cuenta_id;

  IF coalesce(p_saldo_inicial, 0) <> 0 THEN
    PERFORM public._crear_apertura_cuenta(v_tenant_id, v_cuenta_id, p_saldo_inicial, COALESCE(p_fecha, now()));
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.tenant_id, c.nombre, c.tipo, c.activo,
    COALESCE(SUM(omc.importe), 0)::numeric AS saldo_inicial,
    c.saldo AS saldo_actual,
    c.saldo AS saldo,
    c.created_at, c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN (
    public.operaciones_movimiento_cuenta AS omc
    JOIN public.operaciones AS o ON o.id = omc.operacion_id AND o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion
  ) ON omc.cuenta_id = c.id
  WHERE c.id = v_cuenta_id
  GROUP BY c.id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_finanzas_crear_cuenta(text, text, numeric, timestamp with time zone, uuid) TO anon, authenticated, service_role, postgres;

