-- v1.5.0 - DetalleArreglo (servicios) por arreglo

CREATE TABLE IF NOT EXISTS public.detalle_arreglo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) default ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  arreglo_id uuid not null references public.arreglos(id) on delete cascade,
  descripcion text not null,
  cantidad integer not null default 1,
  valor numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint detalle_arreglo_cantidad_pos check (cantidad > 0),
  constraint detalle_arreglo_valor_nonneg check (valor >= 0)
);

CREATE INDEX IF NOT EXISTS idx_detalle_arreglo_arreglo_id ON public.detalle_arreglo (arreglo_id);
CREATE INDEX IF NOT EXISTS idx_detalle_arreglo_tenant_arreglo ON public.detalle_arreglo (tenant_id, arreglo_id);

-- Mantener updated_at al actualizar filas
DROP TRIGGER IF EXISTS detalle_arreglo_set_updated_at ON public.detalle_arreglo;
CREATE TRIGGER detalle_arreglo_set_updated_at
BEFORE UPDATE ON public.detalle_arreglo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.detalle_arreglo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_access ON public.detalle_arreglo;
CREATE POLICY tenant_access
ON public.detalle_arreglo
TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

