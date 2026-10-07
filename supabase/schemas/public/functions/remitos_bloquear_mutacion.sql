CREATE OR REPLACE FUNCTION public.remitos_bloquear_mutacion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_remito uuid;
  v_factura_linea uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'remitos' THEN
      RAISE EXCEPTION 'Los remitos emitidos no se pueden eliminar' USING ERRCODE = '55000';
    END IF;
    RAISE EXCEPTION 'Los ítems de un remito emitido no se pueden eliminar' USING ERRCODE = '55000';
  END IF;

  IF TG_TABLE_NAME = 'remitos' THEN
    IF (to_jsonb(NEW) - ARRAY['factura_id', 'factura_asociada_at', 'factura_asociada_by'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['factura_id', 'factura_asociada_at', 'factura_asociada_by']) THEN
      RAISE EXCEPTION 'El remito emitido es inmutable' USING ERRCODE = '55000';
    END IF;
    IF ROW(NEW.factura_id, NEW.factura_asociada_at, NEW.factura_asociada_by)
       IS DISTINCT FROM ROW(OLD.factura_id, OLD.factura_asociada_at, OLD.factura_asociada_by)
       AND NOT (OLD.factura_id IS NULL AND NEW.factura_id IS NOT NULL) THEN
      RAISE EXCEPTION 'El remito ya está asociado a una factura' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'factura_linea_id') IS DISTINCT FROM (to_jsonb(OLD) - 'factura_linea_id') THEN
    RAISE EXCEPTION 'Los ítems de un remito emitido son inmutables' USING ERRCODE = '55000';
  END IF;
  IF NEW.factura_linea_id IS DISTINCT FROM OLD.factura_linea_id THEN
    IF OLD.factura_linea_id IS NOT NULL OR NEW.factura_linea_id IS NULL THEN
      RAISE EXCEPTION 'El ítem del remito ya está asociado a una línea de factura' USING ERRCODE = '55000';
    END IF;
    SELECT r.factura_id INTO v_factura_remito FROM public.remitos r WHERE r.id = NEW.remito_id;
    SELECT fl.factura_id INTO v_factura_linea FROM public.facturas_electronicas_lineas fl WHERE fl.id = NEW.factura_linea_id;
    IF v_factura_remito IS NULL OR v_factura_linea IS DISTINCT FROM v_factura_remito THEN
      RAISE EXCEPTION 'La línea de factura no corresponde a la factura asociada al remito' USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

REVOKE ALL ON FUNCTION "public"."remitos_bloquear_mutacion"() FROM PUBLIC, "anon", "authenticated", "service_role";
