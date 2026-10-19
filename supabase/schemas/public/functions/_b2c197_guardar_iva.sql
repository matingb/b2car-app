CREATE OR REPLACE FUNCTION public._b2c197_guardar_iva()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_cambio boolean;
  v_recalcular boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_cambio := NOT NEW.precios_incluyen_iva OR NEW.tasa_iva IS NOT NULL;
  ELSE
    v_cambio := NEW.precios_incluyen_iva IS DISTINCT FROM OLD.precios_incluyen_iva
      OR NEW.tasa_iva IS DISTINCT FROM OLD.tasa_iva;
  END IF;
  IF v_cambio THEN
    IF coalesce(auth.role(), '') <> 'service_role' AND
       (NEW.tenant_id IS DISTINCT FROM public.current_tenant_id()
        OR NOT public._b2c179_tiene_permiso('arreglos:precios:edit')) THEN
      RAISE EXCEPTION 'Sin permiso para editar precios del arreglo' USING ERRCODE = '42501';
    END IF;
    IF NEW.tasa_iva IS NULL OR NEW.tasa_iva < 0 OR NEW.tasa_iva >= 'Infinity'::numeric THEN
      RAISE EXCEPTION 'Se requiere tasa_iva comercial valida del servidor' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF OLD.total_cobrado > 0 OR NEW.total_cobrado > 0 THEN
        RAISE EXCEPTION 'No se puede cambiar IVA con cobros vigentes' USING ERRCODE = '55000';
      END IF;
      IF NEW.precios_incluyen_iva IS NOT DISTINCT FROM OLD.precios_incluyen_iva THEN
        RAISE EXCEPTION 'La tasa comercial solo cambia junto con el modo IVA' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (SELECT 1 FROM public.facturas_electronicas f
        WHERE f.arreglo_id = OLD.id AND f.estado IN ('AUTORIZADA','ENVIANDO','INCIERTA')) THEN
        RAISE EXCEPTION 'El arreglo tiene una factura autorizada o en envio/reconciliacion' USING ERRCODE = '55001';
      END IF;
    END IF;
  END IF;
  v_recalcular := v_cambio;
  IF TG_OP = 'UPDATE' THEN
    v_recalcular := v_recalcular OR (NEW.tasa_iva IS NOT NULL AND (
      NEW.precio_final IS DISTINCT FROM OLD.precio_final
      OR NEW.precio_sin_iva IS DISTINCT FROM OLD.precio_sin_iva
      OR NEW.repuestos_pendientes IS DISTINCT FROM OLD.repuestos_pendientes));
  END IF;
  IF v_recalcular THEN
    NEW.precio_final := public._b2c197_total_entradas(NEW.id,
      NEW.precios_incluyen_iva, NEW.tasa_iva, NEW.repuestos_pendientes, true);
    NEW.precio_sin_iva := CASE WHEN NEW.precios_incluyen_iva
      THEN round(NEW.precio_final / (1 + NEW.tasa_iva), 2)
      ELSE public._b2c197_total_entradas(NEW.id, false, 0, NEW.repuestos_pendientes, true) END;
    NEW.esta_pago := NEW.precio_final > 0 AND NEW.total_cobrado >= NEW.precio_final;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._b2c197_guardar_iva() FROM PUBLIC, anon, authenticated;
