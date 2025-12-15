CREATE VIEW vista_vehiculos_con_clientes 
with (security_invoker = on) AS
SELECT
  v.id,
  COALESCE(
    CONCAT(p.nombre, ' ', p.apellido),
    e.nombre
  )::text AS nombre_cliente,
  v.patente,
  v.marca,
  v.modelo,
  v.fecha_patente,
  v.nro_interno
FROM vehiculos v
JOIN clientes c ON v.cliente_id = c.id
LEFT JOIN particulares p ON c.id = p.id
LEFT JOIN empresas e ON c.id = e.id;