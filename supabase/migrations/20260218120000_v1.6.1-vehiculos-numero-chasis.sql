-- v1.6.1
-- Agrega numero_chasis a vehiculos y actualiza vistas relacionadas

ALTER TABLE public.vehiculos
ADD COLUMN IF NOT EXISTS numero_chasis text NOT NULL DEFAULT '';

CREATE OR REPLACE VIEW public.vista_turnos_con_detalle
WITH (security_invoker = on) AS
SELECT
  t.id,
  t.fecha,
  t.hora,
  t.duracion,
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
  v.numero_chasis
FROM public.turnos t
LEFT JOIN public.vehiculos v ON t.vehiculo_id = v.id
LEFT JOIN public.clientes c ON t.cliente_id = c.id
LEFT JOIN public.particulares p ON c.id = p.id
LEFT JOIN public.empresas e ON c.id = e.id;

CREATE OR REPLACE VIEW public.vista_vehiculos_con_clientes
WITH (security_invoker = on) AS
SELECT
  v.id,
  COALESCE(
    NULLIF(TRIM(CONCAT(p.nombre, ' ', p.apellido)), ''),
    e.nombre
  )::text AS nombre_cliente,
  v.patente,
  v.marca,
  v.modelo,
  v.fecha_patente,
  v.nro_interno,
  v.numero_chasis
FROM public.vehiculos v
JOIN public.clientes c ON v.cliente_id = c.id
LEFT JOIN public.particulares p ON c.id = p.id
LEFT JOIN public.empresas e ON c.id = e.id;
