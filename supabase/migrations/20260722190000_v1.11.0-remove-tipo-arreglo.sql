-- v1.11.0 - Remover columna `tipo` de arreglos y limpiar RPCs
-- Ya que los tipos están consolidados en la tabla `tipos_arreglo` y los datos han sido migrados en v1.10.3

-- 1. Redefinir _insert_arreglo_base sin p_tipo
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
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  INSERT INTO public.arreglos (
    tenant_id, vehiculo_id, taller_id, estado, descripcion,
    kilometraje_leido, fecha, observaciones, precio_final, precio_sin_iva,
    esta_pago, extra_data
  )
  VALUES (
    v_tenant_id, p_vehiculo_id, p_taller_id,
    coalesce(p_estado, 'SIN_INICIAR'::public.estado_arreglo),
    p_descripcion, coalesce(p_kilometraje_leido, 0),
    p_fecha, p_observaciones,
    coalesce(p_precio_final, 0), coalesce(p_precio_sin_iva, 0),
    coalesce(p_esta_pago, false), p_extra_data
  )
  RETURNING id INTO v_arreglo_id;

  RETURN v_arreglo_id;
END;
$$;

-- 2. Redefinir rpc_crear_arreglo_completo sin p_tipo
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

-- 3. Grants de ejecucion
GRANT EXECUTE ON FUNCTION public._insert_arreglo_base(uuid, uuid, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_crear_arreglo_completo(uuid, uuid, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;

-- 4. Borrar las funciones viejas
DROP FUNCTION IF EXISTS public._insert_arreglo_base(uuid, uuid, text, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb);
DROP FUNCTION IF EXISTS public.rpc_crear_arreglo_completo(uuid, uuid, text, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb);

-- 5. Eliminar la columna de la base de datos
ALTER TABLE public.arreglos DROP COLUMN IF EXISTS tipo;

-- 6. Redefinir _sync_arreglo_derivados para que no intente actualizar arreglos.tipo
CREATE OR REPLACE FUNCTION public._sync_arreglo_derivados(p_arreglo_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tipos uuid[];
  v_empleados uuid[];
BEGIN
  IF p_arreglo_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(ARRAY_AGG(DISTINCT tipo_id) FILTER (WHERE tipo_id IS NOT NULL), '{}'),
    COALESCE(ARRAY_AGG(DISTINCT empleado_id) FILTER (WHERE empleado_id IS NOT NULL), '{}')
  INTO v_tipos, v_empleados
  FROM (
    SELECT d.tipo_arreglo_id AS tipo_id, d.empleado_id AS empleado_id
    FROM public.detalle_arreglo d
    WHERE d.arreglo_id = p_arreglo_id

    UNION ALL

    SELECT ol.tipo_arreglo_id AS tipo_id, ol.empleado_id AS empleado_id
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    WHERE oa.arreglo_id = p_arreglo_id
  ) usos;

  UPDATE public.arreglos
  SET tipos = v_tipos,
      empleados = v_empleados
  WHERE id = p_arreglo_id;
END;
$$;

