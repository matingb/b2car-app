-- v1.5.1 - Actualiza precio_final automáticamente mediante triggers

-- 1) Función que calcula el precio_final de un arreglo
CREATE OR REPLACE FUNCTION public.calcular_precio_final_arreglo(p_arreglo_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_servicios numeric := 0;
  v_total_asignaciones numeric := 0;
BEGIN
  -- Suma de servicios (detalle_arreglo)
  SELECT COALESCE(SUM(cantidad * valor), 0)
  INTO v_total_servicios
  FROM public.detalle_arreglo
  WHERE arreglo_id = p_arreglo_id;

  -- Suma de asignaciones (operaciones_lineas via operaciones_asignacion_arreglo)
  SELECT COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)
  INTO v_total_asignaciones
  FROM public.operaciones_asignacion_arreglo oaa
  JOIN public.operaciones_lineas ol ON ol.operacion_id = oaa.operacion_id
  WHERE oaa.arreglo_id = p_arreglo_id;

  RETURN v_total_servicios + v_total_asignaciones;
END;
$$;

-- 2) Backfill: actualizar precio_final para todos los arreglos existentes
-- UPDATE public.arreglos
-- SET precio_final = public.calcular_precio_final_arreglo(id);

-- 3) Función trigger que recalcula el precio_final
CREATE OR REPLACE FUNCTION public.recalcular_precio_final_arreglo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arreglo_id uuid;
BEGIN
  -- Determinar el arreglo_id según la tabla de origen
  IF TG_TABLE_NAME = 'detalle_arreglo' THEN
    -- Para detalle_arreglo, obtenemos arreglo_id de OLD o NEW
    v_arreglo_id := COALESCE(NEW.arreglo_id, OLD.arreglo_id);
  
  ELSIF TG_TABLE_NAME = 'operaciones_asignacion_arreglo' THEN
    -- Para operaciones_asignacion_arreglo
    v_arreglo_id := COALESCE(NEW.arreglo_id, OLD.arreglo_id);
  
  ELSIF TG_TABLE_NAME = 'operaciones_lineas' THEN
    -- Para operaciones_lineas, necesitamos buscar si la operación está asignada a un arreglo
    SELECT arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo
    WHERE operacion_id = COALESCE(NEW.operacion_id, OLD.operacion_id)
    LIMIT 1;
    
    -- Si no hay arreglo asociado, no hacemos nada
    IF v_arreglo_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  -- Actualizar el precio_final del arreglo
  IF v_arreglo_id IS NOT NULL THEN
    UPDATE public.arreglos
    SET precio_final = public.calcular_precio_final_arreglo(v_arreglo_id)
    WHERE id = v_arreglo_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Trigger en detalle_arreglo
DROP TRIGGER IF EXISTS trigger_recalcular_precio_detalle_arreglo ON public.detalle_arreglo;
CREATE TRIGGER trigger_recalcular_precio_detalle_arreglo
AFTER INSERT OR UPDATE OR DELETE ON public.detalle_arreglo
FOR EACH ROW
EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

-- 5) Trigger en operaciones_lineas
DROP TRIGGER IF EXISTS trigger_recalcular_precio_operaciones_lineas ON public.operaciones_lineas;
CREATE TRIGGER trigger_recalcular_precio_operaciones_lineas
AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_lineas
FOR EACH ROW
EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

-- 6) Trigger en operaciones_asignacion_arreglo
DROP TRIGGER IF EXISTS trigger_recalcular_precio_asignacion ON public.operaciones_asignacion_arreglo;
CREATE TRIGGER trigger_recalcular_precio_asignacion
AFTER INSERT OR DELETE ON public.operaciones_asignacion_arreglo
FOR EACH ROW
EXECUTE FUNCTION public.recalcular_precio_final_arreglo();