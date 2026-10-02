CREATE OR REPLACE FUNCTION public.facturacion_bloquear_snapshot_autorizado()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_factura_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'facturas_electronicas' THEN
    IF OLD.estado = 'AUTORIZADA' THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'El documento fiscal autorizado es inmutable';
      END IF;
      IF ROW(OLD.tenant_id, OLD.arreglo_id, OLD.operacion_id, OLD.origen_tipo,
          OLD.documento_tipo, OLD.documento_asociado_id, OLD.idempotency_key,
          OLD.estado, OLD.ambiente, OLD.emisor_snapshot, OLD.receptor_snapshot,
          OLD.concepto, OLD.fecha_comprobante, OLD.fecha_servicio_desde,
          OLD.fecha_servicio_hasta, OLD.fecha_vencimiento_pago, OLD.moneda,
          OLD.total, OLD.punto_venta, OLD.tipo_comprobante, OLD.numero_comprobante,
          OLD.cae, OLD.cae_vencimiento, OLD.clase_comprobante, OLD.condicion_venta,
          OLD.importe_neto_gravado, OLD.importe_no_gravado, OLD.importe_exento,
          OLD.importe_iva, OLD.importe_tributos, OLD.otros_impuestos_nacionales)
        IS DISTINCT FROM
        ROW(NEW.tenant_id, NEW.arreglo_id, NEW.operacion_id, NEW.origen_tipo,
          NEW.documento_tipo, NEW.documento_asociado_id, NEW.idempotency_key,
          NEW.estado, NEW.ambiente, NEW.emisor_snapshot, NEW.receptor_snapshot,
          NEW.concepto, NEW.fecha_comprobante, NEW.fecha_servicio_desde,
          NEW.fecha_servicio_hasta, NEW.fecha_vencimiento_pago, NEW.moneda,
          NEW.total, NEW.punto_venta, NEW.tipo_comprobante, NEW.numero_comprobante,
          NEW.cae, NEW.cae_vencimiento, NEW.clase_comprobante, NEW.condicion_venta,
          NEW.importe_neto_gravado, NEW.importe_no_gravado, NEW.importe_exento,
          NEW.importe_iva, NEW.importe_tributos, NEW.otros_impuestos_nacionales) THEN
        RAISE EXCEPTION 'El documento fiscal autorizado es inmutable';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);
  IF EXISTS (SELECT 1 FROM public.facturas_electronicas f
             WHERE f.id = v_factura_id AND f.estado = 'AUTORIZADA') THEN
    RAISE EXCEPTION 'Las líneas de un documento fiscal autorizado son inmutables';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_snapshot_autorizado"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_snapshot_autorizado"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."facturacion_bloquear_snapshot_autorizado"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_snapshot_autorizado"() TO "postgres";
