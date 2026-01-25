create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) default ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  codigo text not null,
  nombre text not null,
  marca text,
  modelo text,
  descripcion text,
  precio_unitario numeric not null default 0,
  costo_unitario numeric not null default 0,
  proveedor text,
  categorias text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint productos_precio_nonneg check (precio_unitario >= 0),
  constraint productos_costo_nonneg check (costo_unitario >= 0)
);

create index if not exists productos_tenant_id_idx
  on public.productos (tenant_id);

drop trigger if exists productos_set_updated_at on public.productos;
create trigger productos_set_updated_at
before update on public.productos
for each row
execute function public.update_updated_at_column();

alter table public.productos enable row level security;
drop policy if exists tenant_access on public.productos;
create policy tenant_access
on public.productos
to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());