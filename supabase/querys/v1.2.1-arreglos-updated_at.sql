-- v1.2.1 - Agrega updated_at a arreglos y lo mantiene actualizado
-- Requisitos:
-- - Backfill: updated_at debe copiar created_at para registros existentes
-- - Insert: updated_at debe tomar el mismo valor que created_at (ambos default now())
-- - Update: updated_at debe actualizarse automáticamente en cada UPDATE

ALTER TABLE public.arreglos
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;

-- Backfill: copiar created_at para filas existentes
UPDATE public.arreglos
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE public.arreglos
ALTER COLUMN updated_at SET DEFAULT now(),
ALTER COLUMN updated_at SET NOT NULL;

-- Trigger para mantener updated_at en cada UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_arreglos_updated_at ON public.arreglos;
CREATE TRIGGER set_arreglos_updated_at
BEFORE UPDATE ON public.arreglos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_arreglos_updated_at ON public.arreglos USING btree (updated_at);


