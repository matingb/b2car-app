-- Tipo enum para planes de suscripción del tenant.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'subscription_plan'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.subscription_plan AS ENUM ('BASE', 'PRO');
  END IF;
END $$;

-- Tabla de permisos por plan de suscripción.
-- Los permisos son globales al sistema.
-- Cada plan define qué permisos habilita; el valor 'granted' indica si está disponible en ese tier.
create table public.plan_permissions (
  plan        public.subscription_plan not null,
  permission  text                     not null references public.permissions(id) on update cascade on delete cascade,
  granted     boolean                  not null default false,
  primary key (plan, permission)
);

-- RLS: authenticated puede leer (y RPC security definer tiene acceso total).
alter table public.plan_permissions enable row level security;

create policy "Authenticated users can read plan_permissions"
  on public.plan_permissions
  for select
  to authenticated
  using (true);

-- Privilegios para Data API de Supabase según reglas del proyecto
grant select on public.plan_permissions to authenticated;
grant select, insert, update, delete on public.plan_permissions to service_role;

-- Plan: PRO — acceso a todas las funcionalidades del sistema
insert into public.plan_permissions (plan, permission, granted) values
  ('PRO', 'dashboard:view',                true),
  ('PRO', 'operaciones:view',              true),
  ('PRO', 'operaciones:edit',              true),
  ('PRO', 'finanzas:view',                 true),
  ('PRO', 'finanzas:edit',                 true),
  ('PRO', 'facturas:view',                 true),
  ('PRO', 'facturas:edit',                 true),
  ('PRO', 'empleados:view',                true),
  ('PRO', 'empleados:edit',                true),
  ('PRO', 'productos:view',                true),
  ('PRO', 'productos:edit',                true),
  ('PRO', 'configuracion:view',            true),
  ('PRO', 'configuracion:edit',            true),
  ('PRO', 'arreglos:view',                 true),
  ('PRO', 'arreglos:edit',                 true),
  ('PRO', 'arreglos:precios:view',         true),
  ('PRO', 'arreglos:precios:edit',         true),
  ('PRO', 'arreglos:cobros:register',      true),
  ('PRO', 'arreglos:repuestos:comprar',    true),
  ('PRO', 'clientes:view',                 true),
  ('PRO', 'clientes:edit',                 true),
  ('PRO', 'clientes:finanzas:view',        true),
  ('PRO', 'vehiculos:view',                true),
  ('PRO', 'vehiculos:edit',                true),
  ('PRO', 'turnos:view',                   true),
  ('PRO', 'turnos:edit',                   true);

-- Plan: BASE — todas las funcionalidades operativas y administrativas generales,
-- pero sin facturación electrónica ni configuración fiscal.
insert into public.plan_permissions (plan, permission, granted) values
  ('BASE', 'dashboard:view',                true),
  ('BASE', 'operaciones:view',              true),
  ('BASE', 'operaciones:edit',              true),
  ('BASE', 'finanzas:view',                 true),
  ('BASE', 'finanzas:edit',                 true),
  ('BASE', 'facturas:view',                 false),
  ('BASE', 'facturas:edit',                 false),
  ('BASE', 'empleados:view',                true),
  ('BASE', 'empleados:edit',                true),
  ('BASE', 'productos:view',                true),
  ('BASE', 'productos:edit',                true),
  ('BASE', 'configuracion:view',            false),
  ('BASE', 'configuracion:edit',            false),
  ('BASE', 'arreglos:view',                 true),
  ('BASE', 'arreglos:edit',                 true),
  ('BASE', 'arreglos:precios:view',         true),
  ('BASE', 'arreglos:precios:edit',         true),
  ('BASE', 'arreglos:cobros:register',      true),
  ('BASE', 'arreglos:repuestos:comprar',    true),
  ('BASE', 'clientes:view',                 true),
  ('BASE', 'clientes:edit',                 true),
  ('BASE', 'clientes:finanzas:view',        true),
  ('BASE', 'vehiculos:view',                true),
  ('BASE', 'vehiculos:edit',                true),
  ('BASE', 'turnos:view',                   true),
  ('BASE', 'turnos:edit',                   true);

-- RPC: devuelve los permisos efectivos del usuario llamante.
-- Calcula la intersección entre los permisos del rol (role_permissions)
-- y los permisos del plan del tenant (plan_permissions).
-- Ambos claims ('user_role' y 'plan_sub') son inyectados en el JWT por public.custom_claims.
create or replace function public.get_my_permissions()
returns text[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(rp.permission), '{}'::text[])
  from public.role_permissions rp
  join public.plan_permissions pp
    on pp.permission = rp.permission
   and pp.plan::text = (auth.jwt() ->> 'plan_sub')
   and pp.granted = true
  where rp.role::text = (auth.jwt() ->> 'user_role')
    and rp.granted = true;
$$;

grant execute on function public.get_my_permissions() to authenticated;
