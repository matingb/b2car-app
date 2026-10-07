CREATE OR REPLACE FUNCTION public.rpc_remitos_asociar_factura(p_remito_id uuid, p_factura_id uuid, p_lineas jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_remito public.remitos%ROWTYPE;
  v_factura public.facturas_electronicas%ROWTYPE;
  v_item jsonb;
  v_remito_linea_txt text;
  v_factura_linea_txt text;
  v_remito_lineas uuid[] := ARRAY[]::uuid[];
  v_total_items integer;
  v_exceso record;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF NOT public._b2c179_tiene_permiso('facturas:edit') THEN
    RAISE EXCEPTION 'No tenés permiso para asociar remitos' USING ERRCODE = '42501';
  END IF;
  IF p_remito_id IS NULL OR p_factura_id IS NULL THEN
    RAISE EXCEPTION 'El remito y la factura son obligatorios';
  END IF;
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'Asociá cada ítem del remito a una línea de la factura';
  END IF;

  SELECT * INTO v_remito
  FROM public.remitos r
  WHERE r.id = p_remito_id AND r.tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Remito no encontrado'; END IF;
  IF v_remito.factura_id IS NOT NULL THEN
    RAISE EXCEPTION 'El remito ya está asociado a una factura' USING ERRCODE = '55000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('remitos_factura_' || p_factura_id::text, 0));
  SELECT * INTO v_factura
  FROM public.facturas_electronicas f
  WHERE f.id = p_factura_id AND f.tenant_id = v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;
  IF v_factura.documento_tipo <> 'FACTURA' OR v_factura.estado <> 'AUTORIZADA' THEN
    RAISE EXCEPTION 'Solo se pueden asociar facturas autorizadas';
  END IF;
  IF v_factura.ambiente <> v_remito.ambiente THEN
    RAISE EXCEPTION 'La factura pertenece a otro ambiente fiscal';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_lineas) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Asociá cada ítem del remito a una línea de la factura';
    END IF;
    v_remito_linea_txt := btrim(coalesce(v_item ->> 'remito_linea_id', ''));
    v_factura_linea_txt := btrim(coalesce(v_item ->> 'factura_linea_id', ''));
    IF v_remito_linea_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR v_factura_linea_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Asociá cada ítem del remito a una línea de la factura';
    END IF;
    IF v_remito_linea_txt::uuid = ANY (v_remito_lineas) THEN
      RAISE EXCEPTION 'Cada ítem del remito debe asociarse una sola vez';
    END IF;
    v_remito_lineas := v_remito_lineas || v_remito_linea_txt::uuid;
  END LOOP;

  SELECT count(*) INTO v_total_items FROM public.remitos_lineas rl WHERE rl.remito_id = p_remito_id;
  IF cardinality(v_remito_lineas) <> v_total_items
     OR EXISTS (
       SELECT 1 FROM unnest(v_remito_lineas) AS u(id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.remitos_lineas rl WHERE rl.id = u.id AND rl.remito_id = p_remito_id
       )
     ) THEN
    RAISE EXCEPTION 'Asociá todos los ítems del remito, una vez cada uno';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_lineas) AS m(remito_linea_id uuid, factura_linea_id uuid)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.facturas_electronicas_lineas fl
      WHERE fl.id = m.factura_linea_id AND fl.factura_id = p_factura_id
    )
  ) THEN
    RAISE EXCEPTION 'Una de las líneas seleccionadas no pertenece a la factura';
  END IF;

  SELECT fl.descripcion, fl.cantidad, coalesce(previo.total, 0) AS remitido
  INTO v_exceso
  FROM (
    SELECT m.factura_linea_id, sum(rl.cantidad) AS total
    FROM jsonb_to_recordset(p_lineas) AS m(remito_linea_id uuid, factura_linea_id uuid)
    JOIN public.remitos_lineas rl ON rl.id = m.remito_linea_id
    GROUP BY m.factura_linea_id
  ) nuevo
  JOIN public.facturas_electronicas_lineas fl ON fl.id = nuevo.factura_linea_id
  LEFT JOIN LATERAL (
    SELECT sum(x.cantidad) AS total
    FROM public.remitos_lineas x
    WHERE x.factura_linea_id = fl.id
  ) previo ON true
  WHERE coalesce(previo.total, 0) + nuevo.total > fl.cantidad
  ORDER BY fl.ordinal
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'La cantidad a remitir de "%" supera la cantidad facturada disponible (%)',
      v_exceso.descripcion, trim_scale(greatest(v_exceso.cantidad - v_exceso.remitido, 0));
  END IF;

  -- Primero el remito: el trigger de ítems valida que cada línea sea de la factura asociada.
  UPDATE public.remitos r
  SET factura_id = p_factura_id,
      factura_asociada_at = now(),
      factura_asociada_by = auth.uid()
  WHERE r.id = p_remito_id;

  UPDATE public.remitos_lineas rl
  SET factura_linea_id = m.factura_linea_id
  FROM jsonb_to_recordset(p_lineas) AS m(remito_linea_id uuid, factura_linea_id uuid)
  WHERE rl.id = m.remito_linea_id AND rl.remito_id = p_remito_id;

  RETURN p_remito_id;
END;
$function$
;

REVOKE ALL ON FUNCTION "public"."rpc_remitos_asociar_factura"(uuid, uuid, jsonb) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."rpc_remitos_asociar_factura"(uuid, uuid, jsonb) TO "authenticated", "service_role";
