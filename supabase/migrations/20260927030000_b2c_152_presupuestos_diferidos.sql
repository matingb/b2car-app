-- B2C-152: los presupuestos nuevos conservan una intencion de repuestos sin
-- materializar stock, compras, asignaciones ni movimientos financieros.
-- NULL mantiene la compatibilidad con presupuestos historicos: no se infiere
-- si sus repuestos ya fueron materializados.

ALTER TABLE public.arreglos
  ADD COLUMN IF NOT EXISTS repuestos_pendientes jsonb;

COMMENT ON COLUMN public.arreglos.repuestos_pendientes IS
  'B2C-152: NULL = arreglo operativo o presupuesto historico; array = borrador diferido de un presupuesto nuevo.';

ALTER TABLE public.arreglos
  DROP CONSTRAINT IF EXISTS arreglos_repuestos_pendientes_array_check,
  DROP CONSTRAINT IF EXISTS arreglos_repuestos_pendientes_estado_check;

ALTER TABLE public.arreglos
  ADD CONSTRAINT arreglos_repuestos_pendientes_array_check
    CHECK (repuestos_pendientes IS NULL OR jsonb_typeof(repuestos_pendientes) = 'array'),
  ADD CONSTRAINT arreglos_repuestos_pendientes_estado_check
    CHECK (repuestos_pendientes IS NULL OR estado = 'PRESUPUESTO');

CREATE OR REPLACE FUNCTION public._b2c152_activacion_guardada()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(current_setting('b2c152.activation', true), '') = 'on';
$$;

CREATE OR REPLACE FUNCTION public._b2c152_guardar_estado_arreglo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado <> NEW.estado THEN
    IF OLD.estado <> 'PRESUPUESTO' AND NEW.estado = 'PRESUPUESTO' THEN
      RAISE EXCEPTION 'No se puede volver a PRESUPUESTO despues de activar el arreglo'
        USING ERRCODE = 'P0001';
    END IF;
    IF OLD.estado = 'PRESUPUESTO'
       AND NEW.estado <> 'PRESUPUESTO'
       AND NOT public._b2c152_activacion_guardada() THEN
      RAISE EXCEPTION 'La salida de PRESUPUESTO requiere rpc_activar_presupuesto'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS b2c152_guardar_estado_arreglo ON public.arreglos;
CREATE TRIGGER b2c152_guardar_estado_arreglo
BEFORE UPDATE OF estado ON public.arreglos
FOR EACH ROW EXECUTE FUNCTION public._b2c152_guardar_estado_arreglo();

CREATE OR REPLACE FUNCTION public._b2c152_guardar_asignacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_estado public.estado_arreglo;
  v_repuestos_pendientes jsonb;
BEGIN
  SELECT estado, repuestos_pendientes
    INTO v_estado, v_repuestos_pendientes
  FROM public.arreglos
  WHERE id = NEW.arreglo_id;
  IF v_estado = 'PRESUPUESTO'
     AND v_repuestos_pendientes IS NOT NULL
     AND NOT public._b2c152_activacion_guardada() THEN
    RAISE EXCEPTION 'Un presupuesto no puede recibir asignaciones operativas'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS b2c152_guardar_asignacion ON public.operaciones_asignacion_arreglo;
CREATE TRIGGER b2c152_guardar_asignacion
BEFORE INSERT OR UPDATE ON public.operaciones_asignacion_arreglo
FOR EACH ROW EXECUTE FUNCTION public._b2c152_guardar_asignacion();

CREATE OR REPLACE FUNCTION public._b2c152_validar_linea(
  p_linea jsonb,
  p_taller_id uuid,
  p_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_id uuid;
  v_stock_id uuid;
  v_cantidad integer;
  v_monto numeric;
  v_precio_compra numeric;
  v_codigo text;
  v_nombre text;
BEGIN
  IF p_linea IS NULL OR jsonb_typeof(p_linea) <> 'object' THEN
    RAISE EXCEPTION 'repuesto pendiente invalido' USING ERRCODE = '22023';
  END IF;
  BEGIN v_id := (p_linea ->> 'id')::uuid; EXCEPTION WHEN invalid_text_representation THEN v_id := NULL; END;
  IF v_id IS NULL THEN RAISE EXCEPTION 'id de repuesto pendiente invalido' USING ERRCODE = '22023'; END IF;
  v_tipo := upper(trim(coalesce(p_linea ->> 'tipo', '')));
  v_cantidad := (p_linea ->> 'cantidad')::integer;
  v_monto := (p_linea ->> 'monto_unitario')::numeric;
  IF v_cantidad IS NULL OR v_cantidad <= 0 OR v_monto IS NULL OR v_monto < 0 THEN
    RAISE EXCEPTION 'cantidad o monto de repuesto pendiente invalido' USING ERRCODE = '22023';
  END IF;

  IF v_tipo = 'EXISTENTE' THEN
    BEGIN v_stock_id := (p_linea ->> 'stock_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN v_stock_id := NULL; END;
    IF v_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id de repuesto pendiente invalido' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.stocks s
      WHERE s.id = v_stock_id AND s.tenant_id = p_tenant_id AND s.taller_id = p_taller_id
    ) THEN
      RAISE EXCEPTION 'stock_id no pertenece al taller' USING ERRCODE = 'P0001';
    END IF;
    IF p_linea ? 'precio_compra' AND (p_linea ->> 'precio_compra') IS NOT NULL THEN
      v_precio_compra := (p_linea ->> 'precio_compra')::numeric;
      IF v_precio_compra < 0 THEN RAISE EXCEPTION 'precio_compra invalido' USING ERRCODE = '22023'; END IF;
    END IF;
  ELSIF v_tipo = 'NUEVO' THEN
    v_codigo := trim(coalesce(p_linea ->> 'codigo', ''));
    v_nombre := trim(coalesce(p_linea ->> 'nombre', ''));
    v_precio_compra := (p_linea ->> 'precio_compra')::numeric;
    IF v_codigo = '' OR v_nombre = '' OR v_precio_compra IS NULL OR v_precio_compra < 0 THEN
      RAISE EXCEPTION 'producto nuevo pendiente invalido' USING ERRCODE = '22023';
    END IF;
    IF (p_linea ->> 'precio_venta')::numeric IS NULL OR (p_linea ->> 'precio_venta')::numeric < 0 THEN
      RAISE EXCEPTION 'precio_venta invalido' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'tipo de repuesto pendiente invalido' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._b2c152_normalizar_pendientes(
  p_repuestos jsonb,
  p_repuestos_nuevos jsonb,
  p_cuenta_id uuid,
  p_taller_id uuid,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_linea jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_repuestos, '[]'::jsonb)) LOOP
    v_linea := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'tipo', 'EXISTENTE',
      'stock_id', v_item ->> 'stock_id',
      'cantidad', (v_item ->> 'cantidad')::integer,
      'monto_unitario', (v_item ->> 'monto_unitario')::numeric,
      'precio_compra', CASE WHEN v_item ? 'precio_compra' THEN (v_item ->> 'precio_compra')::numeric ELSE NULL END,
      'cuenta_id', CASE WHEN v_item ? 'precio_compra' AND (v_item ->> 'precio_compra') IS NOT NULL THEN p_cuenta_id::text ELSE NULL END,
      'idempotency_key', CASE WHEN v_item ? 'precio_compra' AND (v_item ->> 'precio_compra') IS NOT NULL THEN gen_random_uuid()::text ELSE NULL END,
      'categoria_arreglo_id', NULLIF(v_item ->> 'categoria_arreglo_id', ''),
      'empleado_id', NULLIF(v_item ->> 'empleado_id', '')
    );
    PERFORM public._b2c152_validar_linea(v_linea, p_taller_id, p_tenant_id);
    IF v_linea ->> 'precio_compra' IS NOT NULL AND p_cuenta_id IS NULL THEN
      RAISE EXCEPTION 'cuenta_id requerido para registrar la compra automatica' USING ERRCODE = '22023';
    END IF;
    v_result := v_result || jsonb_build_array(v_linea);
  END LOOP;
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_repuestos_nuevos, '[]'::jsonb)) LOOP
    v_linea := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'tipo', 'NUEVO',
      'stock_id', NULL,
      'codigo', trim(v_item ->> 'codigo'),
      'nombre', trim(v_item ->> 'nombre'),
      'precio_compra', (v_item ->> 'precio_compra')::numeric,
      'precio_venta', (v_item ->> 'precio_venta')::numeric,
      'monto_unitario', (v_item ->> 'precio_venta')::numeric,
      'cantidad', (v_item ->> 'cantidad')::integer,
      'cuenta_id', p_cuenta_id::text,
      'idempotency_key', gen_random_uuid()::text,
      'categoria_arreglo_id', NULLIF(v_item ->> 'categoria_arreglo_id', ''),
      'empleado_id', NULLIF(v_item ->> 'empleado_id', '')
    );
    PERFORM public._b2c152_validar_linea(v_linea, p_taller_id, p_tenant_id);
    PERFORM public._check_codigo_no_existe_en_productos(v_linea ->> 'codigo');
    v_result := v_result || jsonb_build_array(v_linea);
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public._b2c152_publicar_pendientes(p_pendientes jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_pendientes IS NULL THEN NULL ELSE coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', x ->> 'id', 'tipo', x ->> 'tipo', 'stock_id', x ->> 'stock_id',
      'codigo', x ->> 'codigo', 'nombre', x ->> 'nombre',
      'precio_compra', x ->> 'precio_compra', 'precio_venta', x ->> 'precio_venta',
      'monto_unitario', x ->> 'monto_unitario', 'cantidad', x ->> 'cantidad',
      'categoria_arreglo_id', x ->> 'categoria_arreglo_id', 'empleado_id', x ->> 'empleado_id'
    )) ORDER BY (x ->> 'id')
  ), '[]'::jsonb) END
  FROM jsonb_array_elements(coalesce(p_pendientes, '[]'::jsonb)) x;
$$;

CREATE OR REPLACE FUNCTION public.calcular_precio_final_arreglo(p_arreglo_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servicios numeric := 0;
  v_asignaciones numeric := 0;
  v_pendientes numeric := 0;
BEGIN
  SELECT coalesce(sum(cantidad * valor), 0) INTO v_servicios
  FROM public.detalle_arreglo WHERE arreglo_id = p_arreglo_id;
  SELECT coalesce(sum(ol.cantidad * ol.monto_unitario), 0) INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oaa
  JOIN public.operaciones_lineas ol ON ol.operacion_id = oaa.operacion_id
  WHERE oaa.arreglo_id = p_arreglo_id;
  SELECT coalesce(sum((x ->> 'cantidad')::numeric * (x ->> 'monto_unitario')::numeric), 0)
    INTO v_pendientes
  FROM public.arreglos a, jsonb_array_elements(coalesce(a.repuestos_pendientes, '[]'::jsonb)) x
  WHERE a.id = p_arreglo_id;
  RETURN v_servicios + v_asignaciones + v_pendientes;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_repuesto_presupuesto(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_linea_id uuid DEFAULT NULL,
  p_linea jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo public.arreglos;
  v_linea jsonb := coalesce(p_linea, '{}'::jsonb);
  v_old jsonb;
  v_items jsonb;
BEGIN
  SELECT * INTO v_arreglo FROM public.arreglos
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id AND taller_id = p_taller_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_arreglo.estado <> 'PRESUPUESTO' OR v_arreglo.repuestos_pendientes IS NULL THEN
    RAISE EXCEPTION 'El arreglo no es un presupuesto administrado' USING ERRCODE = 'P0001';
  END IF;
  IF p_linea_id IS NOT NULL THEN
    SELECT x INTO v_old FROM jsonb_array_elements(v_arreglo.repuestos_pendientes) x
    WHERE (x ->> 'id')::uuid = p_linea_id;
    IF v_old IS NULL THEN RAISE EXCEPTION 'Repuesto pendiente no encontrado' USING ERRCODE = 'P0002'; END IF;
  END IF;
  IF v_old IS NOT NULL THEN
    IF v_linea ? 'precio_compra' AND (v_linea -> 'precio_compra') IS NULL THEN
      -- Un null explicito elimina la intencion de compra y sus metadatos.
      v_linea := v_old || v_linea || jsonb_build_object(
        'cuenta_id', NULL,
        'idempotency_key', NULL
      );
    ELSE
      -- Los campos omitidos son "sin cambio": conserva precio, cuenta y clave.
      v_linea := v_old || v_linea;
      v_linea := v_linea || jsonb_build_object(
        'idempotency_key', coalesce(v_linea ->> 'idempotency_key', v_old ->> 'idempotency_key'),
        'cuenta_id', coalesce(v_linea ->> 'cuenta_id', v_old ->> 'cuenta_id')
      );
    END IF;
  END IF;
  v_linea := v_linea || jsonb_build_object('id', coalesce(p_linea_id, gen_random_uuid())::text);
  v_linea := jsonb_set(v_linea, '{tipo}', to_jsonb(upper(coalesce(v_linea ->> 'tipo', 'EXISTENTE'))), true);
  PERFORM public._b2c152_validar_linea(v_linea, p_taller_id, v_tenant_id);
  IF upper(v_linea ->> 'tipo') = 'NUEVO' THEN
    PERFORM public._check_codigo_no_existe_en_productos(v_linea ->> 'codigo');
  END IF;
  IF v_linea ->> 'cuenta_id' IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cuentas_financieras c
    WHERE c.id = (v_linea ->> 'cuenta_id')::uuid AND c.tenant_id = v_tenant_id AND c.activo
  ) THEN
    RAISE EXCEPTION 'CUENTA_FINANCIERA_REQUERIDA' USING ERRCODE = 'P0001';
  END IF;

  IF p_linea_id IS NULL THEN
    v_items := v_arreglo.repuestos_pendientes || jsonb_build_array(v_linea);
  ELSE
    SELECT coalesce(jsonb_agg(CASE WHEN (x ->> 'id')::uuid = p_linea_id THEN v_linea ELSE x END), '[]'::jsonb)
      INTO v_items FROM jsonb_array_elements(v_arreglo.repuestos_pendientes) x;
  END IF;
  UPDATE public.arreglos
  SET repuestos_pendientes = v_items,
      updated_at = now()
  WHERE id = p_arreglo_id;
  UPDATE public.arreglos
  SET precio_final = public.calcular_precio_final_arreglo(id)
  WHERE id = p_arreglo_id;
  RETURN jsonb_build_object('id', v_linea ->> 'id');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_repuesto_presupuesto(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_linea_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo public.arreglos;
  v_items jsonb;
BEGIN
  SELECT * INTO v_arreglo FROM public.arreglos
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id AND taller_id = p_taller_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_arreglo.estado <> 'PRESUPUESTO' OR v_arreglo.repuestos_pendientes IS NULL THEN
    RAISE EXCEPTION 'El arreglo no es un presupuesto administrado' USING ERRCODE = 'P0001';
  END IF;
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_items
  FROM jsonb_array_elements(v_arreglo.repuestos_pendientes) x
  WHERE (x ->> 'id')::uuid <> p_linea_id;
  IF jsonb_array_length(v_items) = jsonb_array_length(v_arreglo.repuestos_pendientes) THEN
    RAISE EXCEPTION 'Repuesto pendiente no encontrado' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.arreglos
  SET repuestos_pendientes = v_items,
      updated_at = now()
  WHERE id = p_arreglo_id;
  UPDATE public.arreglos
  SET precio_final = public.calcular_precio_final_arreglo(id)
  WHERE id = p_arreglo_id;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_crear_arreglo_completo(
  uuid, uuid, public.estado_arreglo, text, integer, timestamptz, text,
  numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid,
  timestamptz, uuid, integer, boolean
);

CREATE FUNCTION public.rpc_crear_arreglo_completo(
  p_vehiculo_id uuid,
  p_taller_id uuid,
  p_estado public.estado_arreglo,
  p_descripcion text,
  p_kilometraje_leido integer,
  p_fecha timestamptz,
  p_observaciones text,
  p_precio_final numeric,
  p_precio_sin_iva numeric,
  p_esta_pago boolean,
  p_extra_data jsonb,
  p_detalles jsonb DEFAULT '[]'::jsonb,
  p_repuestos jsonb DEFAULT '[]'::jsonb,
  p_repuestos_nuevos jsonb DEFAULT '[]'::jsonb,
  p_detalle_formulario jsonb DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_fecha_cobro timestamptz DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL,
  p_combustible_leido integer DEFAULT NULL,
  p_es_facturable boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arreglo_id uuid;
  v_pendientes jsonb;
BEGIN
  IF p_vehiculo_id IS NULL OR p_taller_id IS NULL OR p_fecha IS NULL THEN
    RAISE EXCEPTION 'vehiculo_id, taller_id y fecha son requeridos' USING ERRCODE = '22023';
  END IF;
  IF p_combustible_leido IS NOT NULL AND p_combustible_leido NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'combustible_leido debe estar entre 0 y 100' USING ERRCODE = '22023';
  END IF;
  IF p_estado = 'PRESUPUESTO' AND coalesce(p_esta_pago, false) THEN
    RAISE EXCEPTION 'No se puede crear un presupuesto como pagado' USING ERRCODE = '22023';
  END IF;
  p_detalles := coalesce(p_detalles, '[]'::jsonb);
  p_repuestos := coalesce(p_repuestos, '[]'::jsonb);
  p_repuestos_nuevos := coalesce(p_repuestos_nuevos, '[]'::jsonb);
  IF jsonb_typeof(p_detalles) <> 'array' OR jsonb_typeof(p_repuestos) <> 'array'
     OR jsonb_typeof(p_repuestos_nuevos) <> 'array' THEN
    RAISE EXCEPTION 'detalles y repuestos deben ser arrays' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_repuestos_nuevos) > 0 AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para registrar la compra automatica' USING ERRCODE = '22023';
  END IF;
  IF p_cuenta_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cuentas_financieras c
    WHERE c.id = p_cuenta_id AND c.tenant_id = public.current_tenant_id() AND c.activo
  ) THEN
    RAISE EXCEPTION 'CUENTA_FINANCIERA_REQUERIDA' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public._check_codigos_unicos_en_array(p_repuestos_nuevos);

  v_arreglo_id := public._insert_arreglo_base(
    p_vehiculo_id, p_taller_id, p_estado, p_descripcion, p_kilometraje_leido,
    p_fecha, p_observaciones, p_precio_final, p_precio_sin_iva, false, p_extra_data
  );
  PERFORM public._insert_detalles_arreglo(v_arreglo_id, p_detalles);
  PERFORM public._insert_detalle_form_custom(v_arreglo_id, p_detalle_formulario);

  IF p_estado = 'PRESUPUESTO' THEN
    v_pendientes := public._b2c152_normalizar_pendientes(
      p_repuestos, p_repuestos_nuevos, p_cuenta_id, p_taller_id, public.current_tenant_id()
    );
    UPDATE public.arreglos
    SET repuestos_pendientes = v_pendientes,
        combustible_leido = p_combustible_leido,
        precio_sin_iva = coalesce(p_precio_sin_iva, precio_sin_iva),
        es_facturable = false,
        updated_at = now()
    WHERE id = v_arreglo_id;
    UPDATE public.arreglos
    SET precio_final = public.calcular_precio_final_arreglo(id)
    WHERE id = v_arreglo_id;
    RETURN v_arreglo_id;
  END IF;

  PERFORM public._asignar_repuestos_existentes_a_arreglo(v_arreglo_id, p_taller_id, p_repuestos, p_cuenta_id, p_idempotency_key);
  PERFORM public._crear_repuestos_nuevos_para_arreglo(v_arreglo_id, p_taller_id, p_repuestos_nuevos, p_cuenta_id);
  UPDATE public.arreglos
  SET combustible_leido = p_combustible_leido,
      precio_final = coalesce(p_precio_final, precio_final),
      precio_sin_iva = coalesce(p_precio_sin_iva, precio_sin_iva),
      es_facturable = CASE WHEN (SELECT auth.jwt() ->> 'plan_sub') = 'PRO' THEN coalesce(p_es_facturable, false) ELSE false END,
      updated_at = now()
  WHERE id = v_arreglo_id;
  IF coalesce(p_esta_pago, false) THEN
    IF p_cuenta_id IS NULL OR p_idempotency_key IS NULL THEN
      RAISE EXCEPTION 'cuenta_id e idempotency_key requeridos para registrar el cobro' USING ERRCODE = '22023';
    END IF;
    PERFORM public.rpc_finanzas_cobrar_arreglo(v_arreglo_id, p_cuenta_id, coalesce(p_precio_final, 0), coalesce(p_fecha_cobro, p_fecha), NULL, p_idempotency_key);
  END IF;
  RETURN v_arreglo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_activar_presupuesto(
  p_arreglo_id uuid,
  p_nuevo_estado public.estado_arreglo
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo public.arreglos;
  v_linea jsonb;
  v_pendientes jsonb;
  v_tipo text;
BEGIN
  IF p_nuevo_estado IS NULL OR p_nuevo_estado = 'PRESUPUESTO' THEN
    RAISE EXCEPTION 'Estado de activacion invalido' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_arreglo FROM public.arreglos
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_arreglo.estado <> 'PRESUPUESTO' THEN
    IF v_arreglo.estado = p_nuevo_estado THEN RETURN true; END IF;
    RAISE EXCEPTION 'El arreglo ya fue activado y no admite esta transicion' USING ERRCODE = 'P0001';
  END IF;

  IF v_arreglo.repuestos_pendientes IS NOT NULL THEN
    v_pendientes := v_arreglo.repuestos_pendientes;
    FOR v_linea IN SELECT x FROM jsonb_array_elements(v_pendientes) x ORDER BY x ->> 'id' LOOP
      PERFORM public._b2c152_validar_linea(v_linea, v_arreglo.taller_id, v_tenant_id);
    END LOOP;
    -- Vaciar primero el borrador para que los triggers de asignacion no sumen
    -- la misma linea pendiente junto con la linea ya materializada.
    UPDATE public.arreglos
    SET repuestos_pendientes = NULL, updated_at = now()
    WHERE id = p_arreglo_id;
    PERFORM set_config('b2c152.activation', 'on', true);
    FOR v_linea IN SELECT x FROM jsonb_array_elements(v_pendientes) x ORDER BY x ->> 'id' LOOP
      v_tipo := upper(v_linea ->> 'tipo');
      IF v_tipo = 'EXISTENTE' THEN
        PERFORM public.rpc_asignar_repuesto_existente_con_compra(
          p_arreglo_id := p_arreglo_id,
          p_taller_id := v_arreglo.taller_id,
          p_stock_id := (v_linea ->> 'stock_id')::uuid,
          p_cantidad := (v_linea ->> 'cantidad')::integer,
          p_monto_unitario := (v_linea ->> 'monto_unitario')::numeric,
          p_precio_compra := NULLIF(v_linea ->> 'precio_compra', '')::numeric,
          p_categoria_arreglo_id := NULLIF(v_linea ->> 'categoria_arreglo_id', '')::uuid,
          p_empleado_id := NULLIF(v_linea ->> 'empleado_id', '')::uuid,
          p_cuenta_id := NULLIF(v_linea ->> 'cuenta_id', '')::uuid,
          p_idempotency_key := NULLIF(v_linea ->> 'idempotency_key', '')::uuid
        );
      ELSE
        PERFORM public.rpc_crear_producto_inline_para_arreglo(
          p_arreglo_id := p_arreglo_id,
          p_taller_id := v_arreglo.taller_id,
          p_codigo := v_linea ->> 'codigo',
          p_nombre := v_linea ->> 'nombre',
          p_precio_compra := (v_linea ->> 'precio_compra')::numeric,
          p_precio_venta := (v_linea ->> 'precio_venta')::numeric,
          p_cantidad := (v_linea ->> 'cantidad')::integer,
          p_categoria_arreglo_id := NULLIF(v_linea ->> 'categoria_arreglo_id', '')::uuid,
          p_empleado_id := NULLIF(v_linea ->> 'empleado_id', '')::uuid,
          p_cuenta_id := NULLIF(v_linea ->> 'cuenta_id', '')::uuid,
          p_idempotency_key := NULLIF(v_linea ->> 'idempotency_key', '')::uuid
        );
      END IF;
    END LOOP;
    UPDATE public.arreglos
    SET estado = p_nuevo_estado,
        precio_final = public.calcular_precio_final_arreglo(id),
        updated_at = now()
    WHERE id = p_arreglo_id;
  ELSE
    -- Presupuesto historico: sus asignaciones ya existen y no deben duplicarse.
    PERFORM set_config('b2c152.activation', 'on', true);
    UPDATE public.arreglos SET estado = p_nuevo_estado, updated_at = now() WHERE id = p_arreglo_id;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_arreglo_detalle(
  p_arreglo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo jsonb;
  v_detalles jsonb;
  v_asignaciones jsonb;
  v_cobros jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  SELECT jsonb_build_object(
    'id', a.id, 'vehiculo', to_jsonb(v), 'taller_id', a.taller_id, 'taller', to_jsonb(t),
    'categoria', coalesce((SELECT string_agg(ca.nombre, ', ') FROM unnest(a.categorias) c_id JOIN public.categorias_arreglo ca ON ca.id = c_id), ''),
    'categorias', a.categorias, 'empleados', a.empleados,
    'empleados_detallados', public.arreglos_empleados_detallados(a),
    'estado', a.estado, 'descripcion', a.descripcion, 'kilometraje_leido', a.kilometraje_leido,
    'combustible_leido', a.combustible_leido, 'fecha', a.fecha, 'observaciones', a.observaciones,
    'precio_final', a.precio_final, 'precio_sin_iva', a.precio_sin_iva, 'esta_pago', a.esta_pago,
    'total_cobrado', a.total_cobrado,
    'saldo_pendiente', greatest(0, coalesce(a.precio_final, 0) - coalesce(a.total_cobrado, 0)),
    'extra_data', a.extra_data, 'cliente_id', a.cliente_id, 'es_facturable', a.es_facturable,
    'repuestos_pendientes', public._b2c152_publicar_pendientes(a.repuestos_pendientes)
  ) INTO v_arreglo
  FROM public.arreglos a
  JOIN public.vehiculos v ON v.id = a.vehiculo_id
  LEFT JOIN public.talleres t ON t.id = a.taller_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id;
  IF v_arreglo IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'arreglo_id', d.arreglo_id, 'descripcion', d.descripcion, 'cantidad', d.cantidad,
    'valor', d.valor, 'categoria_arreglo_id', d.categoria_arreglo_id, 'empleado_id', d.empleado_id,
    'created_at', d.created_at, 'updated_at', d.updated_at
  ) ORDER BY d.created_at), '[]'::jsonb) INTO v_detalles
  FROM public.detalle_arreglo d WHERE d.arreglo_id = p_arreglo_id AND d.tenant_id = v_tenant_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'tipo', o.tipo, 'taller_id', o.taller_id, 'created_at', o.created_at,
    'lineas', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id, 'cantidad', l.cantidad,
      'monto_unitario', l.monto_unitario, 'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at,
      'categoria_arreglo_id', l.categoria_arreglo_id, 'empleado_id', l.empleado_id,
      'producto', jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre,
        'precio_unitario', p.precio_unitario, 'costo_unitario', p.costo_unitario,
        'proveedor', p.proveedor, 'categorias', coalesce(p.categorias, ARRAY[]::text[]))
    ) ORDER BY l.created_at) FROM public.operaciones_lineas l
      JOIN public.stocks s ON s.id = l.stock_id JOIN public.productos p ON p.id = s.producto_id
      WHERE l.operacion_id = o.id), '[]'::jsonb)
  ) ORDER BY o.created_at), '[]'::jsonb) INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oa
  JOIN public.operaciones o ON o.id = oa.operacion_id
  WHERE oa.arreglo_id = p_arreglo_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', omc.operacion_id, 'operacion_id', omc.operacion_id, 'importe', omc.importe,
    'cuenta_id', omc.cuenta_id, 'cuenta_nombre', cf.nombre, 'descripcion', omc.descripcion,
    'fecha', o.fecha, 'created_at', omc.created_at
  ) ORDER BY o.fecha ASC, omc.created_at ASC), '[]'::jsonb) INTO v_cobros
  FROM public.operaciones_cobro_arreglo oca
  JOIN public.operaciones o ON o.id = oca.operacion_id
  JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = oca.operacion_id
  JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
  WHERE oca.arreglo_id = p_arreglo_id AND oca.tenant_id = v_tenant_id;

  RETURN jsonb_build_object('arreglo', v_arreglo, 'detalles', v_detalles,
    'asignaciones', v_asignaciones, 'cobros', v_cobros);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_arreglo_detalle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_arreglo_detalle(uuid) TO authenticated, service_role;

-- La guarda de insercion bloquea tambien llamadas directas a las RPC operativas.
-- La activacion la habilita de forma transaccional con set_config(..., true).

REVOKE ALL ON FUNCTION public._b2c152_activacion_guardada() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._b2c152_guardar_estado_arreglo() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._b2c152_guardar_asignacion() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._b2c152_validar_linea(jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._b2c152_normalizar_pendientes(jsonb, jsonb, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._b2c152_publicar_pendientes(jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_upsert_repuesto_presupuesto(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_delete_repuesto_presupuesto(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_activar_presupuesto(uuid, public.estado_arreglo) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_repuesto_presupuesto(uuid, uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_delete_repuesto_presupuesto(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_activar_presupuesto(uuid, public.estado_arreglo) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_crear_arreglo_completo(
  uuid, uuid, public.estado_arreglo, text, integer, timestamptz, text,
  numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid,
  timestamptz, uuid, integer, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_arreglo_completo(
  uuid, uuid, public.estado_arreglo, text, integer, timestamptz, text,
  numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid,
  timestamptz, uuid, integer, boolean
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
