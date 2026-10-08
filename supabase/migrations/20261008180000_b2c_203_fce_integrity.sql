ALTER TABLE public.facturas_electronicas DROP CONSTRAINT facturas_electronicas_fce_data_check;
ALTER TABLE public.facturas_electronicas ADD CONSTRAINT facturas_electronicas_fce_data_check CHECK (
  (tipo_comprobante IN (201,206,211)
   AND fce_sistema IS NOT NULL AND fce_sistema IN ('SCA','ADC')
   AND fce_cbu IS NOT NULL AND fce_cbu ~ '^[0-9]{22}$'
   AND (fce_estado_manual IS NULL OR fce_estado_manual IN ('PENDIENTE','ACEPTADA','RECHAZADA','CANCELADA','PAGADA','ANULADA'))
   AND (estado <> 'AUTORIZADA' OR fce_estado_manual IS NOT NULL)) IS TRUE
  OR (tipo_comprobante NOT IN (201,206,211)
   AND fce_sistema IS NULL AND fce_cbu IS NULL AND fce_estado_manual IS NULL) IS TRUE
);

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_snapshot_autorizado()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_manual_changed boolean;
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
       AND (to_jsonb(OLD) - ARRAY['fce_estado_manual','fce_estado_manual_actualizado_at','fce_estado_manual_actualizado_by','updated_at'])
         = (to_jsonb(NEW) - ARRAY['fce_estado_manual','fce_estado_manual_actualizado_at','fce_estado_manual_actualizado_by','updated_at']) THEN
      NEW.fce_estado_manual_actualizado_at := now();
      NEW.fce_estado_manual_actualizado_by := auth.uid();
    ELSE
      RAISE EXCEPTION 'Sólo un administrador autorizado puede actualizar el estado manual de una FCE autorizada';
    END IF;
  END IF;
  IF OLD.estado = 'AUTORIZADA' AND
    (to_jsonb(OLD) - ARRAY['fce_estado_manual','fce_estado_manual_actualizado_at','fce_estado_manual_actualizado_by','updated_at'])
      IS DISTINCT FROM
    (to_jsonb(NEW) - ARRAY['fce_estado_manual','fce_estado_manual_actualizado_at','fce_estado_manual_actualizado_by','updated_at']) THEN
    RAISE EXCEPTION 'El documento fiscal autorizado es inmutable';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TABLE public.facturacion_idempotencia_intenciones (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  factura_id uuid NOT NULL REFERENCES public.facturas_electronicas(id) ON DELETE CASCADE,
  contenido_hash text NOT NULL CHECK (contenido_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, idempotency_key)
);
ALTER TABLE public.facturacion_idempotencia_intenciones ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.facturacion_idempotencia_intenciones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.facturacion_idempotencia_intenciones TO service_role;
CREATE POLICY facturacion_idempotencia_tenant_select ON public.facturacion_idempotencia_intenciones
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY facturacion_idempotencia_tenant_insert ON public.facturacion_idempotencia_intenciones
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.current_tenant_id() AND EXISTS (
      SELECT 1 FROM public.facturas_electronicas f WHERE f.id = factura_id AND f.tenant_id = tenant_id
    ));
