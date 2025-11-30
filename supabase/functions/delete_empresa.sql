-- Función para eliminar un cliente empresa en una transacción atómica
-- Elimina primero de la tabla empresas y luego de la tabla clientes
CREATE OR REPLACE FUNCTION delete_empresa(empresa_id bigint)
RETURNS void AS $$
BEGIN
  DELETE FROM empresas WHERE id = empresa_id;
  DELETE FROM clientes WHERE id = empresa_id;
END;
$$ LANGUAGE plpgsql;

