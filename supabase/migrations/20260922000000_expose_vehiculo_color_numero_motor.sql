-- Expone los nuevos datos del vehiculo en la vista que consumen los listados
-- y el detalle. Se mantienen las columnas existentes y se agregan al final
-- para que CREATE OR REPLACE VIEW sea compatible con la vista ya desplegada.
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
  v.numero_chasis,
  v.cliente_id,
  v.color,
  v.numero_motor
FROM public.vehiculos v
JOIN public.clientes c ON v.cliente_id = c.id
LEFT JOIN public.particulares p ON c.id = p.id
LEFT JOIN public.empresas e ON c.id = e.id;
