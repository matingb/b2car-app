CREATE TYPE turno_estado AS ENUM (
    'pendiente',
    'confirmado',
    'cancelado',
    'finalizado'
);

CREATE TABLE turnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    duracion INTEGER,
    vehiculo_id UUID NOT NULL REFERENCES vehiculos(id),
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    tipo TEXT,
    estado turno_estado NOT NULL DEFAULT 'pendiente',
    descripcion TEXT,
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_turnos_fecha ON turnos(fecha);
CREATE INDEX idx_turnos_vehiculo ON turnos(vehiculo_id);
CREATE INDEX idx_turnos_cliente ON turnos(cliente_id);
CREATE INDEX idx_turnos_estado ON turnos(estado);
CREATE INDEX idx_turnos_tenant_fecha_hora ON turnos (tenant_id, fecha, hora);