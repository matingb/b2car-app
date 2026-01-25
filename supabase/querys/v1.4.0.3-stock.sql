create table if not exists public.stocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) default ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  taller_id uuid not null references public.talleres(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  cantidad integer not null default 0,
  stock_minimo integer not null default 0,
  stock_maximo integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stocks_cantidad_nonneg check (cantidad >= 0),
  constraint stocks_min_nonneg check (stock_minimo >= 0),
  constraint stocks_max_nonneg check (stock_maximo >= 0)
);

create unique index if not exists stocks_taller_producto_unique
  on public.stocks (taller_id, producto_id);

create index if not exists stocks_tenant_id_idx
  on public.stocks (tenant_id);

create index if not exists stocks_productoId_idx
  on public.stocks (producto_id);

create index if not exists stocks_tallerId_idx
  on public.stocks (taller_id);

drop trigger if exists stocks_set_updated_at on public.stocks;
create trigger stocks_set_updated_at
before update on public.stocks
for each row
execute function public.update_updated_at_column();

alter table public.stocks enable row level security;
drop policy if exists tenant_access on public.stocks;
create policy tenant_access
on public.stocks
to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stocks_taller_producto_unique_constraint'
      and conrelid = 'public.stocks'::regclass
  ) then
    alter table public.stocks
      add constraint stocks_taller_producto_unique_constraint
      unique using index stocks_taller_producto_unique;
  end if;
end $$;
