CREATE TABLE public.facturacion_parametros_normativos (
  clave          text                     NOT NULL,
  vigente_desde  date                     NOT NULL,
  valor_numerico numeric(18,2),
  fuente         text                     NOT NULL,
  created_at     timestamp with time zone DEFAULT now() NOT NULL
);

CREATE POLICY facturacion_parametros_normativos_lectura ON public.facturacion_parametros_normativos
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.facturacion_parametros_normativos
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturacion_parametros_normativos
  ADD CONSTRAINT facturacion_parametros_normativos_pkey PRIMARY KEY (clave, vigente_desde);

GRANT SELECT ON public.facturacion_parametros_normativos TO authenticated;

GRANT ALL ON public.facturacion_parametros_normativos TO service_role;