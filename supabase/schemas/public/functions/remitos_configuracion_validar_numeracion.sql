CREATE OR REPLACE FUNCTION public.remitos_configuracion_validar_numeracion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ultimo integer;
BEGIN
  IF NEW.r_punto_emision IS NOT NULL THEN
    SELECT max(r.numero) INTO v_ultimo
    FROM public.remitos r
    WHERE r.tenant_id = NEW.tenant_id
      AND r.ambiente = NEW.ambiente
      AND r.clase = 'R'
      AND r.punto_emision = NEW.r_punto_emision;
    IF v_ultimo IS NOT NULL AND NEW.r_proximo_numero <= v_ultimo THEN
      RAISE EXCEPTION 'El próximo número de Remito R debe ser mayor al último emitido (R %-%)',
        lpad(NEW.r_punto_emision::text, 5, '0'), lpad(v_ultimo::text, 8, '0');
    END IF;
  END IF;

  SELECT max(r.numero) INTO v_ultimo
  FROM public.remitos r
  WHERE r.tenant_id = NEW.tenant_id
    AND r.ambiente = NEW.ambiente
    AND r.clase = 'X'
    AND r.punto_emision = NEW.x_punto_emision;
  IF v_ultimo IS NOT NULL AND NEW.x_proximo_numero <= v_ultimo THEN
    RAISE EXCEPTION 'El próximo número de Remito X debe ser mayor al último emitido (X %-%)',
      lpad(NEW.x_punto_emision::text, 5, '0'), lpad(v_ultimo::text, 8, '0');
  END IF;

  RETURN NEW;
END;
$function$
;

REVOKE ALL ON FUNCTION "public"."remitos_configuracion_validar_numeracion"() FROM PUBLIC, "anon", "authenticated", "service_role";
