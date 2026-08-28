-- Los snapshots autorizados son evidencia fiscal: ni siquiera los procesos
-- internos pueden reescribirlos o eliminarlos luego de obtener CAE.
CREATE OR REPLACE FUNCTION public.facturacion_bloquear_snapshot_autorizado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_factura_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'facturas_electronicas' THEN
    IF OLD.estado = 'AUTORIZADA' THEN
      RAISE EXCEPTION 'La factura electrónica autorizada es inmutable';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);
  IF EXISTS (
    SELECT 1 FROM public.facturas_electronicas f
    WHERE f.id = v_factura_id AND f.estado = 'AUTORIZADA'
  ) THEN
    RAISE EXCEPTION 'Las líneas de una factura electrónica autorizada son inmutables';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS facturacion_snapshot_factura_inmutable ON public.facturas_electronicas;
CREATE TRIGGER facturacion_snapshot_factura_inmutable
BEFORE UPDATE OR DELETE ON public.facturas_electronicas
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_snapshot_autorizado();

DROP TRIGGER IF EXISTS facturacion_snapshot_lineas_inmutables ON public.facturas_electronicas_lineas;
CREATE TRIGGER facturacion_snapshot_lineas_inmutables
BEFORE INSERT OR UPDATE OR DELETE ON public.facturas_electronicas_lineas
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_snapshot_autorizado();
