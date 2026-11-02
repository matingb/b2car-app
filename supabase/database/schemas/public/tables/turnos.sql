CREATE TABLE public.turnos (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  fecha         date                     NOT NULL,
  hora          time without time zone   NOT NULL,
  duracion      integer,
  vehiculo_id   uuid,
  cliente_id    uuid,
  tenant_id     uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  tipo          text,
  estado        public.turno_estado      DEFAULT 'pendiente'::public.turno_estado NOT NULL,
  descripcion   text,
  observaciones text,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL,
  titulo        text                     NOT NULL,
  taller_id     uuid                     NOT NULL
);

CREATE INDEX idx_turnos_vehiculo ON public.turnos (vehiculo_id);

CREATE INDEX idx_turnos_taller_fecha_hora ON public.turnos (taller_id, fecha, hora);

CREATE INDEX idx_turnos_fecha ON public.turnos (fecha);

CREATE INDEX idx_turnos_estado ON public.turnos (estado);

CREATE INDEX idx_turnos_cliente ON public.turnos (cliente_id);

CREATE POLICY tenant_access ON public.turnos
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.turnos
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_pkey PRIMARY KEY (id);

ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_taller_id_fkey FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE;

ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE SET NULL;

GRANT ALL ON public.turnos TO anon;

GRANT ALL ON public.turnos TO authenticated;

GRANT ALL ON public.turnos TO service_role;