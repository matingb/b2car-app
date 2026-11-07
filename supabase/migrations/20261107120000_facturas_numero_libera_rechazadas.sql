-- =============================================================================
-- Facturación: un comprobante RECHAZADA no retiene su número
-- =============================================================================
-- El número candidato se calcula como último autorizado en ARCA + 1 y se graba
-- en numero_comprobante antes de enviar. Un comprobante RECHAZADA no fue
-- autorizado por ARCA (o nunca llegó a enviarse), así que ese número sigue libre
-- en ARCA. Mientras la fila rechazada lo conservaba dentro del índice único, el
-- siguiente documento de otro origen en el mismo punto de venta y tipo recibía
-- el mismo candidato y fallaba al prepararse.
--
-- La fila rechazada conserva el número como historial. Si vuelve a un estado
-- activo (el reintento de rpc_facturacion_preparar_documento la pasa a ENVIANDO
-- con un candidato nuevo), reingresa al índice y Postgres valida la unicidad en
-- ese momento. ENVIANDO e INCIERTA siguen reteniendo el número: ARCA podría
-- haberlo autorizado.
--
-- El nuevo predicado cubre un subconjunto de las filas del anterior, así que
-- crearlo no puede fallar con los datos existentes.
-- Test: supabase/tests/facturas_numero_rechazadas.sql

DROP INDEX IF EXISTS public.facturas_electronicas_numero_emisor_unico;

CREATE UNIQUE INDEX facturas_electronicas_numero_emisor_unico
  ON public.facturas_electronicas (
    ambiente, ((emisor_snapshot ->> 'cuit')), punto_venta,
    tipo_comprobante, numero_comprobante
  ) WHERE numero_comprobante IS NOT NULL AND estado <> 'RECHAZADA';
