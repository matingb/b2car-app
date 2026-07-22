-- v1.10.1 - Trigger que mantiene `arreglos.tipos`/`arreglos.empleados` (listas
-- derivadas materializadas) en sincronia con los tipo_arreglo_id/empleado_id
-- de detalle_arreglo (mano de obra) y operaciones_lineas (repuestos asignados).
-- Se recalcula siempre por agregacion completa (ARRAY_AGG DISTINCT), nunca por
-- incrementos, por lo que es idempotente sin importar el orden de ejecucion.

CREATE OR REPLACE FUNCTION public._sync_arreglo_derivados(p_arreglo_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tipos uuid[];
  v_empleados uuid[];
  v_tipo_nombre text;
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

  -- Buscar la denominacion del tipo_arreglo asignado en la mano de obra
  SELECT t.nombre INTO v_tipo_nombre
  FROM public.detalle_arreglo d
  JOIN public.tipos_arreglo t ON t.id = d.tipo_arreglo_id
  WHERE d.arreglo_id = p_arreglo_id
    AND d.tipo_arreglo_id IS NOT NULL
  ORDER BY d.created_at ASC
  LIMIT 1;

  IF v_tipo_nombre IS NULL AND array_length(v_tipos, 1) > 0 THEN
    SELECT t.nombre INTO v_tipo_nombre
    FROM public.tipos_arreglo t
    WHERE t.id = v_tipos[1];
  END IF;

  IF v_tipo_nombre IS NOT NULL AND trim(v_tipo_nombre) <> '' THEN
    UPDATE public.arreglos
    SET tipos = v_tipos,
        empleados = v_empleados,
        tipo = trim(v_tipo_nombre)
    WHERE id = p_arreglo_id;
  ELSE
    UPDATE public.arreglos
    SET tipos = v_tipos,
        empleados = v_empleados
    WHERE id = p_arreglo_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public._sync_arreglo_derivados(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._sync_arreglo_derivados(uuid) TO service_role;

-- Trigger sobre detalle_arreglo (INSERT/UPDATE/DELETE).
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
  AFTER INSERT OR UPDATE OF tipo_arreglo_id, empleado_id OR DELETE ON public.detalle_arreglo
  FOR EACH ROW EXECUTE FUNCTION public._trg_detalle_arreglo_sync_derivados();

-- Trigger sobre operaciones_lineas (INSERT/UPDATE/DELETE), resolviendo el
-- arreglo_id via operaciones_asignacion_arreglo. Lineas que no pertenecen a
-- una asignacion de arreglo no afectan ningun arreglo (arreglo_id = NULL).
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
  AFTER INSERT OR UPDATE OF tipo_arreglo_id, empleado_id OR DELETE ON public.operaciones_lineas
  FOR EACH ROW EXECUTE FUNCTION public._trg_operaciones_lineas_sync_derivados();

-- Trigger para que si se renombra un tipo_arreglo en el catalogo,
-- actualice la columna tipo en los arreglos que tengan dicho tipo_arreglo.
CREATE OR REPLACE FUNCTION public._trg_tipos_arreglo_sync_nombre_arreglos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.nombre IS DISTINCT FROM NEW.nombre THEN
    UPDATE public.arreglos
    SET tipo = trim(NEW.nombre)
    WHERE tipos @> ARRAY[NEW.id];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tipos_arreglo_sync_nombre_arreglos ON public.tipos_arreglo;
CREATE TRIGGER tipos_arreglo_sync_nombre_arreglos
  AFTER UPDATE OF nombre ON public.tipos_arreglo
  FOR EACH ROW EXECUTE FUNCTION public._trg_tipos_arreglo_sync_nombre_arreglos();
