CREATE TABLE public.permissions (
  id          text NOT NULL,
  descripcion text NOT NULL
);

CREATE POLICY "Authenticated users can read permissions" ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.permissions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.permissions
  ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);

GRANT ALL ON public.permissions TO anon;

GRANT ALL ON public.permissions TO authenticated;

GRANT ALL ON public.permissions TO service_role;