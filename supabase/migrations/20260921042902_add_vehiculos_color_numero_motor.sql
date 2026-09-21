-- Permite conservar color y numero de motor al importar el padron de vehiculos.
-- Se replica el contrato de numero_chasis: texto obligatorio con vacio como valor
-- para los registros historicos que no disponen del dato.
ALTER TABLE public.vehiculos
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero_motor text NOT NULL DEFAULT '';
