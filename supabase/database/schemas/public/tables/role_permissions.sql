CREATE TABLE public.role_permissions (
  role       text    NOT NULL,
  permission text    NOT NULL,
  granted    boolean DEFAULT false NOT NULL
);

CREATE POLICY "Authenticated users can read role_permissions" ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.role_permissions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_permission_fkey FOREIGN KEY (permission) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (ROLE, permission);

ALTER TABLE public.role_permissions
  ADD CONSTRAINT fk_role_permissions_role FOREIGN KEY (ROLE) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;

GRANT ALL ON public.role_permissions TO anon;

GRANT ALL ON public.role_permissions TO authenticated;

GRANT ALL ON public.role_permissions TO service_role;