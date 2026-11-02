CREATE TABLE public.representantes (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  empresa_id  uuid                     NOT NULL,
  nombre      text                     NOT NULL,
  apellido    text                     NOT NULL,
  telefono    text,
  created_at  timestamp with time zone DEFAULT now(),
  codigo_pais text
);

CREATE INDEX idx_representantes_empresa_id ON public.representantes (empresa_id);

CREATE POLICY auth_access ON public.representantes
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.representantes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.representantes
  ADD CONSTRAINT representantes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.representantes
  ADD CONSTRAINT representantes_pkey PRIMARY KEY (id);

GRANT ALL ON public.representantes TO anon;

GRANT ALL ON public.representantes TO authenticated;

GRANT ALL ON public.representantes TO service_role;