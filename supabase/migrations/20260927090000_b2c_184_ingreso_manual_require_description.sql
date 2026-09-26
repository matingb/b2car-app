ALTER TABLE public.operaciones_movimiento_cuenta
  ADD CONSTRAINT omc_ingreso_descripcion_check
  CHECK (
    subtipo <> 'INGRESO'
    OR NULLIF(BTRIM(descripcion), '') IS NOT NULL
  ) NOT VALID;
