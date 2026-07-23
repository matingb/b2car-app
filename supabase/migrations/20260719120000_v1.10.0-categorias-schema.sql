-- v1.10.0 - Catalogo de categorias de arreglo + columnas de categoria/empleado a nivel de linea.
-- Reemplaza al texto libre `arreglos.tipo`. categoria_arreglo_id/empleado_id se agregan tanto a
-- detalle_arreglo (mano de obra) como a operaciones_lineas (repuestos asignados a un arreglo).

CREATE TABLE IF NOT EXISTS public.categorias_arreglo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categorias_arreglo_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.categorias_arreglo OWNER TO postgres;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_arreglo_tenant_nombre_lower
  ON public.categorias_arreglo (tenant_id, lower(nombre));

CREATE INDEX IF NOT EXISTS idx_categorias_arreglo_tenant_id ON public.categorias_arreglo USING btree (tenant_id);

CREATE OR REPLACE TRIGGER categorias_arreglo_set_updated_at
  BEFORE UPDATE ON public.categorias_arreglo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.categorias_arreglo ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_access ON public.categorias_arreglo
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_arreglo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_arreglo TO service_role;

-- ===========================================================================
-- Lineas de mano de obra: categoria y empleado por linea.
-- ===========================================================================

ALTER TABLE public.detalle_arreglo
  ADD COLUMN IF NOT EXISTS categoria_arreglo_id uuid REFERENCES public.categorias_arreglo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_detalle_arreglo_categoria_arreglo_id
  ON public.detalle_arreglo (tenant_id, categoria_arreglo_id);
CREATE INDEX IF NOT EXISTS idx_detalle_arreglo_empleado_id
  ON public.detalle_arreglo (tenant_id, empleado_id);

-- ===========================================================================
-- Lineas de repuestos asignados a un arreglo
-- ===========================================================================

ALTER TABLE public.operaciones_lineas
  ADD COLUMN IF NOT EXISTS categoria_arreglo_id uuid REFERENCES public.categorias_arreglo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operaciones_lineas_categoria_arreglo_id
  ON public.operaciones_lineas (categoria_arreglo_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_lineas_empleado_id
  ON public.operaciones_lineas (empleado_id);

-- ===========================================================================
-- Arreglos: listas derivadas materializadas
-- ===========================================================================

ALTER TABLE public.arreglos
  ADD COLUMN IF NOT EXISTS categorias uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS empleados uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_arreglos_categorias ON public.arreglos USING gin (categorias);
CREATE INDEX IF NOT EXISTS idx_arreglos_empleados ON public.arreglos USING gin (empleados);

-- ===========================================================================
-- Formularios custom
-- ===========================================================================

ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS categoria_arreglo_id uuid REFERENCES public.categorias_arreglo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_formularios_categoria_arreglo_id ON public.formularios (categoria_arreglo_id);

-- ===========================================================================
-- Triggers de sincronización de arreglos.categorias y arreglos.empleados
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._sync_arreglo_derivados(p_arreglo_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_categorias uuid[];
  v_empleados uuid[];
BEGIN
  IF p_arreglo_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(ARRAY_AGG(DISTINCT cat_id) FILTER (WHERE cat_id IS NOT NULL), '{}'),
    COALESCE(ARRAY_AGG(DISTINCT empleado_id) FILTER (WHERE empleado_id IS NOT NULL), '{}')
  INTO v_categorias, v_empleados
  FROM (
    SELECT d.categoria_arreglo_id AS cat_id, d.empleado_id AS empleado_id
    FROM public.detalle_arreglo d
    WHERE d.arreglo_id = p_arreglo_id

    UNION ALL

    SELECT ol.categoria_arreglo_id AS cat_id, ol.empleado_id AS empleado_id
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    WHERE oa.arreglo_id = p_arreglo_id
  ) usos;

  UPDATE public.arreglos
  SET categorias = v_categorias,
      empleados = v_empleados
  WHERE id = p_arreglo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public._sync_arreglo_derivados(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._sync_arreglo_derivados(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._trg_detalle_arreglo_sync_derivados()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._sync_arreglo_derivados(OLD.arreglo_id);
    RETURN OLD;
  END IF;

  PERFORM public._sync_arreglo_derivados(NEW.arreglo_id);
  IF TG_OP = 'UPDATE' AND OLD.arreglo_id IS DISTINCT FROM NEW.arreglo_id THEN
    PERFORM public._sync_arreglo_derivados(OLD.arreglo_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS detalle_arreglo_sync_derivados ON public.detalle_arreglo;
CREATE TRIGGER detalle_arreglo_sync_derivados
  AFTER INSERT OR UPDATE OF categoria_arreglo_id, empleado_id OR DELETE ON public.detalle_arreglo
  FOR EACH ROW EXECUTE FUNCTION public._trg_detalle_arreglo_sync_derivados();

CREATE OR REPLACE FUNCTION public._trg_operaciones_lineas_sync_derivados()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_arreglo_id uuid;
  v_old_arreglo_id uuid;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = NEW.operacion_id;

    PERFORM public._sync_arreglo_derivados(v_arreglo_id);
  END IF;

  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    SELECT oa.arreglo_id INTO v_old_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = OLD.operacion_id;

    IF v_old_arreglo_id IS NOT NULL AND v_old_arreglo_id IS DISTINCT FROM v_arreglo_id THEN
      PERFORM public._sync_arreglo_derivados(v_old_arreglo_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS operaciones_lineas_sync_derivados ON public.operaciones_lineas;
CREATE TRIGGER operaciones_lineas_sync_derivados
  AFTER INSERT OR UPDATE OF categoria_arreglo_id, empleado_id OR DELETE ON public.operaciones_lineas
  FOR EACH ROW EXECUTE FUNCTION public._trg_operaciones_lineas_sync_derivados();


-- ===========================================================================
-- rpc_set_asignacion_arreglo_linea
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, int, numeric);
DROP FUNCTION IF EXISTS public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, int, numeric, uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_set_asignacion_arreglo_linea(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_stock_id uuid,
  p_cantidad int,
  p_monto_unitario numeric(12,2) DEFAULT 0,
  p_categoria_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_operacion_id uuid;
  v_taller_id uuid;
  v_arreglo_fecha timestamp with time zone;
  v_linea_id uuid;
  v_old_delta int;
  v_new_delta int;
  v_delta_diff int;
  v_rowcount int;
  v_stock_taller_id uuid;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida (%)', p_cantidad; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario inválido (%)', p_monto_unitario; END IF;

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado'; END IF;

  SELECT oa.operacion_id INTO v_operacion_id
  FROM public.operaciones_asignacion_arreglo oa
  WHERE oa.arreglo_id = p_arreglo_id LIMIT 1;

  IF v_operacion_id IS NULL THEN
    INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
    VALUES (v_tenant_id, 'ASIGNACION_ARREGLO', p_taller_id, v_arreglo_fecha)
    RETURNING id INTO v_operacion_id;

    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);

    v_taller_id := p_taller_id;
  ELSE
    SELECT o.taller_id INTO v_taller_id
    FROM public.operaciones o
    WHERE o.id = v_operacion_id AND o.tenant_id = v_tenant_id;

    IF v_taller_id IS NULL THEN RAISE EXCEPTION 'operación % no encontrada', v_operacion_id; END IF;
    IF v_taller_id <> p_taller_id THEN RAISE EXCEPTION 'taller_id no coincide'; END IF;
  END IF;

  SELECT s.taller_id INTO v_stock_taller_id
  FROM public.stocks s WHERE s.id = p_stock_id FOR UPDATE;

  IF v_stock_taller_id IS NULL THEN RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id; END IF;
  IF v_stock_taller_id <> v_taller_id THEN RAISE EXCEPTION 'stock_id no pertenece al taller'; END IF;

  SELECT l.id, l.delta_cantidad INTO v_linea_id, v_old_delta
  FROM public.operaciones_lineas l
  WHERE l.operacion_id = v_operacion_id AND l.stock_id = p_stock_id LIMIT 1;

  v_new_delta := -p_cantidad;
  v_delta_diff := v_new_delta - COALESCE(v_old_delta, 0);

  IF v_delta_diff < 0 THEN
    UPDATE public.stocks s
    SET cantidad = s.cantidad + v_delta_diff, updated_at = now()
    WHERE s.id = p_stock_id AND s.cantidad >= (-v_delta_diff);

    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', p_stock_id; END IF;
  ELSIF v_delta_diff > 0 THEN
    UPDATE public.stocks s
    SET cantidad = s.cantidad + v_delta_diff, updated_at = now()
    WHERE s.id = p_stock_id;
  END IF;

  IF v_linea_id IS NULL THEN
    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad, categoria_arreglo_id, empleado_id
    ) VALUES (
      v_operacion_id, p_stock_id, p_cantidad, p_monto_unitario, v_new_delta, p_categoria_arreglo_id, p_empleado_id
    );
  ELSE
    UPDATE public.operaciones_lineas
    SET cantidad = p_cantidad, monto_unitario = p_monto_unitario, delta_cantidad = v_new_delta,
        categoria_arreglo_id = p_categoria_arreglo_id, empleado_id = p_empleado_id
    WHERE id = v_linea_id;
  END IF;

  RETURN v_operacion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_set_asignacion_arreglo_linea(uuid, uuid, uuid, int, numeric, uuid, uuid) TO authenticated;

-- ===========================================================================
-- rpc_asignar_repuesto_existente_con_compra
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric);
DROP FUNCTION IF EXISTS public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric, uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_asignar_repuesto_existente_con_compra(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_stock_id uuid,
  p_cantidad int,
  p_monto_unitario numeric(12,2),
  p_precio_compra numeric(12,2) DEFAULT NULL,
  p_categoria_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_arreglo_fecha timestamp with time zone;
  v_stock_cantidad int;
  v_old_cantidad int;
  v_delta_diff int;
  v_faltante int;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF p_stock_id IS NULL THEN RAISE EXCEPTION 'stock_id requerido'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida'; END IF;
  IF p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN RAISE EXCEPTION 'monto_unitario inválido'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id;

  SELECT s.cantidad INTO v_stock_cantidad
  FROM public.stocks s
  WHERE s.id = p_stock_id AND s.tenant_id = v_tenant_id AND s.taller_id = p_taller_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id; END IF;

  SELECT abs(l.delta_cantidad) INTO v_old_cantidad
  FROM public.operaciones_lineas l
  JOIN public.operaciones o ON o.id = l.operacion_id
  JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
  WHERE oa.arreglo_id = p_arreglo_id AND l.stock_id = p_stock_id AND o.tipo = 'ASIGNACION_ARREGLO' AND o.tenant_id = v_tenant_id;

  v_old_cantidad := coalesce(v_old_cantidad, 0);
  v_delta_diff := p_cantidad - v_old_cantidad;
  v_faltante := greatest(0, v_delta_diff - v_stock_cantidad);

  IF v_faltante > 0 THEN
    IF p_precio_compra IS NULL OR p_precio_compra <= 0 THEN
      RAISE EXCEPTION 'PRECIO_COMPRA_REQUERIDO faltante=%', v_faltante USING ERRCODE = 'P0001';
    END IF;

    PERFORM public.rpc_crear_operacion_con_stock(
      p_tipo := 'COMPRA'::public.tipo_operacion,
      p_taller_id := p_taller_id,
      p_lineas := jsonb_build_array(jsonb_build_object(
        'stock_id', p_stock_id,
        'cantidad', v_faltante,
        'monto_unitario', p_precio_compra
      )),
      p_arreglo_id := NULL,
      p_fecha := v_arreglo_fecha
    );
  END IF;

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := p_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_monto_unitario,
    p_categoria_arreglo_id := p_categoria_arreglo_id,
    p_empleado_id := p_empleado_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric, uuid, uuid) TO authenticated;

-- ===========================================================================
-- rpc_crear_producto_inline_para_arreglo
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int);
DROP FUNCTION IF EXISTS public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int, uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_crear_producto_inline_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_codigo text,
  p_nombre text,
  p_precio_compra numeric(12,2),
  p_precio_venta numeric(12,2),
  p_cantidad int,
  p_categoria_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_stock_id uuid;
  v_arreglo_fecha timestamp with time zone;
  v_codigo text := trim(coalesce(p_codigo, ''));
  v_nombre text := trim(coalesce(p_nombre, ''));
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF v_codigo = '' THEN RAISE EXCEPTION 'codigo requerido'; END IF;
  IF v_nombre = '' THEN RAISE EXCEPTION 'nombre requerido'; END IF;
  IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN RAISE EXCEPTION 'precio_compra invalido'; END IF;
  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN RAISE EXCEPTION 'precio_venta invalido'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad invalida'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);
  PERFORM public._check_codigo_no_existe_en_productos(v_codigo);

  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id;

  v_stock_id := public._crear_producto_y_stock(
    p_taller_id := p_taller_id, p_codigo := v_codigo, p_nombre := v_nombre,
    p_precio_compra := p_precio_compra, p_precio_venta := p_precio_venta
  );

  PERFORM public.rpc_crear_operacion_con_stock(
    p_tipo := 'COMPRA'::public.tipo_operacion,
    p_taller_id := p_taller_id,
    p_lineas := jsonb_build_array(jsonb_build_object(
      'stock_id', v_stock_id, 'cantidad', p_cantidad, 'monto_unitario', p_precio_compra
    )),
    p_arreglo_id := NULL,
    p_fecha := v_arreglo_fecha
  );

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id, p_taller_id := p_taller_id, p_stock_id := v_stock_id,
    p_cantidad := p_cantidad, p_monto_unitario := p_precio_venta,
    p_categoria_arreglo_id := p_categoria_arreglo_id, p_empleado_id := p_empleado_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int, uuid, uuid) TO authenticated;

-- ===========================================================================
-- Helpers de rpc_crear_arreglo_completo
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._insert_detalles_arreglo(
  p_arreglo_id uuid,
  p_detalles jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_item jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN RETURN; END IF;

  PERFORM 1 FROM public.arreglos WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles) LOOP
    INSERT INTO public.detalle_arreglo (
      tenant_id, arreglo_id, descripcion, cantidad, valor, categoria_arreglo_id, empleado_id
    ) VALUES (
      v_tenant_id, p_arreglo_id, trim(coalesce(v_item ->> 'descripcion', '')),
      (v_item ->> 'cantidad')::int, (v_item ->> 'valor')::numeric,
      NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      NULLIF(v_item ->> 'empleado_id', '')::uuid
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._asignar_repuestos_existentes_a_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_repuestos jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos IS NULL OR jsonb_array_length(p_repuestos) = 0 THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos) LOOP
    PERFORM public.rpc_asignar_repuesto_existente_con_compra(
      p_arreglo_id := p_arreglo_id, p_taller_id := p_taller_id,
      p_stock_id := (v_item ->> 'stock_id')::uuid, p_cantidad := (v_item ->> 'cantidad')::int,
      p_monto_unitario := (v_item ->> 'monto_unitario')::numeric,
      p_precio_compra := NULLIF(v_item ->> 'precio_compra', '')::numeric,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._crear_repuestos_nuevos_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_repuestos_nuevos jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos_nuevos IS NULL OR jsonb_array_length(p_repuestos_nuevos) = 0 THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos_nuevos) LOOP
    PERFORM public.rpc_crear_producto_inline_para_arreglo(
      p_arreglo_id := p_arreglo_id, p_taller_id := p_taller_id,
      p_codigo := v_item ->> 'codigo', p_nombre := v_item ->> 'nombre',
      p_precio_compra := (v_item ->> 'precio_compra')::numeric,
      p_precio_venta := (v_item ->> 'precio_venta')::numeric,
      p_cantidad := (v_item ->> 'cantidad')::int,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid
    );
  END LOOP;
END;
$$;

-- ===========================================================================
-- rpc_crear_arreglo_completo sin p_tipo
-- ===========================================================================

DROP FUNCTION IF EXISTS public._insert_arreglo_base(uuid, uuid, text, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb);
DROP FUNCTION IF EXISTS public.rpc_crear_arreglo_completo(uuid, uuid, text, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public._insert_arreglo_base(
  p_vehiculo_id uuid,
  p_taller_id uuid,
  p_estado public.estado_arreglo,
  p_descripcion text,
  p_kilometraje_leido int,
  p_fecha timestamptz,
  p_observaciones text,
  p_precio_final numeric,
  p_precio_sin_iva numeric,
  p_esta_pago boolean,
  p_extra_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_arreglo_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;

  INSERT INTO public.arreglos (
    tenant_id, vehiculo_id, taller_id, estado, descripcion,
    kilometraje_leido, fecha, observaciones, precio_final, precio_sin_iva,
    esta_pago, extra_data
  ) VALUES (
    v_tenant_id, p_vehiculo_id, p_taller_id,
    coalesce(p_estado, 'SIN_INICIAR'::public.estado_arreglo),
    p_descripcion, coalesce(p_kilometraje_leido, 0),
    p_fecha, p_observaciones,
    coalesce(p_precio_final, 0), coalesce(p_precio_sin_iva, 0),
    coalesce(p_esta_pago, false), p_extra_data
  ) RETURNING id INTO v_arreglo_id;

  RETURN v_arreglo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_crear_arreglo_completo(
  p_vehiculo_id uuid,
  p_taller_id uuid,
  p_estado public.estado_arreglo,
  p_descripcion text,
  p_kilometraje_leido int,
  p_fecha timestamptz,
  p_observaciones text,
  p_precio_final numeric(10,2),
  p_precio_sin_iva numeric(10,2),
  p_esta_pago boolean,
  p_extra_data jsonb,
  p_detalles jsonb DEFAULT '[]'::jsonb,
  p_repuestos jsonb DEFAULT '[]'::jsonb,
  p_repuestos_nuevos jsonb DEFAULT '[]'::jsonb,
  p_detalle_formulario jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_arreglo_id uuid;
BEGIN
  IF p_vehiculo_id IS NULL THEN RAISE EXCEPTION 'vehiculo_id requerido'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido'; END IF;
  IF p_fecha IS NULL THEN RAISE EXCEPTION 'fecha requerida'; END IF;

  p_detalles := COALESCE(p_detalles, '[]'::jsonb);
  p_repuestos := COALESCE(p_repuestos, '[]'::jsonb);
  p_repuestos_nuevos := COALESCE(p_repuestos_nuevos, '[]'::jsonb);

  IF jsonb_typeof(p_detalles) <> 'array' THEN RAISE EXCEPTION 'detalles debe ser array'; END IF;
  IF jsonb_typeof(p_repuestos) <> 'array' THEN RAISE EXCEPTION 'repuestos debe ser array'; END IF;
  IF jsonb_typeof(p_repuestos_nuevos) <> 'array' THEN RAISE EXCEPTION 'repuestos_nuevos debe ser array'; END IF;

  PERFORM public._check_codigos_unicos_en_array(p_repuestos_nuevos);

  v_arreglo_id := public._insert_arreglo_base(
    p_vehiculo_id := p_vehiculo_id,
    p_taller_id := p_taller_id,
    p_estado := p_estado,
    p_descripcion := p_descripcion,
    p_kilometraje_leido := p_kilometraje_leido,
    p_fecha := p_fecha,
    p_observaciones := p_observaciones,
    p_precio_final := p_precio_final,
    p_precio_sin_iva := p_precio_sin_iva,
    p_esta_pago := p_esta_pago,
    p_extra_data := p_extra_data
  );

  PERFORM public._insert_detalles_arreglo(v_arreglo_id, p_detalles);
  PERFORM public._insert_detalle_form_custom(v_arreglo_id, p_detalle_formulario);
  PERFORM public._asignar_repuestos_existentes_a_arreglo(v_arreglo_id, p_taller_id, p_repuestos);
  PERFORM public._crear_repuestos_nuevos_para_arreglo(v_arreglo_id, p_taller_id, p_repuestos_nuevos);

  UPDATE public.arreglos
  SET precio_final = coalesce(p_precio_final, precio_final),
      precio_sin_iva = coalesce(p_precio_sin_iva, precio_sin_iva),
      updated_at = now()
  WHERE id = v_arreglo_id;

  RETURN v_arreglo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public._insert_arreglo_base(uuid, uuid, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_crear_arreglo_completo(uuid, uuid, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;

-- ===========================================================================
-- Backfill de datos existentes
-- ===========================================================================

INSERT INTO public.categorias_arreglo (tenant_id, nombre)
SELECT DISTINCT ON (a.tenant_id, lower(trim(a.tipo))) a.tenant_id, trim(a.tipo)
FROM public.arreglos a
WHERE a.tipo IS NOT NULL AND trim(a.tipo) <> ''
ORDER BY a.tenant_id, lower(trim(a.tipo)), a.created_at ASC
ON CONFLICT (tenant_id, lower(nombre)) DO NOTHING;

UPDATE public.detalle_arreglo d
SET categoria_arreglo_id = c.id
FROM public.arreglos a
JOIN public.categorias_arreglo c ON c.tenant_id = a.tenant_id AND lower(c.nombre) = lower(trim(a.tipo))
WHERE d.arreglo_id = a.id AND d.categoria_arreglo_id IS NULL AND a.tipo IS NOT NULL AND trim(a.tipo) <> '';

UPDATE public.formularios f
SET categoria_arreglo_id = c.id
FROM public.categorias_arreglo c
WHERE f.tenant_id = c.tenant_id AND lower(trim(f.descripcion)) = lower(c.nombre) AND f.categoria_arreglo_id IS NULL;

DO $$
DECLARE
  v_arreglo record;
BEGIN
  FOR v_arreglo IN SELECT id FROM public.arreglos LOOP
    PERFORM public._sync_arreglo_derivados(v_arreglo.id);
  END LOOP;
END;
$$;

-- Borrar tipo de arreglos
ALTER TABLE public.arreglos DROP COLUMN IF EXISTS tipo;

-- ===========================================================================
-- Dashboard RPCs
-- ===========================================================================

DROP FUNCTION IF EXISTS public.dashboard_tipos_con_ingresos(integer, timestamptz, timestamptz, uuid);
DROP FUNCTION IF EXISTS public.dashboard_facturacion_por_tipo(integer, timestamptz, timestamptz, uuid);
DROP FUNCTION IF EXISTS public.dashboard_costo_por_tipo(integer, timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.dashboard_facturacion_por_categoria(
  top         integer     DEFAULT 6,
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE sql
SET search_path = public
AS $$
  WITH lineas AS (
    SELECT d.categoria_arreglo_id AS cat_id, (d.cantidad * d.valor)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)

    UNION ALL

    SELECT ol.categoria_arreglo_id AS cat_id, (ol.cantidad * ol.monto_unitario)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
  ),
  agg AS (
    SELECT
      COALESCE(c.nombre, 'Sin categoría')::text AS label,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.categorias_arreglo c ON c.id = l.cat_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto,
           ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn
    FROM agg
  ),
  top_rows AS (
    SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto
    FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.label, s.cantidad, s.monto
  FROM (
    SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows
    UNION ALL
    SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_facturacion_por_empleado(
  top         integer     DEFAULT 6,
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE sql
SET search_path = public
AS $$
  WITH lineas AS (
    SELECT d.empleado_id AS empleado_id, (d.cantidad * d.valor)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from) AND (p_to IS NULL OR a.fecha < p_to) AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)

    UNION ALL

    SELECT ol.empleado_id AS empleado_id, (ol.cantidad * ol.monto_unitario)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from) AND (p_to IS NULL OR a.fecha < p_to) AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
  ),
  agg AS (
    SELECT COALESCE(NULLIF(trim(e.nombre || ' ' || e.apellido), ''), 'Sin asignar')::text AS label, COUNT(*)::int AS cantidad, COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.empleados e ON e.id = l.empleado_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto, ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn FROM agg
  ),
  top_rows AS (SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)),
  otros AS (SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0))
  SELECT s.label, s.cantidad, s.monto
  FROM (SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows UNION ALL SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_costo_por_categoria(
  top         integer     DEFAULT 6,
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE sql
SET search_path = public
AS $$
  WITH lineas AS (
    SELECT ol.categoria_arreglo_id AS cat_id, (ol.cantidad * p.costo_unitario)::numeric AS costo
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    JOIN public.stocks s ON s.id = ol.stock_id
    JOIN public.productos p ON p.id = s.producto_id
    WHERE (p_from IS NULL OR a.fecha >= p_from) AND (p_to IS NULL OR a.fecha < p_to) AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
  ),
  agg AS (
    SELECT COALESCE(c.nombre, 'Sin categoría')::text AS label, COUNT(*)::int AS cantidad, COALESCE(SUM(l.costo), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.categorias_arreglo c ON c.id = l.cat_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto, ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn FROM agg
  ),
  top_rows AS (SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)),
  otros AS (SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0))
  SELECT s.label, s.cantidad, s.monto
  FROM (SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows UNION ALL SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_costo_por_empleado(
  p_from      timestamptz,
  p_to        timestamptz,
  top         integer     DEFAULT 6,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN RAISE EXCEPTION 'p_from y p_to son obligatorios'; END IF;
  RETURN QUERY
  WITH repuestos AS (
    SELECT ol.empleado_id AS empleado_id, COUNT(*)::int AS cantidad, COALESCE(SUM(ol.cantidad * p.costo_unitario), 0)::numeric AS costo
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    JOIN public.stocks s ON s.id = ol.stock_id
    JOIN public.productos p ON p.id = s.producto_id
    WHERE a.fecha >= p_from AND a.fecha < p_to AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
    GROUP BY 1
  ),
  meses AS (SELECT generate_series(date_trunc('month', p_from), date_trunc('month', p_to - interval '1 second'), interval '1 month') AS mes_start),
  sueldos AS (
    SELECT e.id AS empleado_id, COALESCE(SUM(eff.salario), 0)::numeric AS sueldo
    FROM public.empleados e
    JOIN meses m ON true
    LEFT JOIN LATERAL (SELECT es.salario FROM public.empleado_salarios es WHERE es.empleado_id = e.id AND es.vigente_desde < (m.mes_start + interval '1 month')::date ORDER BY es.vigente_desde DESC LIMIT 1) eff ON true
    WHERE (p_taller_id IS NULL OR e.taller_id = p_taller_id) AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
    GROUP BY 1 HAVING COALESCE(SUM(eff.salario), 0) > 0
  ),
  agg AS (
    SELECT COALESCE(NULLIF(trim(e.nombre || ' ' || e.apellido), ''), 'Sin asignar')::text AS label, COALESCE(r.cantidad, 0) AS cantidad, (COALESCE(r.costo, 0) + COALESCE(su.sueldo, 0))::numeric AS monto
    FROM repuestos r
    FULL OUTER JOIN sueldos su ON su.empleado_id = r.empleado_id
    LEFT JOIN public.empleados e ON e.id = COALESCE(r.empleado_id, su.empleado_id)
  ),
  ranked AS (SELECT agg.label, agg.cantidad, agg.monto, ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn FROM agg),
  top_rows AS (SELECT ranked.label, ranked.cantidad, ranked.monto FROM ranked WHERE ranked.rn <= GREATEST(COALESCE(top, 0), 0)),
  otros AS (SELECT 'Otros'::text AS label, COALESCE(SUM(ranked.cantidad), 0)::int AS cantidad, COALESCE(SUM(ranked.monto), 0)::numeric AS monto FROM ranked WHERE ranked.rn > GREATEST(COALESCE(top, 0), 0))
  SELECT s.label, s.cantidad, s.monto FROM (SELECT top_rows.label, top_rows.cantidad, top_rows.monto, 0 AS sort_group FROM top_rows UNION ALL SELECT otros.label, otros.cantidad, otros.monto, 1 AS sort_group FROM otros WHERE otros.monto > 0) s ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_facturacion_por_categoria(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_facturacion_por_empleado(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_costo_por_categoria(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_costo_por_empleado(timestamptz, timestamptz, integer, uuid) TO authenticated, service_role;

-- ===========================================================================
-- rpc_get_arreglo_detalle
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_get_arreglo_detalle(uuid);

CREATE OR REPLACE FUNCTION public.rpc_get_arreglo_detalle(
  p_arreglo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_arreglo jsonb;
  v_detalles jsonb;
  v_asignaciones jsonb;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;

  SELECT
    jsonb_build_object(
      'id', a.id,
      'vehiculo', to_jsonb(v),
      'taller_id', a.taller_id,
      'taller', to_jsonb(t),
      'categoria', COALESCE(
        (SELECT string_agg(ca.nombre, ', ') FROM unnest(a.categorias) AS c_id JOIN public.categorias_arreglo ca ON ca.id = c_id),
        ''
      ),
      'categorias', a.categorias,
      'empleados', a.empleados,
      'estado', a.estado,
      'descripcion', a.descripcion,
      'kilometraje_leido', a.kilometraje_leido,
      'fecha', a.fecha,
      'observaciones', a.observaciones,
      'precio_final', a.precio_final,
      'precio_sin_iva', a.precio_sin_iva,
      'esta_pago', a.esta_pago,
      'extra_data', a.extra_data
    )
  INTO v_arreglo
  FROM public.arreglos a
  JOIN public.vehiculos v ON v.id = a.vehiculo_id
  LEFT JOIN public.talleres t ON t.id = a.taller_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id LIMIT 1;

  IF v_arreglo IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id, 'arreglo_id', d.arreglo_id, 'descripcion', d.descripcion, 'cantidad', d.cantidad,
      'valor', d.valor, 'categoria_arreglo_id', d.categoria_arreglo_id, 'empleado_id', d.empleado_id,
      'created_at', d.created_at, 'updated_at', d.updated_at
    ) ORDER BY d.created_at
  ), '[]'::jsonb) INTO v_detalles
  FROM public.detalle_arreglo d WHERE d.arreglo_id = p_arreglo_id AND d.tenant_id = v_tenant_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id, 'tipo', o.tipo, 'taller_id', o.taller_id, 'created_at', o.created_at,
      'lineas', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id, 'cantidad', l.cantidad,
            'monto_unitario', l.monto_unitario, 'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at,
            'categoria_arreglo_id', l.categoria_arreglo_id, 'empleado_id', l.empleado_id,
            'producto', jsonb_build_object(
              'id', p.id, 'codigo', p.codigo, 'nombre', p.nombre, 'precio_unitario', p.precio_unitario,
              'costo_unitario', p.costo_unitario, 'proveedor', p.proveedor, 'categorias', COALESCE(p.categorias, ARRAY[]::text[])
            )
          ) ORDER BY l.created_at
        )
        FROM public.operaciones_lineas l JOIN public.stocks s ON s.id = l.stock_id JOIN public.productos p ON p.id = s.producto_id
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb)
    ) ORDER BY o.created_at
  ), '[]'::jsonb) INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oa JOIN public.operaciones o ON o.id = oa.operacion_id WHERE oa.arreglo_id = p_arreglo_id;

  RETURN jsonb_build_object('arreglo', v_arreglo, 'detalles', v_detalles, 'asignaciones', v_asignaciones);
END;
$$;
