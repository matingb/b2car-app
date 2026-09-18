-- =============================================================================
-- Tablas maestras de catálogo: roles y subscription_plans
--
-- Reemplaza los ENUMs public.user_role y public.subscription_plan y los CHECK
-- constraints hardcodeados por tablas de catálogo con integridad referencial.
--
-- Decisiones de diseño:
--   • PK tipo text con slug legible ('admin', 'BASE', etc.) para no alterar el
--     JWT ni las comparaciones en RLS y middleware.
--   • ON UPDATE CASCADE: permite renombrar slugs sin romper FKs.
--   • ON DELETE RESTRICT: impide borrar un rol/plan mientras haya filas que lo
--     referencien; protege contra eliminaciones accidentales en producción.
--   • La intersección de permisos (rol ∩ plan) se calcula en el Server Component
--     con dos queries directas a role_permissions y plan_permissions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla catálogo: public.roles
-- -----------------------------------------------------------------------------
create table public.roles (
  id          text        primary key,
  nombre      text        not null,
  descripcion text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table public.roles enable row level security;

create policy "Authenticated users can read roles"
  on public.roles
  for select
  to authenticated
  using (true);

grant select on public.roles to authenticated;
grant select, insert, update, delete on public.roles to service_role;

insert into public.roles (id, nombre, descripcion) values
  ('admin',     'Administrador',        'Acceso completo a todas las funcionalidades del tenant'),
  ('operativo', 'Operativo de Taller',  'Acceso restringido a arreglos, clientes y vehículos');

-- -----------------------------------------------------------------------------
-- 2. Tabla catálogo: public.subscription_plans
-- -----------------------------------------------------------------------------
create table public.subscription_plans (
  id          text        primary key,
  nombre      text        not null,
  descripcion text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;

create policy "Authenticated users can read subscription_plans"
  on public.subscription_plans
  for select
  to authenticated
  using (true);

grant select on public.subscription_plans to authenticated;
grant select, insert, update, delete on public.subscription_plans to service_role;

insert into public.subscription_plans (id, nombre, descripcion) values
  ('BASE', 'Plan Base', 'Acceso a funcionalidades operativas y administrativas generales'),
  ('PRO',  'Plan Pro',  'Acceso completo incluyendo facturación electrónica y configuración fiscal');

-- -----------------------------------------------------------------------------
-- 3. Migrar role_permissions.role: ENUM → text + FK
-- -----------------------------------------------------------------------------
alter table public.role_permissions
  alter column role type text using role::text;

alter table public.role_permissions
  add constraint fk_role_permissions_role
  foreign key (role) references public.roles(id)
  on update cascade
  on delete restrict;

-- -----------------------------------------------------------------------------
-- 4. Migrar plan_permissions.plan: ENUM → text + FK
-- -----------------------------------------------------------------------------
alter table public.plan_permissions
  alter column plan type text using plan::text;

alter table public.plan_permissions
  add constraint fk_plan_permissions_plan
  foreign key (plan) references public.subscription_plans(id)
  on update cascade
  on delete restrict;

-- -----------------------------------------------------------------------------
-- 5. Migrar tenant_members.rol: CHECK → FK
-- -----------------------------------------------------------------------------
alter table public.tenant_members
  drop constraint if exists tenant_members_rol_check;

alter table public.tenant_members
  add constraint fk_tenant_members_rol
  foreign key (rol) references public.roles(id)
  on update cascade
  on delete restrict;

-- -----------------------------------------------------------------------------
-- 6. Migrar tenants.plan_sub: CHECK → FK
-- -----------------------------------------------------------------------------
alter table public.tenants
  drop constraint if exists tenants_plan_sub_check;

alter table public.tenants
  add constraint fk_tenants_plan_sub
  foreign key (plan_sub) references public.subscription_plans(id)
  on update cascade
  on delete restrict;

-- -----------------------------------------------------------------------------
-- 7. Eliminar tipos ENUM obsoletos
--    Deben eliminarse después de convertir todas las columnas que los usaban.
-- -----------------------------------------------------------------------------
drop type if exists public.user_role;
drop type if exists public.subscription_plan;
