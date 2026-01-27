CREATE TYPE tipo_operacion AS ENUM (
    'COMPRA',
    'VENTA',
    'ASIGNACION_ARREGLO',
    'AJUSTE',
    'TRANSFERENCIA'
);

CREATE TABLE IF NOT EXISTS operaciones (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) default ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  tipo       tipo_operacion NOT NULL,
  taller_id  uuid not null references public.talleres(id) on delete cascade,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operaciones_tenant ON public.operaciones (tenant_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_tenant_taller ON public.operaciones (tenant_id, taller_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_tenant_tipo_created ON public.operaciones (tenant_id, tipo, created_at DESC);

CREATE TABLE IF NOT EXISTS operaciones_lineas(
    id uuid primary key default gen_random_uuid(),
    operacion_id uuid not null references public.operaciones(id) on delete cascade,
    producto_id uuid not null references public.productos(id) on delete cascade,
    cantidad integer not null default 0,
    monto_unitario numeric(12,2) not null default 0,
    delta_cantidad integer not null default 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operaciones_lineas_operacion_id ON public.operaciones_lineas (operacion_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_lineas_producto_id ON public.operaciones_lineas (producto_id);
CREATE UNIQUE INDEX uq_operaciones_lineas_operacion_producto ON operaciones_lineas (operacion_id, producto_id);


CREATE TABLE IF NOT EXISTS operaciones_asignacion_arreglo(
    operacion_id uuid not null references public.operaciones(id) on delete cascade,
    arreglo_id uuid not null references public.arreglos(id) on delete cascade
);

ALTER TABLE public.operaciones_asignacion_arreglo
ADD CONSTRAINT pk_operaciones_asignacion_arreglo
PRIMARY KEY (operacion_id);

CREATE INDEX IF NOT EXISTS idx_op_asig_arreglo_arreglo_id ON public.operaciones_asignacion_arreglo (arreglo_id);

alter table public.operaciones enable row level security;
drop policy if exists tenant_access on public.operaciones;
create policy tenant_access
on public.operaciones
to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

alter table public.operaciones_lineas enable row level security;
drop policy if exists tenant_access on public.operaciones_lineas;
create policy tenant_access
on public.operaciones_lineas
to authenticated
using (
  exists (
    select 1
    from public.operaciones o
    where o.id = operacion_id
      and o.tenant_id = public.current_tenant_id()
  )
)
with check (
  exists (
    select 1
    from public.operaciones o
    where o.id = operacion_id
      and o.tenant_id = public.current_tenant_id()
  )
);

alter table public.operaciones_asignacion_arreglo enable row level security;
drop policy if exists tenant_access on public.operaciones_asignacion_arreglo;
create policy tenant_access
on public.operaciones_asignacion_arreglo
to authenticated
using (
  exists (
    select 1
    from public.operaciones o
    where o.id = operacion_id
      and o.tenant_id = public.current_tenant_id()
  )
)
with check (
  exists (
    select 1
    from public.operaciones o
    where o.id = operacion_id
      and o.tenant_id = public.current_tenant_id()
  )
);
