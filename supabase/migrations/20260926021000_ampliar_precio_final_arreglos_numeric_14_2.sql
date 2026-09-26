-- Ampliar precisión de precio_final y precio_sin_iva en public.arreglos a numeric(14,2)
-- para ser consistente con total_cobrado y el resto de tablas financieras,
-- evitando numeric field overflow cuando el subtotal de líneas supera 10^8.

DROP TRIGGER IF EXISTS trg_recalcular_estado_pago ON public.arreglos;

ALTER TABLE public.arreglos
  ALTER COLUMN precio_final TYPE numeric(14,2),
  ALTER COLUMN precio_sin_iva TYPE numeric(14,2);

CREATE TRIGGER trg_recalcular_estado_pago
  BEFORE INSERT OR UPDATE OF precio_final, total_cobrado ON public.arreglos
  FOR EACH ROW EXECUTE FUNCTION public._recalcular_estado_pago_arreglo();

NOTIFY pgrst, 'reload schema';
