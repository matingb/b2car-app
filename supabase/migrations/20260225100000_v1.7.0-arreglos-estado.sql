-- v1.7.0 - Estado de arreglo (enum) + columna + RPC detalle

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'estado_arreglo'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.estado_arreglo AS ENUM (
      'PRESUPUESTO',
      'SIN_INICIAR',
      'EN_PROGRESO',
      'ESPERA',
      'TERMINADO'
    );
  END IF;
END $$;

ALTER TABLE public.arreglos
  ADD COLUMN IF NOT EXISTS estado public.estado_arreglo;

UPDATE public.arreglos
SET estado = CASE
  WHEN esta_pago = true THEN 'TERMINADO'::public.estado_arreglo
  ELSE 'EN_PROGRESO'::public.estado_arreglo
END
WHERE estado IS NULL;

ALTER TABLE public.arreglos
  ALTER COLUMN estado SET DEFAULT 'SIN_INICIAR'::public.estado_arreglo,
  ALTER COLUMN estado SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_arreglos_estado ON public.arreglos (estado);

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
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_arreglo_id IS NULL THEN
    RAISE EXCEPTION 'arreglo_id requerido';
  END IF;

  SELECT
    jsonb_build_object(
      'id', a.id,
      'vehiculo', to_jsonb(v),
      'taller_id', a.taller_id,
      'taller', to_jsonb(t),
      'tipo', a.tipo,
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
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_arreglo IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'arreglo_id', d.arreglo_id,
        'descripcion', d.descripcion,
        'cantidad', d.cantidad,
        'valor', d.valor,
        'created_at', d.created_at,
        'updated_at', d.updated_at
      )
      ORDER BY d.created_at
    ),
    '[]'::jsonb
  )
  INTO v_detalles
  FROM public.detalle_arreglo d
  WHERE d.arreglo_id = p_arreglo_id
    AND d.tenant_id = v_tenant_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'tipo', o.tipo,
        'taller_id', o.taller_id,
        'created_at', o.created_at,
        'lineas', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', l.id,
              'operacion_id', l.operacion_id,
              'stock_id', l.stock_id,
              'cantidad', l.cantidad,
              'monto_unitario', l.monto_unitario,
              'delta_cantidad', l.delta_cantidad,
              'created_at', l.created_at,
              'producto', jsonb_build_object(
                'id', p.id,
                'codigo', p.codigo,
                'nombre', p.nombre,
                'precio_unitario', p.precio_unitario,
                'costo_unitario', p.costo_unitario,
                'proveedor', p.proveedor,
                'categorias', COALESCE(p.categorias, ARRAY[]::text[])
              )
            )
            ORDER BY l.created_at
          )
          FROM public.operaciones_lineas l
          JOIN public.stocks s ON s.id = l.stock_id
          JOIN public.productos p ON p.id = s.producto_id
          WHERE l.operacion_id = o.id
        ), '[]'::jsonb)
      )
      ORDER BY o.created_at
    ),
    '[]'::jsonb
  )
  INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oa
  JOIN public.operaciones o ON o.id = oa.operacion_id
  WHERE oa.arreglo_id = p_arreglo_id;

  RETURN jsonb_build_object(
    'arreglo', v_arreglo,
    'detalles', v_detalles,
    'asignaciones', v_asignaciones
  );
END;
$$;
