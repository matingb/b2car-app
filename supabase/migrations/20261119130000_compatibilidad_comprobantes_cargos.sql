-- Completa despliegues que ya registraron las versiones originales de las
-- migraciones 20261116110000 y 20261116120000 antes de que se agregaran estos
-- campos y funciones. No modifica datos fiscales existentes.

ALTER TABLE public.comprobantes_recibidos
  ADD COLUMN IF NOT EXISTS desglose_iva jsonb,
  ADD COLUMN IF NOT EXISTS iva_contenido numeric(14,2);

ALTER TABLE public.comprobantes_recibidos_lineas
  ADD COLUMN IF NOT EXISTS iva_alicuota_id integer;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.comprobantes_recibidos'::regclass
      AND conname = 'comprobantes_recibidos_iva_contenido_check'
  ) THEN
    ALTER TABLE public.comprobantes_recibidos
      ADD CONSTRAINT comprobantes_recibidos_iva_contenido_check
      CHECK (iva_contenido IS NULL OR iva_contenido >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.comprobantes_recibidos_lineas'::regclass
      AND conname = 'comprobantes_recibidos_lineas_iva_check'
  ) THEN
    ALTER TABLE public.comprobantes_recibidos_lineas
      ADD CONSTRAINT comprobantes_recibidos_lineas_iva_check
      CHECK (iva_alicuota_id IS NULL OR (tipo = 'CONCEPTO' AND iva_alicuota_id IN (3, 4, 5, 6, 8, 9)));
  END IF;
END;
$migration$;

ALTER TABLE public.operaciones_compra
  ADD COLUMN IF NOT EXISTS precios_incluyen_iva boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.operaciones_creacion_idempotencia (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  operacion_id uuid NOT NULL REFERENCES public.operaciones(id) ON DELETE CASCADE,
  request_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operaciones_creacion_idempotencia_pkey PRIMARY KEY (tenant_id, idempotency_key),
  CONSTRAINT operaciones_creacion_idempotencia_operacion_key UNIQUE (operacion_id)
);

ALTER TABLE public.operaciones_creacion_idempotencia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operaciones_creacion_idempotencia FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._validar_y_sumar_cargos_operacion(p_cargos jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  v_cargo jsonb;
  v_orden bigint;
  v_importe numeric;
  v_total numeric := 0;
BEGIN
  IF jsonb_typeof(p_cargos) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Los cargos deben ser una lista' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_cargos) > 100 THEN
    RAISE EXCEPTION 'La operaciÃ³n admite hasta 100 cargos' USING ERRCODE = '22023';
  END IF;

  FOR v_cargo, v_orden IN SELECT value, ordinality FROM jsonb_array_elements(p_cargos) WITH ORDINALITY LOOP
    IF jsonb_typeof(v_cargo) <> 'object' OR COALESCE(v_cargo ->> 'tipo', 'PERCEPCION') <> 'PERCEPCION' THEN
      RAISE EXCEPTION 'Cargo %: tipo no admitido', v_orden USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_cargo ->> 'percepcion_codigo', '') NOT IN ('GANANCIAS', 'IVA', 'IIBB_BUENOS_AIRES', 'IIBB_CABA', 'OTRA') THEN
      RAISE EXCEPTION 'Cargo %: la percepciÃ³n no es vÃ¡lida', v_orden USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_cargo -> 'descripcion') IS DISTINCT FROM 'string'
      OR char_length(btrim(v_cargo ->> 'descripcion')) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'Cargo %: la descripciÃ³n es obligatoria (hasta 200 caracteres)', v_orden USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_cargo -> 'importe') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Cargo %: el importe debe ser numÃ©rico', v_orden USING ERRCODE = '22023';
    END IF;
    v_importe := (v_cargo ->> 'importe')::numeric;
    IF v_importe <= 0 OR v_importe <> round(v_importe, 2) THEN
      RAISE EXCEPTION 'Cargo %: el importe debe ser mayor a 0 y tener hasta 2 decimales', v_orden USING ERRCODE = '22023';
    END IF;
    v_total := v_total + v_importe;
  END LOOP;

  RETURN v_total;
END;
$function$;

CREATE OR REPLACE FUNCTION public._guardar_cargos_operacion(p_tenant_id uuid, p_operacion_id uuid, p_cargos jsonb)
RETURNS void
LANGUAGE sql
SET search_path TO ''
AS $function$
  INSERT INTO public.operaciones_cargos AS cargo (
    tenant_id, operacion_id, orden, tipo, percepcion_codigo, descripcion, importe
  )
  SELECT p_tenant_id, p_operacion_id, orden::integer, 'PERCEPCION',
    elem ->> 'percepcion_codigo', btrim(elem ->> 'descripcion'), (elem ->> 'importe')::numeric
  FROM jsonb_array_elements(p_cargos) WITH ORDINALITY AS entrada(elem, orden)
  ON CONFLICT (operacion_id, orden) DO UPDATE
    SET percepcion_codigo = EXCLUDED.percepcion_codigo, descripcion = EXCLUDED.descripcion, importe = EXCLUDED.importe
    WHERE (cargo.percepcion_codigo, cargo.descripcion, cargo.importe)
      IS DISTINCT FROM (EXCLUDED.percepcion_codigo, EXCLUDED.descripcion, EXCLUDED.importe);

  DELETE FROM public.operaciones_cargos
  WHERE operacion_id = p_operacion_id AND tenant_id = p_tenant_id
    AND orden > jsonb_array_length(p_cargos);
$function$;

REVOKE ALL ON FUNCTION public._validar_y_sumar_cargos_operacion(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._guardar_cargos_operacion(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_actualizar_operacion(
  p_operacion_id uuid,
  p_fecha timestamptz,
  p_observaciones text,
  p_cargos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_resultado jsonb;
  v_op record;
  v_total_cargos numeric;
  v_cargos_anteriores numeric;
  v_total numeric;
BEGIN
  v_resultado := public.rpc_actualizar_operacion(p_operacion_id, p_fecha, p_observaciones);

  SELECT tenant_id, tipo, monto_total, total_pagado INTO STRICT v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = public.current_tenant_id();

  IF v_op.tipo <> 'COMPRA' THEN
    RAISE EXCEPTION 'Solo las compras admiten cargos' USING ERRCODE = '22023';
  END IF;

  v_total_cargos := public._validar_y_sumar_cargos_operacion(p_cargos);
  SELECT COALESCE(sum(importe), 0) INTO v_cargos_anteriores
  FROM public.operaciones_cargos
  WHERE operacion_id = p_operacion_id AND tenant_id = v_op.tenant_id;

  v_total := v_op.monto_total - v_cargos_anteriores + v_total_cargos;
  IF v_total < v_op.total_pagado THEN
    RAISE EXCEPTION 'El total de la compra no puede quedar por debajo del importe ya pagado'
      USING ERRCODE = '22023';
  END IF;
  IF v_total >= 1000000000000 THEN
    RAISE EXCEPTION 'El total supera el importe mÃ¡ximo de la compra' USING ERRCODE = '22023';
  END IF;

  PERFORM public._guardar_cargos_operacion(v_op.tenant_id, p_operacion_id, p_cargos);
  UPDATE public.operaciones
  SET monto_total = v_total
  WHERE id = p_operacion_id AND tenant_id = v_op.tenant_id AND monto_total IS DISTINCT FROM v_total;

  RETURN v_resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_actualizar_operacion(uuid, timestamptz, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_operacion(uuid, timestamptz, text, jsonb) TO authenticated, service_role;

-- Conserva el RPC histórico que valida datos generales y agrega en la misma
-- transacción el desglose A y la tasa por concepto que algunas instalaciones
-- todavía no guardan con la versión registrada de 20261116110000.
CREATE OR REPLACE FUNCTION public.rpc_comprobante_recibido_guardar_con_iva(
  p_comprobante_id uuid,
  p_operacion_id uuid,
  p_datos jsonb,
  p_lineas jsonb,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_desglose jsonb := p_datos -> 'desglose_iva';
  v_iva_contenido numeric;
  v_iva jsonb;
  v_linea jsonb;
  v_clase text := upper(COALESCE(p_datos ->> 'clase', ''));
  v_tipo_documento text := upper(COALESCE(p_datos ->> 'tipo_documento', ''));
  v_iva_id integer;
  v_base numeric;
  v_impuesto numeric;
  v_conceptos_total numeric := 0;
  v_desglose_total numeric := 0;
  v_iva_ids integer[] := ARRAY[]::integer[];
BEGIN
  v_id := public.rpc_comprobante_recibido_guardar(
    p_comprobante_id, p_operacion_id, p_datos, p_lineas, p_idempotency_key
  );

  SELECT COALESCE(sum((elem ->> 'importe')::numeric), 0)
  INTO v_conceptos_total
  FROM jsonb_array_elements(p_lineas) AS elem
  WHERE upper(COALESCE(elem ->> 'tipo', '')) = 'CONCEPTO';

  IF v_desglose = 'null'::jsonb THEN v_desglose := NULL; END IF;
  IF v_desglose IS NOT NULL THEN
    IF v_tipo_documento <> 'FACTURA' OR v_clase <> 'A'
      OR jsonb_typeof(v_desglose) IS DISTINCT FROM 'array'
      OR jsonb_array_length(v_desglose) = 0 THEN
      RAISE EXCEPTION 'El desglose confirmado solo corresponde a facturas A con filas' USING ERRCODE = '22023';
    END IF;
    FOR v_iva IN SELECT value FROM jsonb_array_elements(v_desglose) LOOP
      IF jsonb_typeof(v_iva) IS DISTINCT FROM 'object'
        OR jsonb_typeof(v_iva -> 'iva_alicuota_id') IS DISTINCT FROM 'number'
        OR jsonb_typeof(v_iva -> 'base') IS DISTINCT FROM 'number'
        OR jsonb_typeof(v_iva -> 'iva') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'El desglose de IVA tiene un formato invÃ¡lido' USING ERRCODE = '22023';
      END IF;
      v_iva_id := (v_iva ->> 'iva_alicuota_id')::integer;
      v_base := (v_iva ->> 'base')::numeric;
      v_impuesto := (v_iva ->> 'iva')::numeric;
      IF v_iva_id NOT IN (3, 4, 5, 6, 8, 9) OR v_iva_id = ANY(v_iva_ids)
        OR v_base < 0 OR v_impuesto < 0
        OR v_base <> round(v_base, 2) OR v_impuesto <> round(v_impuesto, 2) THEN
        RAISE EXCEPTION 'El desglose de IVA contiene tasas o importes invÃ¡lidos' USING ERRCODE = '22023';
      END IF;
      v_iva_ids := array_append(v_iva_ids, v_iva_id);
      v_desglose_total := v_desglose_total + v_base + v_impuesto;
    END LOOP;
    IF v_desglose_total > v_conceptos_total THEN
      RAISE EXCEPTION 'La base y el IVA confirmados no pueden superar los conceptos de la factura' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NULLIF(p_datos ->> 'iva_contenido', '') IS NOT NULL THEN
    IF jsonb_typeof(p_datos -> 'iva_contenido') IS DISTINCT FROM 'number'
      OR v_tipo_documento <> 'FACTURA' OR v_clase <> 'B' THEN
      RAISE EXCEPTION 'El IVA contenido solo corresponde a facturas B' USING ERRCODE = '22023';
    END IF;
    v_iva_contenido := (p_datos ->> 'iva_contenido')::numeric;
    IF v_iva_contenido < 0 OR v_iva_contenido <> round(v_iva_contenido, 2)
      OR v_iva_contenido > v_conceptos_total THEN
      RAISE EXCEPTION 'El IVA contenido informado no es vÃ¡lido' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_desglose IS NOT NULL AND NULLIF(p_datos ->> 'iva_contenido', '') IS NOT NULL THEN
    RAISE EXCEPTION 'Una factura no puede guardar desglose e IVA contenido a la vez' USING ERRCODE = '22023';
  END IF;

  FOR v_linea IN SELECT value FROM jsonb_array_elements(p_lineas) LOOP
    IF NULLIF(v_linea ->> 'iva_alicuota_id', '') IS NOT NULL THEN
      IF v_tipo_documento <> 'FACTURA' OR v_clase <> 'A'
        OR upper(COALESCE(v_linea ->> 'tipo', '')) <> 'CONCEPTO'
        OR (v_linea ->> 'iva_alicuota_id')::integer NOT IN (3, 4, 5, 6, 8, 9) THEN
        RAISE EXCEPTION 'La alÃ­cuota solo puede asignarse a conceptos de una factura A' USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  UPDATE public.comprobantes_recibidos
  SET desglose_iva = v_desglose,
      iva_contenido = v_iva_contenido
  WHERE id = v_id AND tenant_id = public.current_tenant_id();

  UPDATE public.comprobantes_recibidos_lineas AS linea
  SET iva_alicuota_id = NULLIF(entrada.elem ->> 'iva_alicuota_id', '')::integer
  FROM jsonb_array_elements(p_lineas) WITH ORDINALITY AS entrada(elem, orden)
  WHERE linea.comprobante_id = v_id
    AND linea.tenant_id = public.current_tenant_id()
    AND linea.orden = entrada.orden::integer;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_comprobante_recibido_guardar_con_iva(uuid, uuid, jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_comprobante_recibido_guardar_con_iva(uuid, uuid, jsonb, jsonb, uuid) TO authenticated, service_role;

-- Writes go through the compatibility wrapper so new fiscal fields receive the
-- same validation on installations at every migration baseline.
REVOKE ALL ON FUNCTION public.rpc_comprobante_recibido_guardar(uuid, uuid, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_comprobante_recibido_guardar(uuid, uuid, jsonb, jsonb, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
