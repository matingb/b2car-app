CREATE FUNCTION public.recalcular_precio_final_arreglo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_rec jsonb;
  v_arreglo_id uuid;
  v_arreglo public.arreglos;
  v_subtotal numeric(14,2);
  v_descuento numeric(14,2);
  v_precio_final numeric(14,2);
  v_precio_sin_iva numeric(14,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;
  IF TG_TABLE_NAME IN ('detalle_arreglo', 'detalle_form_custom') THEN
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  ELSIF TG_TABLE_NAME = 'operaciones_asignacion_arreglo' THEN
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  ELSIF TG_TABLE_NAME = 'operaciones_lineas' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'operacion_id')::uuid
    LIMIT 1;
    IF v_arreglo_id IS NULL THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
  END IF;
  IF v_arreglo_id IS NOT NULL THEN
    SELECT * INTO v_arreglo FROM public.arreglos WHERE id = v_arreglo_id FOR UPDATE;
    IF FOUND THEN
      SELECT
        coalesce(sum(x.subtotal), 0),
        coalesce(sum(x.descuento), 0),
        coalesce(sum(public.importe_comercial_arreglo(x.total, v_arreglo.precios_incluyen_iva, v_arreglo.tasa_iva)), 0)
      INTO v_subtotal, v_descuento, v_precio_final
      FROM (
        SELECT d.subtotal, d.descuento, d.total
        FROM public.detalle_arreglo d WHERE d.arreglo_id = v_arreglo_id
        UNION ALL
        SELECT l.subtotal, l.descuento, l.total
        FROM public.operaciones_asignacion_arreglo oa
        JOIN public.operaciones_lineas l ON l.operacion_id = oa.operacion_id
        WHERE oa.arreglo_id = v_arreglo_id
        UNION ALL
        SELECT
          round((j->>'cantidad')::numeric * (j->>'monto_unitario')::numeric, 2) AS subtotal,
          coalesce((j->>'descuento')::numeric, 0) AS descuento,
          round((j->>'cantidad')::numeric * (j->>'monto_unitario')::numeric, 2) - coalesce((j->>'descuento')::numeric, 0) AS total
        FROM jsonb_array_elements(coalesce(v_arreglo.repuestos_pendientes, '[]'::jsonb)) j
        UNION ALL
        SELECT c.subtotal, c.descuento, c.total FROM (
          SELECT
            coalesce(subtotal, round(costo, 2)) AS subtotal,
            coalesce(descuento, 0) AS descuento,
            coalesce(total, round(costo, 2) - coalesce(descuento, 0)) AS total
          FROM public.detalle_form_custom
          WHERE arreglo_id = v_arreglo_id
          ORDER BY created_at DESC, id DESC LIMIT 1
        ) c
      ) x;

      v_precio_sin_iva := CASE
        WHEN v_arreglo.tasa_iva IS NULL THEN NULL
        WHEN v_arreglo.precios_incluyen_iva THEN round(v_precio_final / (1 + v_arreglo.tasa_iva), 2)
        ELSE v_subtotal - v_descuento
      END;

      UPDATE public.arreglos
      SET subtotal = v_subtotal,
          descuento = v_descuento,
          precio_final = v_precio_final,
          precio_sin_iva = v_precio_sin_iva
      WHERE id = v_arreglo_id
        AND (subtotal IS DISTINCT FROM v_subtotal
             OR descuento IS DISTINCT FROM v_descuento
             OR precio_final IS DISTINCT FROM v_precio_final
             OR precio_sin_iva IS DISTINCT FROM v_precio_sin_iva);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

GRANT ALL ON FUNCTION public.recalcular_precio_final_arreglo() TO anon;

GRANT ALL ON FUNCTION public.recalcular_precio_final_arreglo() TO authenticated;

GRANT ALL ON FUNCTION public.recalcular_precio_final_arreglo() TO service_role;
