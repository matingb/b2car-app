-- Función para eliminar un cliente particular en una transacción atómica
-- Elimina primero de la tabla particulares y luego de la tabla clientes
CREATE OR REPLACE FUNCTION delete_particular(particular_id bigint)
RETURNS void AS $$
BEGIN
  DELETE FROM particulares WHERE id = particular_id;
  DELETE FROM clientes WHERE id = particular_id;
END;
$$ LANGUAGE plpgsql;

