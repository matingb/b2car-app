-- Migration: 20260930100000_arreglo_numero_orden_autoincremental.sql
-- Agrega numero_orden autoincremental por tenant a la tabla arreglos y realiza backfill de existentes

-- 1. Agregar columna numero_orden si no existe
ALTER TABLE public.arreglos
  ADD COLUMN IF NOT EXISTS numero_orden integer;

-- 2. Asegurarse de que el trigger no interfiera con el backfill si la migración se reejecuta
DROP TRIGGER IF EXISTS trg_set_arreglo_numero_orden ON public.arreglos;

-- 3. Backfill de los arreglos existentes por tenant ordenados cronológicamente
-- Si ya existen registros con numero_orden, continúa a partir del máximo existente por tenant para evitar colisiones
WITH max_per_tenant AS (
  SELECT tenant_id, coalesce(max(numero_orden), 0) AS max_val
  FROM public.arreglos
  WHERE numero_orden IS NOT NULL
  GROUP BY tenant_id
),
numbered AS (
  SELECT
    a.id,
    coalesce(m.max_val, 0) + row_number() OVER (
      PARTITION BY a.tenant_id
      ORDER BY coalesce(a.fecha, a.created_at) ASC, a.created_at ASC, a.id ASC
    ) AS seq
  FROM public.arreglos a
  LEFT JOIN max_per_tenant m ON m.tenant_id = a.tenant_id
  WHERE a.numero_orden IS NULL
)
UPDATE public.arreglos a
SET numero_orden = numbered.seq
FROM numbered
WHERE a.id = numbered.id;

-- 4. Asignar NOT NULL y restricción UNIQUE por (tenant_id, numero_orden)
ALTER TABLE public.arreglos
  ALTER COLUMN numero_orden SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_arreglos_tenant_numero_orden'
      AND conrelid = 'public.arreglos'::regclass
  ) THEN
    ALTER TABLE public.arreglos
      ADD CONSTRAINT uq_arreglos_tenant_numero_orden UNIQUE (tenant_id, numero_orden);
  END IF;
END $$;

-- 5. Función y Trigger para autoincrementar numero_orden por tenant
CREATE OR REPLACE FUNCTION public.set_arreglo_numero_orden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := public.current_tenant_id();
    END IF;

    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'tenant_id es requerido para generar numero_orden';
    END IF;

    IF NEW.numero_orden IS NULL THEN
      -- Bloqueo consultivo a nivel de transacción por tenant para evitar colisiones concurrentes (64-bit bigint)
      PERFORM pg_advisory_xact_lock(hashtextextended('arreglos_numero_orden_' || NEW.tenant_id::text, 0));

      SELECT coalesce(max(numero_orden), 0) + 1
        INTO NEW.numero_orden
        FROM public.arreglos
       WHERE tenant_id = NEW.tenant_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.numero_orden IS NULL THEN
      NEW.numero_orden := OLD.numero_orden;
    END IF;

    IF OLD.numero_orden IS NOT NULL AND NEW.numero_orden IS DISTINCT FROM OLD.numero_orden THEN
      RAISE EXCEPTION 'No se permite modificar el numero_orden de un arreglo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_arreglo_numero_orden ON public.arreglos;
CREATE TRIGGER trg_set_arreglo_numero_orden
BEFORE INSERT OR UPDATE ON public.arreglos
FOR EACH ROW
EXECUTE FUNCTION public.set_arreglo_numero_orden();

-- 6. Actualizar rpc_get_arreglo_detalle para incluir numero_orden
CREATE OR REPLACE FUNCTION public.rpc_get_arreglo_detalle(p_arreglo_id uuid)
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
  v_puede_ver_costos boolean := public._b2c179_tiene_permiso('empleados:view');
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;

  SELECT jsonb_build_object(
    'id', a.id, 'numero_orden', a.numero_orden, 'vehiculo', to_jsonb(v), 'taller_id', a.taller_id, 'taller', to_jsonb(t),
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
    'id', d.id, 'arreglo_id', d.arreglo_id, 'descripcion', d.descripcion,
    'cantidad', d.cantidad, 'precio_hora_facturada', d.precio_hora_facturada,
    'horas_facturadas', d.horas_facturadas, 'horas_trabajadas', d.horas_trabajadas,
    'valor_hora_empleado', CASE WHEN v_puede_ver_costos THEN d.valor_hora_empleado ELSE NULL END,
    'categoria_arreglo_id', d.categoria_arreglo_id, 'empleado_id', d.empleado_id,
    'created_at', d.created_at, 'updated_at', d.updated_at
  ) ORDER BY d.created_at), '[]'::jsonb) INTO v_detalles
  FROM public.detalle_arreglo d
  WHERE d.arreglo_id = p_arreglo_id AND d.tenant_id = v_tenant_id;

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

  RETURN jsonb_build_object(
    'arreglo', v_arreglo,
    'detalles', v_detalles,
    'asignaciones', v_asignaciones,
    'cobros', v_cobros
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_arreglo_detalle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_arreglo_detalle(uuid) TO authenticated, service_role;
