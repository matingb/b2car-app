CREATE TABLE public.plan_permissions (
  plan       text    NOT NULL,
  permission text    NOT NULL,
  granted    boolean DEFAULT false NOT NULL
);

CREATE POLICY "Authenticated users can read plan_permissions" ON public.plan_permissions
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.plan_permissions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plan_permissions
  ADD CONSTRAINT plan_permissions_permission_fkey FOREIGN KEY (permission) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.plan_permissions
  ADD CONSTRAINT plan_permissions_pkey PRIMARY KEY (plan, permission);

ALTER TABLE public.plan_permissions
  ADD CONSTRAINT fk_plan_permissions_plan FOREIGN KEY (plan) REFERENCES public.subscription_plans(id) ON UPDATE CASCADE ON DELETE RESTRICT;

GRANT ALL ON public.plan_permissions TO anon;

GRANT ALL ON public.plan_permissions TO authenticated;

GRANT ALL ON public.plan_permissions TO service_role;