--
-- Las querys se deben ejecutar en orden descendente, ya que ese es el orden en que fueron aplicadas en desarrollo
--
CREATE OR REPLACE VIEW vista_vehiculos_con_clientes AS
SELECT
  v.id,
  COALESCE(
    NULLIF(TRIM(CONCAT(p.nombre, ' ', p.apellido)), ''),
    e.nombre
  )::text AS nombre_cliente,
  v.patente,
  v.marca,
  v.modelo,
  v.fecha_patente
FROM vehiculos v
JOIN clientes c ON v.cliente_id = c.id
LEFT JOIN particulares p ON c.id = p.id
LEFT JOIN empresas e ON c.id = e.id;