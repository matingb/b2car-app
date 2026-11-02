CREATE TABLE public.subscription_plans (
  id          text                     NOT NULL,
  nombre      text                     NOT NULL,
  descripcion text,
  activo      boolean                  DEFAULT true NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE POLICY "Authenticated users can read subscription_plans" ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.subscription_plans
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);

GRANT ALL ON public.subscription_plans TO anon;

GRANT ALL ON public.subscription_plans TO authenticated;

GRANT ALL ON public.subscription_plans TO service_role;