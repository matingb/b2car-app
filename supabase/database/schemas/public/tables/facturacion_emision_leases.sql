CREATE TABLE public.facturacion_emision_leases (
  emisor_cuit      text                     NOT NULL,
  punto_venta      integer                  NOT NULL,
  tipo_comprobante smallint                 DEFAULT 11 NOT NULL,
  lease_token      uuid                     NOT NULL,
  expires_at       timestamp with time zone NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.facturacion_emision_leases
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturacion_emision_leases
  ADD CONSTRAINT facturacion_emision_leases_emisor_cuit_check CHECK (emisor_cuit ~ '^[0-9]{11}$'::text);

ALTER TABLE public.facturacion_emision_leases
  ADD CONSTRAINT facturacion_emision_leases_pkey PRIMARY KEY (emisor_cuit, punto_venta, tipo_comprobante);

ALTER TABLE public.facturacion_emision_leases
  ADD CONSTRAINT facturacion_emision_leases_punto_venta_check CHECK (punto_venta > 0);

GRANT ALL ON public.facturacion_emision_leases TO service_role;