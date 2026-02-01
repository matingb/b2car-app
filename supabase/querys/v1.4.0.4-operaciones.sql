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
    stock_id uuid not null references public.stocks(id) on delete cascade,
    cantidad integer not null default 0,
    monto_unitario numeric(12,2) not null default 0,
    delta_cantidad integer not null default 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operaciones_lineas_operacion_id ON public.operaciones_lineas (operacion_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_lineas_stock_id ON public.operaciones_lineas (stock_id);
CREATE UNIQUE INDEX uq_operaciones_lineas_operacion_stock ON operaciones_lineas (operacion_id, stock_id);


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

-- RPC: crea operación + líneas + aplica stock (atómico)
-- lineas: JSONB array de objetos:
--   [
--     {"stock_id":"uuid", "cantidad": 3, "monto_unitario": 1200.50},
--     ...
--   ]
-- Para AJUSTE podés mandar opcionalmente "delta_cantidad" (puede ser + o -).
-- Para TRANSFERENCIA, por cómo está tu modelo hoy (sin taller_destino), exige "delta_cantidad".
CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock(
  p_tipo       public.tipo_operacion,
  p_taller_id  uuid,
  p_lineas     jsonb,
  p_arreglo_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid;
  v_operacion_id uuid;

  l jsonb;
  v_stock_id uuid;
  v_cantidad    int;
  v_monto       numeric(12,2);
  v_delta       int;

  v_rowcount int;
  v_expected_ids int;
  v_found_ids int;
BEGIN
  -- tenant desde JWT del caller
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_lineas IS NULL
     OR jsonb_typeof(p_lineas) <> 'array'
     OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'lineas debe ser un array no vacío';
  END IF;

  -- Validar existencia de stocks (y que correspondan al taller)
  v_expected_ids := (
    SELECT COUNT(DISTINCT (line_elem ->> 'stock_id')::uuid)
    FROM jsonb_array_elements(p_lineas) AS line_elem
  );

  v_found_ids := (
    SELECT COUNT(*)
    FROM public.stocks s
    WHERE s.id IN (
      SELECT DISTINCT (line_elem ->> 'stock_id')::uuid
      FROM jsonb_array_elements(p_lineas) AS line_elem
    )
  );

  IF v_expected_ids <> v_found_ids THEN
    RAISE EXCEPTION 'Algún stock_id no existe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stocks s
    WHERE s.id IN (
      SELECT DISTINCT (line_elem ->> 'stock_id')::uuid
      FROM jsonb_array_elements(p_lineas) AS line_elem
    )
      AND s.taller_id <> p_taller_id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Algún stock_id no pertenece al taller';
  END IF;

  PERFORM 1
  FROM public.stocks s
  WHERE s.id IN (
    SELECT DISTINCT (line_elem ->> 'stock_id')::uuid
    FROM jsonb_array_elements(p_lineas) AS line_elem
  )
  FOR UPDATE;

  --  ----- CREA OPERACION --------
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id)
  VALUES (v_tenant_id, p_tipo, p_taller_id)
  RETURNING id INTO v_operacion_id;

  -- vínculo con arreglo
  IF p_tipo = 'ASIGNACION_ARREGLO' THEN
    IF p_arreglo_id IS NULL THEN
      RAISE EXCEPTION 'arreglo_id requerido para ASIGNACION_ARREGLO';
    END IF;

    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  END IF;

  -- líneas + stock
  FOR l IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_stock_id := (l ->> 'stock_id')::uuid;
    v_cantidad    := (l ->> 'cantidad')::int;
    v_monto       := COALESCE((l ->> 'monto_unitario')::numeric, 0);

    IF v_stock_id IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'linea inválida (stock_id %, cantidad %)', v_stock_id, v_cantidad;
    END IF;

    v_delta :=
      CASE p_tipo
        WHEN 'COMPRA' THEN  v_cantidad
        WHEN 'VENTA' THEN  -v_cantidad
        WHEN 'ASIGNACION_ARREGLO' THEN -v_cantidad
        WHEN 'AJUSTE' THEN
          COALESCE((l ->> 'delta_cantidad')::int, v_cantidad) -- TODO ESTO NO SE CALCULA ASI
        ELSE 0
      END;

    IF v_delta = 0 THEN
      RAISE EXCEPTION 'delta inválido para stock %', v_stock_id;
    END IF;

    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad
    )
    VALUES (
      v_operacion_id, v_stock_id, v_cantidad, v_monto, v_delta
    );

    -- aplicar stock
    IF v_delta < 0 THEN
      UPDATE public.stocks s
      SET cantidad = s.cantidad + v_delta,
          updated_at = now()
      WHERE s.id = v_stock_id
        AND s.cantidad >= (-v_delta);

      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id;
      END IF;

    ELSE
      UPDATE public.stocks s
      SET cantidad = s.cantidad + v_delta,
          updated_at = now()
      WHERE s.id = v_stock_id;

      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'stock no encontrado (%)', v_stock_id;
      END IF;
    END IF;
  END LOOP;

  RETURN v_operacion_id;
END;
$$;
