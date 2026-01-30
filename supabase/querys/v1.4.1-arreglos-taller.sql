-- v1.4.1 - Agrega taller_id a arreglos (nullable para compatibilidad)

-- 1) Columna
ALTER TABLE public.arreglos
ADD COLUMN IF NOT EXISTS taller_id uuid;

-- 2) FK a talleres (permite NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'arreglos_taller_id_fkey'
  ) THEN
    ALTER TABLE public.arreglos
    ADD CONSTRAINT arreglos_taller_id_fkey
    FOREIGN KEY (taller_id) REFERENCES public.talleres(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Índices para filtros frecuentes
CREATE INDEX IF NOT EXISTS idx_arreglos_taller_id ON public.arreglos (taller_id);
CREATE INDEX IF NOT EXISTS idx_arreglos_tenant_taller ON public.arreglos (tenant_id, taller_id);

