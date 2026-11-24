CREATE FUNCTION public._b2c197_guardar_iva()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
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
      OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
      OR NEW.descuento IS DISTINCT FROM OLD.descuento
      OR NEW.repuestos_pendientes IS DISTINCT FROM OLD.repuestos_pendientes));
  END IF;
  IF v_recalcular THEN
    SELECT
      coalesce(sum(x.subtotal), 0),
      coalesce(sum(x.descuento), 0),
      coalesce(sum(public.importe_comercial_arreglo(x.total, NEW.precios_incluyen_iva, NEW.tasa_iva)), 0)
    INTO NEW.subtotal, NEW.descuento, NEW.precio_final
    FROM (
      SELECT d.subtotal, d.descuento, d.total
      FROM public.detalle_arreglo d WHERE d.arreglo_id = NEW.id
      UNION ALL
      SELECT l.subtotal, l.descuento, l.total
      FROM public.operaciones_asignacion_arreglo oa
      JOIN public.operaciones_lineas l ON l.operacion_id = oa.operacion_id
      WHERE oa.arreglo_id = NEW.id
      UNION ALL
      SELECT
        round((j->>'cantidad')::numeric * (j->>'monto_unitario')::numeric, 2) AS subtotal,
        coalesce((j->>'descuento')::numeric, 0) AS descuento,
        round((j->>'cantidad')::numeric * (j->>'monto_unitario')::numeric, 2) - coalesce((j->>'descuento')::numeric, 0) AS total
      FROM jsonb_array_elements(coalesce(NEW.repuestos_pendientes, '[]'::jsonb)) j
      UNION ALL
      SELECT c.subtotal, c.descuento, c.total FROM (
        SELECT
          coalesce(subtotal, round(costo, 2)) AS subtotal,
          coalesce(descuento, 0) AS descuento,
          coalesce(total, round(costo, 2) - coalesce(descuento, 0)) AS total
        FROM public.detalle_form_custom
        WHERE arreglo_id = NEW.id
        ORDER BY created_at DESC, id DESC LIMIT 1
      ) c
    ) x;

    NEW.precio_sin_iva := CASE
      WHEN NEW.precios_incluyen_iva THEN round(NEW.precio_final / (1 + NEW.tasa_iva), 2)
      ELSE NEW.subtotal - NEW.descuento
    END;
    NEW.esta_pago := COALESCE(NEW.precio_final, 0) <= 0 OR COALESCE(NEW.total_cobrado, 0) >= COALESCE(NEW.precio_final, 0);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._b2c197_guardar_iva() FROM PUBLIC;

GRANT ALL ON FUNCTION public._b2c197_guardar_iva() TO service_role;
