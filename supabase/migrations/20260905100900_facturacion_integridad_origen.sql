-- La aplicación serializa por tipo de comprobante. Estos índices cierran además
-- la carrera entre solicitudes del mismo origen que calculen clases diferentes.
CREATE UNIQUE INDEX facturas_electronicas_factura_arreglo_ambiente_unica
  ON public.facturas_electronicas (tenant_id, ambiente, arreglo_id)
  WHERE documento_tipo = 'FACTURA' AND arreglo_id IS NOT NULL;

CREATE UNIQUE INDEX facturas_electronicas_factura_venta_ambiente_unica
  ON public.facturas_electronicas (tenant_id, ambiente, operacion_id)
  WHERE documento_tipo = 'FACTURA' AND operacion_id IS NOT NULL;
