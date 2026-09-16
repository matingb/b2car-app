-- Tipo enum para roles del sistema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'operativo');
  END IF;
END $$;

create table public.permissions (
  id          text primary key,
  descripcion text not null
);

alter table public.permissions enable row level security;

create policy "Authenticated users can read permissions"
  on public.permissions
  for select
  to authenticated
  using (true);

grant select on public.permissions to authenticated;
grant select, insert, update, delete on public.permissions to service_role;

insert into public.permissions (id, descripcion) values
  ('dashboard:view',                'Visualización de panel de control y métricas'),
  ('operaciones:view',              'Consulta del libro diario de operaciones contables'),
  ('operaciones:edit',              'Registro y edición de operaciones contables'),
  ('finanzas:view',                 'Consulta de cuentas financieras, saldos y movimientos'),
  ('finanzas:edit',                 'Gestión de cuentas financieras y transferencias'),
  ('facturas:view',                 'Emisión y consulta de facturas electrónicas ARCA'),
  ('facturas:edit',                 'Modificación y anulación de facturas electrónicas'),
  ('empleados:view',                'Consulta de personal, salarios y liquidaciones'),
  ('empleados:edit',                'Gestión y edición de empleados y salarios'),
  ('productos:view',                'Catálogo de productos, precios y márgenes'),
  ('productos:edit',                'Alta, edición y actualización de productos y stock'),
  ('configuracion:view',            'Parámetros del sistema y credenciales fiscales'),
  ('configuracion:edit',            'Modificación de configuración del tenant y certificados fiscales'),
  ('arreglos:view',                 'Consulta de órdenes de trabajo del taller'),
  ('arreglos:edit',                 'Carga y edición operativa de arreglos'),
  ('arreglos:precios:view',         'Visualización de montos, totales y subtotales en arreglos'),
  ('arreglos:precios:edit',         'Cotización de mano de obra y precio venta de repuestos'),
  ('arreglos:cobros:register',      'Registro de cobros y cambio de estado a pagado'),
  ('arreglos:repuestos:comprar',    'Carga de costo y cuenta de egreso para comprar repuestos'),
  ('clientes:view',                 'Ficha de clientes y datos de contacto'),
  ('clientes:edit',                 'Alta y modificación de clientes'),
  ('clientes:finanzas:view',        'Solapa Cuenta Corriente y saldo deudor de clientes'),
  ('vehiculos:view',                'Consulta de vehículos asociados'),
  ('vehiculos:edit',                'Alta y modificación de vehículos'),
  ('turnos:view',                   'Calendario y agendamiento de turnos'),
  ('turnos:edit',                   'Alta, reprogramación y cancelación de turnos');

-- Tabla de permisos por rol.
-- Los permisos son globales al sistema (no dependen del tenant).
-- Cada rol tiene un conjunto fijo de permisos; el valor 'granted' indica si está habilitado.
create table public.role_permissions (
  role        public.user_role not null,
  permission  text             not null references public.permissions(id) on update cascade on delete cascade,
  granted     boolean          not null default false,
  primary key (role, permission)
);

-- RLS: authenticated puede leer (y RPC security definer tiene acceso total).
alter table public.role_permissions enable row level security;

create policy "Authenticated users can read role_permissions"
  on public.role_permissions
  for select
  to authenticated
  using (true);

-- Solo service_role puede modificar la tabla.
-- authenticated puede leer para que el RPC y consultas directas funcionen.
grant select on public.role_permissions to authenticated;
grant select, insert, update, delete on public.role_permissions to service_role;

-- Rol: admin — acceso completo
insert into public.role_permissions (role, permission, granted) values
  ('admin', 'dashboard:view',                true),
  ('admin', 'operaciones:view',              true),
  ('admin', 'operaciones:edit',              true),
  ('admin', 'finanzas:view',                 true),
  ('admin', 'finanzas:edit',                 true),
  ('admin', 'facturas:view',                 true),
  ('admin', 'facturas:edit',                 true),
  ('admin', 'empleados:view',                true),
  ('admin', 'empleados:edit',                true),
  ('admin', 'productos:view',                true),
  ('admin', 'productos:edit',                true),
  ('admin', 'configuracion:view',            true),
  ('admin', 'configuracion:edit',            true),
  ('admin', 'arreglos:view',                 true),
  ('admin', 'arreglos:edit',                 true),
  ('admin', 'arreglos:precios:view',         true),
  ('admin', 'arreglos:precios:edit',         true),
  ('admin', 'arreglos:cobros:register',      true),
  ('admin', 'arreglos:repuestos:comprar',    true),
  ('admin', 'clientes:view',                 true),
  ('admin', 'clientes:edit',                 true),
  ('admin', 'clientes:finanzas:view',        true),
  ('admin', 'vehiculos:view',                true),
  ('admin', 'vehiculos:edit',                true),
  ('admin', 'turnos:view',                   true),
  ('admin', 'turnos:edit',                   true);

-- Rol: operativo — acceso restringido al taller
insert into public.role_permissions (role, permission, granted) values
  ('operativo', 'dashboard:view',                false),
  ('operativo', 'operaciones:view',              false),
  ('operativo', 'operaciones:edit',              false),
  ('operativo', 'finanzas:view',                 false),
  ('operativo', 'finanzas:edit',                 false),
  ('operativo', 'facturas:view',                 false),
  ('operativo', 'facturas:edit',                 false),
  ('operativo', 'empleados:view',                false),
  ('operativo', 'empleados:edit',                false),
  ('operativo', 'productos:view',                false),
  ('operativo', 'productos:edit',                false),
  ('operativo', 'configuracion:view',            false),
  ('operativo', 'configuracion:edit',            false),
  ('operativo', 'arreglos:view',                 true),
  ('operativo', 'arreglos:edit',                 true),
  ('operativo', 'arreglos:precios:view',         false),
  ('operativo', 'arreglos:precios:edit',         false),
  ('operativo', 'arreglos:cobros:register',      false),
  ('operativo', 'arreglos:repuestos:comprar',    true),
  ('operativo', 'clientes:view',                 true),
  ('operativo', 'clientes:edit',                 true),
  ('operativo', 'clientes:finanzas:view',        false),
  ('operativo', 'vehiculos:view',                true),
  ('operativo', 'vehiculos:edit',                true),
  ('operativo', 'turnos:view',                   true),
  ('operativo', 'turnos:edit',                   true);

-- RPC: devuelve los permisos concedidos al rol del usuario llamante.
-- Usa security definer para acceder a la tabla sin exponer RLS al cliente.
-- El claim 'user_role' es inyectado por el JWT de Supabase Auth.
create or replace function public.get_my_permissions()
returns text[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(permission), '{}'::text[])
  from public.role_permissions
  where role::text = (auth.jwt() ->> 'user_role')
    and granted = true;
$$;

grant execute on function public.get_my_permissions() to authenticated;
