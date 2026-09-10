-- Migration: turnos por taller y desacople de cliente/vehículo
-- Fecha: 2026-09-09

-- 1. Agregar columna temporal titulo y backfill
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS titulo text;

UPDATE public.turnos t
SET titulo = COALESCE(
  NULLIF(TRIM(t.descripcion), ''),
  v.patente,
  NULLIF(TRIM(CONCAT(p.nombre, ' ', COALESCE(p.apellido, ''))), ''),
  NULLIF(TRIM(e.nombre), ''),
  'Turno de taller'
)
FROM public.turnos t2
LEFT JOIN public.vehiculos v ON t2.vehiculo_id = v.id
LEFT JOIN public.clientes c ON t2.cliente_id = c.id
LEFT JOIN public.particulares p ON c.id = p.id
LEFT JOIN public.empresas e ON c.id = e.id
WHERE t.id = t2.id AND (t.titulo IS NULL OR TRIM(t.titulo) = '');

-- En caso de que aún quede algún registro nulo:
UPDATE public.turnos SET titulo = 'Turno de taller' WHERE titulo IS NULL OR TRIM(titulo) = '';

ALTER TABLE public.turnos ALTER COLUMN titulo SET NOT NULL;

-- 2. Hacer cliente_id opcional (quitar NOT NULL)
ALTER TABLE public.turnos ALTER COLUMN cliente_id DROP NOT NULL;

-- 3. Actualizar claves foráneas para usar ON DELETE SET NULL
ALTER TABLE public.turnos DROP CONSTRAINT IF EXISTS turnos_cliente_id_fkey;
ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.turnos DROP CONSTRAINT IF EXISTS turnos_vehiculo_id_fkey;
ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_vehiculo_id_fkey
  FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE SET NULL;

-- 4. Agregar columna taller_id y backfill
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS taller_id uuid;

UPDATE public.turnos t
SET taller_id = (
  SELECT tal.id FROM public.talleres tal
  WHERE tal.tenant_id = t.tenant_id
  ORDER BY tal.created_at ASC
  LIMIT 1
)
WHERE t.taller_id IS NULL;

-- Asegurar que taller_id no sea nulo y tenga FK en cascada
ALTER TABLE public.turnos ALTER COLUMN taller_id SET NOT NULL;

ALTER TABLE public.turnos DROP CONSTRAINT IF EXISTS turnos_taller_id_fkey;
ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_taller_id_fkey
  FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE;

-- 5. Eliminar índice obsoleto y crear índice por taller
DROP INDEX IF EXISTS public.idx_turnos_tenant_fecha_hora;
CREATE INDEX IF NOT EXISTS idx_turnos_taller_fecha_hora ON public.turnos USING btree (taller_id, fecha, hora);

-- 6. Actualizar vista_turnos_con_detalle
DROP VIEW IF EXISTS public.vista_turnos_con_detalle CASCADE;
CREATE OR REPLACE VIEW public.vista_turnos_con_detalle
WITH (security_invoker = on) AS
SELECT
  t.id,
  t.titulo,
  t.fecha,
  t.hora,
  t.duracion,
  t.taller_id,
  tal.nombre AS taller_nombre,
  tal.ubicacion AS taller_ubicacion,
  t.vehiculo_id,
  t.cliente_id,
  t.tipo,
  t.estado,
  t.descripcion,
  t.observaciones,
  v.id AS vehiculo_id_full,
  v.cliente_id AS vehiculo_cliente_id,
  v.patente,
  v.marca,
  v.modelo,
  v.fecha_patente,
  v.nro_interno,
  c.id AS cliente_id_full,
  c.tipo_cliente,
  p.nombre AS particular_nombre,
  p.apellido AS particular_apellido,
  p.telefono AS particular_telefono,
  p.email AS particular_email,
  p.direccion AS particular_direccion,
  e.nombre AS empresa_nombre,
  e.telefono AS empresa_telefono,
  e.email AS empresa_email,
  e.direccion AS empresa_direccion,
  e.cuit AS empresa_cuit,
  v.numero_chasis,
  t.tenant_id,
  COALESCE(
    NULLIF(TRIM(CONCAT(p.nombre, ' ', p.apellido)), ''),
    NULLIF(TRIM(e.nombre), '')
  )::text AS cliente_nombre,
  COALESCE(
    NULLIF(TRIM(p.email), ''),
    NULLIF(TRIM(e.email), '')
  )::text AS cliente_email,
  tn.nombre::text AS tenant_nombre,
  p.codigo_pais AS particular_codigo_pais,
  e.codigo_pais AS empresa_codigo_pais
FROM public.turnos t
LEFT JOIN public.talleres tal ON t.taller_id = tal.id
LEFT JOIN public.vehiculos v ON t.vehiculo_id = v.id
LEFT JOIN public.clientes c ON t.cliente_id = c.id
LEFT JOIN public.particulares p ON c.id = p.id
LEFT JOIN public.empresas e ON c.id = e.id
LEFT JOIN public.tenants tn ON t.tenant_id = tn.id;

GRANT ALL ON TABLE public.vista_turnos_con_detalle TO anon;
GRANT ALL ON TABLE public.vista_turnos_con_detalle TO authenticated;
GRANT ALL ON TABLE public.vista_turnos_con_detalle TO service_role;
