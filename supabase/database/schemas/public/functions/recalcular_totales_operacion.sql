CREATE FUNCTION public.recalcular_totales_operacion(p_operacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_op public.operaciones;
  v_precios_incluyen_iva boolean := true;
  v_subtotal numeric(14,2) := 0;
  v_descuento numeric(14,2) := 0;
  v_total_lineas numeric(14,2) := 0;
  v_total_iva numeric(14,2) := 0;
  v_total_cargos numeric(14,2) := 0;
  v_monto_total numeric(14,2) := 0;
BEGIN
  SELECT * INTO v_op FROM public.operaciones WHERE id = p_operacion_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_op.tipo IN ('VENTA', 'COMPRA', 'ASIGNACION_ARREGLO', 'AJUSTE') THEN
    SELECT
      COALESCE(SUM(ol.subtotal), 0),
      COALESCE(SUM(ol.descuento), 0),
      COALESCE(SUM(ol.total), 0)
    INTO v_subtotal, v_descuento, v_total_lineas
    FROM public.operaciones_lineas ol
    WHERE ol.operacion_id = p_operacion_id;

    IF v_op.tipo = 'COMPRA' THEN
      SELECT COALESCE(oc.precios_incluyen_iva, true)
      INTO v_precios_incluyen_iva
      FROM public.operaciones_compra oc
      WHERE oc.operacion_id = p_operacion_id;

      IF NOT v_precios_incluyen_iva THEN
        SELECT COALESCE(SUM(ROUND(bases.base_neta * tasas.porcentaje / 100, 2)), 0)
        INTO v_total_iva
        FROM (
          SELECT
            COALESCE(ol.iva_alicuota_id, 5::smallint) AS iva_alicuota_id,
            SUM(ol.total) AS base_neta
          FROM public.operaciones_lineas ol
          WHERE ol.operacion_id = p_operacion_id
          GROUP BY COALESCE(ol.iva_alicuota_id, 5::smallint)
        ) AS bases
        JOIN (VALUES
          (3::smallint, 0::numeric),
          (9::smallint, 2.5::numeric),
          (8::smallint, 5::numeric),
          (4::smallint, 10.5::numeric),
          (5::smallint, 21::numeric),
          (6::smallint, 27::numeric)
        ) AS tasas(iva_alicuota_id, porcentaje)
          ON tasas.iva_alicuota_id = bases.iva_alicuota_id;
      END IF;

      SELECT COALESCE(SUM(importe), 0)
      INTO v_total_cargos
      FROM public.operaciones_cargos
      WHERE operacion_id = p_operacion_id;

      v_monto_total := v_total_lineas + v_total_iva + v_total_cargos;
    ELSE
      v_monto_total := v_total_lineas;
    END IF;

    UPDATE public.operaciones
    SET subtotal = v_subtotal,
        descuento = v_descuento,
        monto_total = v_monto_total
    WHERE id = p_operacion_id
      AND (subtotal IS DISTINCT FROM v_subtotal
           OR descuento IS DISTINCT FROM v_descuento
           OR monto_total IS DISTINCT FROM v_monto_total);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.recalcular_totales_operacion(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.recalcular_totales_operacion(uuid) TO authenticated, service_role;
