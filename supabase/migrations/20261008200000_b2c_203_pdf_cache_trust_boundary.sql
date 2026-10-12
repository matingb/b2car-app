-- Only the trusted server-side PDF cache flow may write fiscal PDF objects/metadata.
DROP POLICY IF EXISTS "facturacion_comprobantes_tenant_insert" ON storage.objects;
DROP POLICY IF EXISTS "facturacion_comprobantes_tenant_update" ON storage.objects;

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_snapshot_autorizado()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_manual_changed boolean;
  v_pdf_changed boolean;
BEGIN
  IF TG_TABLE_NAME <> 'facturas_electronicas' THEN
    IF EXISTS (SELECT 1 FROM public.facturas_electronicas f WHERE f.id = COALESCE(NEW.factura_id, OLD.factura_id) AND f.estado = 'AUTORIZADA') THEN
      RAISE EXCEPTION 'Las líneas de un documento fiscal autorizado son inmutables';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.estado = 'AUTORIZADA' THEN RAISE EXCEPTION 'El documento fiscal autorizado es inmutable'; END IF;
    RETURN OLD;
  END IF;
  v_manual_changed := ROW(OLD.fce_estado_manual, OLD.fce_estado_manual_actualizado_at, OLD.fce_estado_manual_actualizado_by)
    IS DISTINCT FROM ROW(NEW.fce_estado_manual, NEW.fce_estado_manual_actualizado_at, NEW.fce_estado_manual_actualizado_by);
  v_pdf_changed := ROW(OLD.pdf_storage_path, OLD.pdf_sha256, OLD.pdf_template_version)
    IS DISTINCT FROM ROW(NEW.pdf_storage_path, NEW.pdf_sha256, NEW.pdf_template_version);
  IF v_pdf_changed AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'No autorizado para actualizar metadatos del PDF';
  END IF;
  IF v_manual_changed THEN
    IF OLD.estado <> 'AUTORIZADA' AND NEW.estado = 'AUTORIZADA'
       AND NEW.tipo_comprobante IN (201,206,211)
       AND NEW.fce_estado_manual = 'PENDIENTE'
       AND NEW.fce_estado_manual_actualizado_at IS NULL
       AND NEW.fce_estado_manual_actualizado_by IS NULL THEN
      NULL; -- initial state set atomically when ARCA authorization is persisted
    ELSIF OLD.estado = 'AUTORIZADA' AND NEW.estado = 'AUTORIZADA'
       AND OLD.tipo_comprobante IN (201,206,211) AND NEW.tipo_comprobante = OLD.tipo_comprobante
       AND auth.jwt() ->> 'user_role' = 'admin'
       AND public._b2c179_tiene_permiso('facturas:edit')
       AND NEW.fce_estado_manual IN ('PENDIENTE','ACEPTADA','RECHAZADA','CANCELADA','PAGADA','ANULADA')
       AND (to_jsonb(OLD) - ARRAY['fce_estado_manual','fce_estado_manual_actualizado_at','fce_estado_manual_actualizado_by','updated_at','pdf_storage_path','pdf_sha256','pdf_template_version'])
         = (to_jsonb(NEW) - ARRAY['fce_estado_manual','fce_estado_manual_actualizado_at','fce_estado_manual_actualizado_by','updated_at','pdf_storage_path','pdf_sha256','pdf_template_version']) THEN
      NEW.fce_estado_manual_actualizado_at := now();
      NEW.fce_estado_manual_actualizado_by := auth.uid();
    ELSE
      RAISE EXCEPTION 'Sólo un administrador autorizado puede actualizar el estado manual de una FCE autorizada';
    END IF;
  END IF;
  IF OLD.estado = 'AUTORIZADA' AND
    (to_jsonb(OLD) - ARRAY['fce_estado_manual','fce_estado_manual_actualizado_at','fce_estado_manual_actualizado_by','updated_at','pdf_storage_path','pdf_sha256','pdf_template_version'])
      IS DISTINCT FROM
    (to_jsonb(NEW) - ARRAY['fce_estado_manual','fce_estado_manual_actualizado_at','fce_estado_manual_actualizado_by','updated_at','pdf_storage_path','pdf_sha256','pdf_template_version']) THEN
    RAISE EXCEPTION 'El documento fiscal autorizado es inmutable';
  END IF;
  RETURN NEW;
END;
$function$;
