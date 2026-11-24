-- ============================================================================
-- Descuentos, Subtotal y Total Autocalculados en Arreglos y Operaciones
-- ============================================================================
-- 1. Agrega columnas 'subtotal', 'descuento' y 'total' en líneas de mercadería y mano de obra:
--    - detalle_arreglo
--    - operaciones_lineas
--    - detalle_form_custom
-- 2. Agrega columnas 'subtotal' y 'descuento' en cabeceras:
--    - arreglos
--    - operaciones
-- 3. Backfill seguro con triggers deshabilitados temporalmente.
-- 4. Triggers BEFORE en líneas para autocalcular subtotal, validar descuento y calcular total = subtotal - descuento.
-- 5. Triggers AFTER en líneas y cabeceras para sincronizar arreglos y operaciones.
-- 6. Unifica regla esta_pago en arreglos: precio_final <= 0 OR total_cobrado >= precio_final.
-- 7. Protege subtotal y descuento ante comprobantes fiscales autorizados / en emisión.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Agregar columnas a las tablas
-- ----------------------------------------------------------------------------

-- Cabecera: arreglos
ALTER TABLE public.arreglos
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS descuento numeric(14,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN public.arreglos.subtotal IS 'Suma bruta visual de todas las líneas en moneda ingresada (sin IVA si precios_incluyen_iva = false).';
COMMENT ON COLUMN public.arreglos.descuento IS 'Suma visual de los descuentos de todas las líneas del arreglo.';

-- Cabecera: operaciones
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS descuento numeric(14,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN public.operaciones.subtotal IS 'Suma bruta visual de líneas (o igual a monto_total en operaciones financieras sin líneas).';
COMMENT ON COLUMN public.operaciones.descuento IS 'Suma visual de los descuentos de las líneas (0.00 en operaciones sin líneas).';

-- Líneas: detalle_arreglo
ALTER TABLE public.detalle_arreglo
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS descuento numeric(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total numeric(14,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN public.detalle_arreglo.subtotal IS 'Subtotal bruto autocalculado: round(cantidad * horas_facturadas * precio_hora_facturada, 2).';
COMMENT ON COLUMN public.detalle_arreglo.descuento IS 'Monto fijo de descuento en base ingresada (>= 0).';
COMMENT ON COLUMN public.detalle_arreglo.total IS 'Importe neto descontado de la línea: subtotal - descuento.';

-- Líneas: operaciones_lineas
ALTER TABLE public.operaciones_lineas
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS descuento numeric(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total numeric(14,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN public.operaciones_lineas.subtotal IS 'Subtotal bruto autocalculado: round(cantidad * monto_unitario, 2).';
COMMENT ON COLUMN public.operaciones_lineas.descuento IS 'Monto fijo de descuento en base ingresada (>= 0).';
COMMENT ON COLUMN public.operaciones_lineas.total IS 'Importe neto descontado de la línea: subtotal - descuento.';

-- Líneas: detalle_form_custom
ALTER TABLE public.detalle_form_custom
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS descuento numeric(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total numeric(14,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN public.detalle_form_custom.subtotal IS 'Subtotal bruto autocalculado: round(costo, 2).';
COMMENT ON COLUMN public.detalle_form_custom.descuento IS 'Monto fijo de descuento en base ingresada (>= 0).';
COMMENT ON COLUMN public.detalle_form_custom.total IS 'Importe neto descontado de la línea: subtotal - descuento.';

-- ----------------------------------------------------------------------------
-- 2. Backfill histórico seguro (deshabilitando triggers de usuario)
-- ----------------------------------------------------------------------------

ALTER TABLE public.detalle_arreglo DISABLE TRIGGER USER;
ALTER TABLE public.operaciones_lineas DISABLE TRIGGER USER;
ALTER TABLE public.detalle_form_custom DISABLE TRIGGER USER;
ALTER TABLE public.arreglos DISABLE TRIGGER USER;
ALTER TABLE public.operaciones DISABLE TRIGGER USER;

-- Poblar detalle_arreglo
UPDATE public.detalle_arreglo
SET subtotal = round(COALESCE(cantidad, 0) * COALESCE(horas_facturadas, 1) * COALESCE(precio_hora_facturada, 0), 2),
    descuento = 0.00,
    total = round(COALESCE(cantidad, 0) * COALESCE(horas_facturadas, 1) * COALESCE(precio_hora_facturada, 0), 2);

-- Poblar operaciones_lineas
UPDATE public.operaciones_lineas
SET subtotal = round(COALESCE(cantidad, 0) * COALESCE(monto_unitario, 0), 2),
    descuento = 0.00,
    total = round(COALESCE(cantidad, 0) * COALESCE(monto_unitario, 0), 2);

-- Poblar detalle_form_custom
UPDATE public.detalle_form_custom
SET subtotal = round(COALESCE(costo, 0), 2),
    descuento = 0.00,
    total = round(COALESCE(costo, 0), 2);

-- Poblar arreglos (calculando suma de subtotal de líneas cuando existen, o usando precio_sin_iva/precio_final)
UPDATE public.arreglos a
SET subtotal = COALESCE((
      SELECT SUM(x.subtotal)
      FROM (
        SELECT d.subtotal FROM public.detalle_arreglo d WHERE d.arreglo_id = a.id
        UNION ALL
        SELECT l.subtotal FROM public.operaciones_asignacion_arreglo oa
        JOIN public.operaciones_lineas l ON l.operacion_id = oa.operacion_id
        WHERE oa.arreglo_id = a.id
        UNION ALL
        SELECT round((j->>'cantidad')::numeric * (j->>'monto_unitario')::numeric, 2)
        FROM jsonb_array_elements(coalesce(a.repuestos_pendientes, '[]'::jsonb)) j
        UNION ALL
        SELECT c.subtotal FROM (
          SELECT subtotal FROM public.detalle_form_custom
          WHERE arreglo_id = a.id
          ORDER BY created_at DESC, id DESC LIMIT 1
        ) c
      ) x
    ), CASE WHEN a.precios_incluyen_iva = false AND a.precio_sin_iva IS NOT NULL THEN a.precio_sin_iva ELSE a.precio_final END, 0.00),
    descuento = 0.00;

-- Poblar operaciones
UPDATE public.operaciones o
SET subtotal = CASE
      WHEN o.tipo IN ('VENTA', 'COMPRA', 'ASIGNACION_ARREGLO', 'AJUSTE') THEN
        COALESCE((
          SELECT SUM(ol.subtotal)
          FROM public.operaciones_lineas ol
          WHERE ol.operacion_id = o.id
        ), o.monto_total, 0.00)
      ELSE COALESCE(o.monto_total, 0.00)
    END,
    descuento = 0.00;

ALTER TABLE public.detalle_arreglo ENABLE TRIGGER USER;
ALTER TABLE public.operaciones_lineas ENABLE TRIGGER USER;
ALTER TABLE public.detalle_form_custom ENABLE TRIGGER USER;
ALTER TABLE public.arreglos ENABLE TRIGGER USER;
ALTER TABLE public.operaciones ENABLE TRIGGER USER;

-- ----------------------------------------------------------------------------
-- 3. Constraints
-- ----------------------------------------------------------------------------

-- detalle_arreglo
ALTER TABLE public.detalle_arreglo
  DROP CONSTRAINT IF EXISTS detalle_arreglo_subtotal_pos,
  DROP CONSTRAINT IF EXISTS detalle_arreglo_descuento_valido,
  DROP CONSTRAINT IF EXISTS detalle_arreglo_total_valido;

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_subtotal_pos CHECK (subtotal >= 0),
  ADD CONSTRAINT detalle_arreglo_descuento_valido CHECK (descuento >= 0 AND descuento <= subtotal),
  ADD CONSTRAINT detalle_arreglo_total_valido CHECK (total = subtotal - descuento);

-- operaciones_lineas
ALTER TABLE public.operaciones_lineas
  DROP CONSTRAINT IF EXISTS operaciones_lineas_subtotal_pos,
  DROP CONSTRAINT IF EXISTS operaciones_lineas_descuento_valido,
  DROP CONSTRAINT IF EXISTS operaciones_lineas_total_valido;

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_subtotal_pos CHECK (subtotal >= 0),
  ADD CONSTRAINT operaciones_lineas_descuento_valido CHECK (descuento >= 0 AND descuento <= subtotal),
  ADD CONSTRAINT operaciones_lineas_total_valido CHECK (total = subtotal - descuento);

-- detalle_form_custom
ALTER TABLE public.detalle_form_custom
  DROP CONSTRAINT IF EXISTS detalle_form_custom_subtotal_pos,
  DROP CONSTRAINT IF EXISTS detalle_form_custom_descuento_valido,
  DROP CONSTRAINT IF EXISTS detalle_form_custom_total_valido;

ALTER TABLE public.detalle_form_custom
  ADD CONSTRAINT detalle_form_custom_subtotal_pos CHECK (subtotal >= 0),
  ADD CONSTRAINT detalle_form_custom_descuento_valido CHECK (descuento >= 0 AND descuento <= subtotal),
  ADD CONSTRAINT detalle_form_custom_total_valido CHECK (total = subtotal - descuento);

-- arreglos
ALTER TABLE public.arreglos
  DROP CONSTRAINT IF EXISTS arreglos_subtotal_pos,
  DROP CONSTRAINT IF EXISTS arreglos_descuento_valido;

ALTER TABLE public.arreglos
  ADD CONSTRAINT arreglos_subtotal_pos CHECK (subtotal >= 0),
  ADD CONSTRAINT arreglos_descuento_valido CHECK (descuento >= 0 AND descuento <= subtotal);

-- operaciones
ALTER TABLE public.operaciones
  DROP CONSTRAINT IF EXISTS operaciones_descuento_valido;

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_descuento_valido CHECK (descuento >= 0 AND (subtotal < 0 OR descuento <= subtotal));

-- ----------------------------------------------------------------------------
-- 4. Permisos de lectura de columnas en detalle_arreglo
-- ----------------------------------------------------------------------------
GRANT SELECT (
  arreglo_id, cantidad, categoria_arreglo_id, created_at, descripcion,
  descuento, empleado_id, horas_facturadas, horas_trabajadas, id,
  iva_alicuota_id, precio_hora_facturada, subtotal, tenant_id, total, updated_at
) ON public.detalle_arreglo TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Triggers BEFORE en líneas para autocalcular subtotal, validar descuento y fijar total
-- ----------------------------------------------------------------------------

-- detalle_arreglo
CREATE OR REPLACE FUNCTION public._trg_detalle_arreglo_calcular_totales()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.descuento := round(COALESCE(NEW.descuento, 0.00), 2);
  IF NEW.descuento < 0 THEN
    RAISE EXCEPTION 'El descuento no puede ser negativo' USING ERRCODE = '22023';
  END IF;
  NEW.subtotal := round(COALESCE(NEW.cantidad, 0) * COALESCE(NEW.horas_facturadas, 1) * COALESCE(NEW.precio_hora_facturada, 0), 2);
  IF NEW.descuento > NEW.subtotal THEN
    RAISE EXCEPTION 'El descuento (%) no puede superar el subtotal (%)', NEW.descuento, NEW.subtotal USING ERRCODE = '22023';
  END IF;
  NEW.total := NEW.subtotal - NEW.descuento;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_detalle_arreglo_calcular_totales ON public.detalle_arreglo;
CREATE TRIGGER trg_detalle_arreglo_calcular_totales
  BEFORE INSERT OR UPDATE OF cantidad, horas_facturadas, precio_hora_facturada, descuento ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_detalle_arreglo_calcular_totales();

-- operaciones_lineas
CREATE OR REPLACE FUNCTION public._trg_operaciones_lineas_calcular_totales()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.descuento := round(COALESCE(NEW.descuento, 0.00), 2);
  IF NEW.descuento < 0 THEN
    RAISE EXCEPTION 'El descuento no puede ser negativo' USING ERRCODE = '22023';
  END IF;
  NEW.subtotal := round(COALESCE(NEW.cantidad, 0) * COALESCE(NEW.monto_unitario, 0), 2);
  IF NEW.descuento > NEW.subtotal THEN
    RAISE EXCEPTION 'El descuento (%) no puede superar el subtotal (%)', NEW.descuento, NEW.subtotal USING ERRCODE = '22023';
  END IF;
  NEW.total := NEW.subtotal - NEW.descuento;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_operaciones_lineas_calcular_totales ON public.operaciones_lineas;
CREATE TRIGGER trg_operaciones_lineas_calcular_totales
  BEFORE INSERT OR UPDATE OF cantidad, monto_unitario, descuento ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_operaciones_lineas_calcular_totales();

-- detalle_form_custom
CREATE OR REPLACE FUNCTION public._trg_detalle_form_custom_calcular_totales()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.descuento := round(COALESCE(NEW.descuento, 0.00), 2);
  IF NEW.descuento < 0 THEN
    RAISE EXCEPTION 'El descuento no puede ser negativo' USING ERRCODE = '22023';
  END IF;
  NEW.subtotal := round(COALESCE(NEW.costo, 0), 2);
  IF NEW.descuento > NEW.subtotal THEN
    RAISE EXCEPTION 'El descuento (%) no puede superar el subtotal (%)', NEW.descuento, NEW.subtotal USING ERRCODE = '22023';
  END IF;
  NEW.total := NEW.subtotal - NEW.descuento;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_detalle_form_custom_calcular_totales ON public.detalle_form_custom;
CREATE TRIGGER trg_detalle_form_custom_calcular_totales
  BEFORE INSERT OR UPDATE OF costo, descuento ON public.detalle_form_custom
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_detalle_form_custom_calcular_totales();

-- ----------------------------------------------------------------------------
-- 6. Funciones y triggers de cálculo para Arreglos
-- ----------------------------------------------------------------------------

-- Actualizar _b2c197_total_entradas para sumar los importes ya descontados (x.total)
CREATE OR REPLACE FUNCTION public._b2c197_total_entradas (
  p_arreglo_id uuid,
  p_incluye    boolean,
  p_tasa       numeric,
  p_pendientes jsonb,
  p_formulario boolean DEFAULT true
)
  RETURNS numeric
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  SELECT coalesce(sum(public.importe_comercial_arreglo(x.total, p_incluye, p_tasa)), 0)
  FROM (
    SELECT coalesce(d.total, d.cantidad * coalesce(d.horas_facturadas, 1) * d.precio_hora_facturada - coalesce(d.descuento, 0)) AS total
    FROM public.detalle_arreglo d WHERE d.arreglo_id = p_arreglo_id
    UNION ALL
    SELECT coalesce(l.total, l.cantidad * l.monto_unitario - coalesce(l.descuento, 0))
    FROM public.operaciones_asignacion_arreglo oa
    JOIN public.operaciones_lineas l ON l.operacion_id = oa.operacion_id
    WHERE oa.arreglo_id = p_arreglo_id
    UNION ALL
    SELECT round((j->>'cantidad')::numeric * (j->>'monto_unitario')::numeric, 2) - coalesce((j->>'descuento')::numeric, 0)
    FROM jsonb_array_elements(coalesce(p_pendientes, '[]'::jsonb)) j
    UNION ALL
    SELECT coalesce(c.total, c.costo - coalesce(c.descuento, 0)) FROM (
      SELECT total, costo, descuento FROM public.detalle_form_custom
      WHERE arreglo_id = p_arreglo_id AND p_formulario
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) c
  ) x;
$function$;

-- Actualizar recalcular_precio_final_arreglo para sincronizar subtotal, descuento, precio_final y precio_sin_iva
CREATE OR REPLACE FUNCTION public.recalcular_precio_final_arreglo()
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

-- Disparadores AFTER en líneas hacia recalcular_precio_final_arreglo
DROP TRIGGER IF EXISTS trigger_recalcular_precio_operaciones_lineas ON public.operaciones_lineas;
CREATE TRIGGER trigger_recalcular_precio_operaciones_lineas
  AFTER INSERT OR DELETE OR UPDATE OF cantidad, monto_unitario, stock_id, iva_alicuota_id, descuento, subtotal, total ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

DROP TRIGGER IF EXISTS trigger_recalcular_precio_detalle_arreglo ON public.detalle_arreglo;
CREATE TRIGGER trigger_recalcular_precio_detalle_arreglo
  AFTER INSERT OR DELETE OR UPDATE ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

DROP TRIGGER IF EXISTS trg_b2c197_recalcular_formulario ON public.detalle_form_custom;
CREATE TRIGGER trg_b2c197_recalcular_formulario
  AFTER INSERT OR DELETE OR UPDATE OF costo, descuento, subtotal, total ON public.detalle_form_custom
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

-- Actualizar _b2c197_guardar_iva para calcular subtotal, descuento, precio_final, precio_sin_iva y esta_pago
CREATE OR REPLACE FUNCTION public._b2c197_guardar_iva()
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

-- Actualizar _recalcular_estado_pago_arreglo para paridad con operaciones
CREATE OR REPLACE FUNCTION public._recalcular_estado_pago_arreglo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  NEW.esta_pago := COALESCE(NEW.precio_final, 0) <= 0 OR COALESCE(NEW.total_cobrado, 0) >= COALESCE(NEW.precio_final, 0);
  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 7. Funciones y triggers de cálculo para Operaciones
-- ----------------------------------------------------------------------------

-- Función principal de recálculo de operaciones
CREATE OR REPLACE FUNCTION public.recalcular_totales_operacion(p_operacion_id uuid)
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

-- Disparador AFTER en operaciones_lineas y operaciones_cargos
CREATE OR REPLACE FUNCTION public._trg_operaciones_lineas_recalcular_operacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_operacion_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_operacion_id := OLD.operacion_id;
  ELSE
    v_operacion_id := NEW.operacion_id;
  END IF;
  IF v_operacion_id IS NOT NULL THEN
    PERFORM public.recalcular_totales_operacion(v_operacion_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DROP TRIGGER IF EXISTS trg_operaciones_lineas_sync_totales ON public.operaciones_lineas;
CREATE TRIGGER trg_operaciones_lineas_sync_totales
  AFTER INSERT OR DELETE OR UPDATE OF cantidad, monto_unitario, descuento, subtotal, total, iva_alicuota_id ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_operaciones_lineas_recalcular_operacion();

DROP TRIGGER IF EXISTS trg_operaciones_cargos_sync_totales ON public.operaciones_cargos;
CREATE TRIGGER trg_operaciones_cargos_sync_totales
  AFTER INSERT OR DELETE OR UPDATE OF importe ON public.operaciones_cargos
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_operaciones_lineas_recalcular_operacion();

-- Disparador AFTER en operaciones_compra cuando cambia modalidad IVA
CREATE OR REPLACE FUNCTION public._trg_operaciones_compra_sync_totales()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.precios_incluyen_iva IS DISTINCT FROM OLD.precios_incluyen_iva THEN
    PERFORM public.recalcular_totales_operacion(NEW.operacion_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_operaciones_compra_sync_totales ON public.operaciones_compra;
CREATE TRIGGER trg_operaciones_compra_sync_totales
  AFTER UPDATE OF precios_incluyen_iva ON public.operaciones_compra
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_operaciones_compra_sync_totales();

-- Disparador BEFORE en operaciones para operaciones sin líneas
CREATE OR REPLACE FUNCTION public._trg_operaciones_default_totales()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo NOT IN ('VENTA', 'COMPRA', 'ASIGNACION_ARREGLO', 'AJUSTE') THEN
    NEW.descuento := 0.00;
    NEW.subtotal := COALESCE(NEW.monto_total, 0.00);
  ELSIF TG_OP = 'INSERT' AND NEW.subtotal = 0.00 AND NEW.descuento = 0.00 AND NEW.monto_total <> 0.00 THEN
    NEW.subtotal := NEW.monto_total;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_operaciones_default_totales ON public.operaciones;
CREATE TRIGGER trg_operaciones_default_totales
  BEFORE INSERT OR UPDATE OF tipo, monto_total ON public.operaciones
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_operaciones_default_totales();

-- ----------------------------------------------------------------------------
-- 8. Actualizar triggers de protección fiscal
-- ----------------------------------------------------------------------------

-- facturacion_bloquear_mutacion_arreglo
CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_arreglo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_rec jsonb;
  v_arreglo_id uuid;
  v_protegido boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;
  IF TG_TABLE_NAME = 'arreglos' THEN
    v_arreglo_id := (v_rec ->> 'id')::uuid;
    SELECT EXISTS (SELECT 1 FROM public.facturas_electronicas f
      WHERE f.arreglo_id = v_arreglo_id AND f.estado IN ('AUTORIZADA', 'ENVIANDO', 'INCIERTA'))
      INTO v_protegido;
    IF NOT v_protegido THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
    IF TG_OP = 'DELETE'
       OR OLD.vehiculo_id IS DISTINCT FROM NEW.vehiculo_id
       OR OLD.taller_id IS DISTINCT FROM NEW.taller_id
       OR OLD.fecha IS DISTINCT FROM NEW.fecha
       OR OLD.precios_incluyen_iva IS DISTINCT FROM NEW.precios_incluyen_iva
       OR OLD.tasa_iva IS DISTINCT FROM NEW.tasa_iva
       OR OLD.precio_final IS DISTINCT FROM NEW.precio_final
       OR OLD.precio_sin_iva IS DISTINCT FROM NEW.precio_sin_iva
       OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
       OR OLD.descuento IS DISTINCT FROM NEW.descuento
       OR OLD.estado IS DISTINCT FROM NEW.estado THEN
      RAISE EXCEPTION 'El arreglo ya posee una factura electronica autorizada y sus datos fiscales no se pueden modificar'
        USING ERRCODE = '55001';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'vehiculos' THEN
    IF TG_OP = 'UPDATE' AND OLD.cliente_id IS NOT DISTINCT FROM NEW.cliente_id THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.arreglos a
      WHERE a.vehiculo_id = (v_rec ->> 'id')::uuid
        AND public.facturacion_arreglo_autorizado(a.id)
    ) THEN
      RAISE EXCEPTION 'No se puede cambiar el cliente de un vehiculo con arreglos facturados'
        USING ERRCODE = '55001';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME = 'operaciones_lineas' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'operacion_id')::uuid
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'operaciones' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'id')::uuid
    LIMIT 1;
  ELSE
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  END IF;
  IF v_arreglo_id IS NOT NULL THEN
    PERFORM 1 FROM public.arreglos WHERE id = v_arreglo_id FOR UPDATE;
  END IF;
  IF v_arreglo_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.facturas_electronicas f
    WHERE f.arreglo_id = v_arreglo_id AND f.estado IN ('AUTORIZADA', 'ENVIANDO', 'INCIERTA')
  ) THEN
    IF TG_OP = 'UPDATE' AND (
      (TG_TABLE_NAME = 'operaciones_lineas' AND
        (to_jsonb(OLD) - ARRAY['cantidad_cumplida','cantidad_cancelada']) =
        (to_jsonb(NEW) - ARRAY['cantidad_cumplida','cantidad_cancelada']))
      OR (TG_TABLE_NAME = 'operaciones' AND
        (to_jsonb(OLD) - ARRAY['total_pagado','estado_pago','esta_pago','estado_stock']) =
        (to_jsonb(NEW) - ARRAY['total_pagado','estado_pago','esta_pago','estado_stock']))
    ) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'No se pueden modificar lineas de un arreglo con factura electronica autorizada'
      USING ERRCODE = '55001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- facturacion_bloquear_mutacion_operacion_facturada
CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_operacion_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    v_operacion_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_operacion_id := COALESCE(NEW.operacion_id, OLD.operacion_id);
  END IF;

  IF public.facturacion_operacion_bloqueada(v_operacion_id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'No se puede eliminar una venta con comprobante fiscal autorizado o en emisión';
    ELSIF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'No se pueden agregar líneas a una venta con comprobante fiscal autorizado o en emisión';
    ELSIF TG_OP = 'UPDATE' THEN
      IF TG_TABLE_NAME = 'operaciones' THEN
        IF NEW.tipo IS DISTINCT FROM OLD.tipo
           OR NEW.fecha IS DISTINCT FROM OLD.fecha
           OR NEW.taller_id IS DISTINCT FROM OLD.taller_id
           OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
           OR NEW.descuento IS DISTINCT FROM OLD.descuento
           OR NEW.monto_total IS DISTINCT FROM OLD.monto_total
           OR NEW.observaciones IS DISTINCT FROM OLD.observaciones THEN
          RAISE EXCEPTION 'No se pueden modificar datos fiscales de una venta con comprobante fiscal autorizado o en emisión';
        END IF;
      ELSIF TG_TABLE_NAME = 'operaciones_lineas' THEN
        IF NEW.stock_id IS DISTINCT FROM OLD.stock_id
           OR NEW.operacion_id IS DISTINCT FROM OLD.operacion_id
           OR NEW.sentido IS DISTINCT FROM OLD.sentido
           OR NEW.cantidad IS DISTINCT FROM OLD.cantidad
           OR NEW.monto_unitario IS DISTINCT FROM OLD.monto_unitario
           OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
           OR NEW.descuento IS DISTINCT FROM OLD.descuento
           OR NEW.total IS DISTINCT FROM OLD.total
           OR NEW.iva_alicuota_id IS DISTINCT FROM OLD.iva_alicuota_id THEN
          RAISE EXCEPTION 'No se pueden modificar líneas de una venta con comprobante fiscal autorizado o en emisión';
        END IF;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';
