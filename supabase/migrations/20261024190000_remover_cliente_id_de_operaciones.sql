-- ============================================================================
-- Migración: Remover columna cliente_id de public.operaciones
-- Las operaciones de venta gestionan cliente_id de forma desacoplada
-- en la tabla public.operaciones_venta.
-- ============================================================================

-- 1. Resguardo preventivo de datos:
-- Si existiesen ventas históricas en public.operaciones que no se hayan registrado
-- aún en public.operaciones_venta, realizamos el backfill antes de eliminar la columna.
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
END $$;

-- 2. Eliminar índices asociados a cliente_id en public.operaciones
DROP INDEX IF EXISTS public.operaciones_cliente_idx;
DROP INDEX IF EXISTS public.idx_operaciones_cliente_id;
DROP INDEX IF EXISTS public.idx_operaciones_cliente;

-- 3. Eliminar constraint de clave foránea a public.clientes
ALTER TABLE public.operaciones
  DROP CONSTRAINT IF EXISTS operaciones_cliente_id_fkey;

-- 4. Eliminar la columna cliente_id de public.operaciones
ALTER TABLE public.operaciones
  DROP COLUMN IF EXISTS cliente_id;
