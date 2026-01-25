create table if not exists public.talleres (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) default ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  nombre text not null,
  ubicacion text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists talleres_tenant_id_idx
  on public.talleres (tenant_id);

drop trigger if exists talleres_set_updated_at on public.talleres;
create trigger talleres_set_updated_at
before update on public.talleres
for each row
execute function public.update_updated_at_column();