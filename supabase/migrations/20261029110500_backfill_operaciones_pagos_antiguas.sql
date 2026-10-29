-- Migration: 20261029110500_backfill_operaciones_pagos_antiguas.sql
-- Description: Backfill de operaciones_pagos y descripciones para ventas y compras historicas

-- 1. Insertar registros en operaciones_pagos para movimientos financieros historicos de compras y ventas sin pago asociado
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
  CASE
    WHEN o.tipo = 'VENTA' THEN COALESCE(NULLIF(btrim(o.observaciones), ''), 'Cobro de venta #' || substr(o.id::text, 1, 8))
    WHEN o.tipo = 'COMPRA' THEN COALESCE(NULLIF(btrim(o.observaciones), ''), 'Pago de compra #' || substr(o.id::text, 1, 8))
    ELSE 'Pago de operación'
  END,
  mf.created_at
FROM public.operaciones o
JOIN public.movimientos_financieros mf ON mf.operacion_id = o.id AND mf.tenant_id = o.tenant_id
WHERE o.tipo IN ('COMPRA', 'VENTA')
  AND NOT EXISTS (
    SELECT 1 FROM public.operaciones_pagos op
    WHERE (op.operacion_id = o.id OR op.operacion_pago_id = o.id)
      AND op.cuenta_financiera_id = mf.cuenta_financiera_id
  );

-- 2. Mejorar descripciones genericas o vacias en operaciones_pagos existentes de ventas y compras
UPDATE public.operaciones_pagos op
SET descripcion = CASE
  WHEN o.tipo = 'VENTA' THEN COALESCE(NULLIF(btrim(o.observaciones), ''), 'Cobro de venta #' || substr(o.id::text, 1, 8))
  WHEN o.tipo = 'COMPRA' THEN COALESCE(NULLIF(btrim(o.observaciones), ''), 'Pago de compra #' || substr(o.id::text, 1, 8))
  ELSE op.descripcion
END
FROM public.operaciones o
WHERE op.operacion_id = o.id
  AND o.tipo IN ('VENTA', 'COMPRA')
  AND (op.descripcion IS NULL OR btrim(op.descripcion) = '' OR op.descripcion = 'Pago inicial registrado');
