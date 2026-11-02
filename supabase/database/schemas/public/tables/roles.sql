CREATE TABLE public.roles (
  id          text                     NOT NULL,
  nombre      text                     NOT NULL,
  descripcion text,
  activo      boolean                  DEFAULT true NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.roles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.roles
  ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

GRANT ALL ON public.roles TO anon;

GRANT ALL ON public.roles TO authenticated;

GRANT ALL ON public.roles TO service_role;