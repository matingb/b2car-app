--
-- Las querys se deben ejecutar en orden descendente, ya que ese es el orden en que fueron aplicadas en desarrollo
--
CREATE OR REPLACE VIEW vista_vehiculos_con_clientes AS
SELECT
  v.id,
  COALESCE(
    NULLIF(TRIM(CONCAT(p.nombre, ' ', p.apellido)), ''),
    e.nombre
  )::text AS nombre_cliente,
  v.patente,
  v.marca,
  v.modelo,
  v.fecha_patente
FROM vehiculos v
JOIN clientes c ON v.cliente_id = c.id
LEFT JOIN particulares p ON c.id = p.id
LEFT JOIN empresas e ON c.id = e.id;

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'activo',
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.fecha_actualizacion = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenant_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE tenant_members (
    cliente_id UUID PRIMARY KEY REFERENCES auth.users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    rol VARCHAR(50) DEFAULT 'admin', 
    UNIQUE (cliente_id, tenant_id) 
);

INSERT INTO tenants (nombre)
VALUES ('Car Max');

INSERT INTO tenants (nombre)
VALUES ('DevTenant');

INSERT INTO tenant_members (cliente_id, tenant_id)
VALUES ('9784ac2e-fa7a-458a-b48a-aea59cd21333','d36acc3b-7685-4562-8b7f-60755ad328fa');

-- Se agrega columna tenant_id a la tabla clientes, vehiculos y arreglos

ALTER TABLE clientes
ADD COLUMN tenant_id UUID,
ALTER COLUMN tenant_id SET DEFAULT 'd36acc3b-7685-4562-8b7f-60755ad328fa'; -- UUID de DevTenant

ALTER TABLE clientes
ALTER COLUMN tenant_id SET NOT NULL; -- Esta se ejecuta luego de tener todas las filas sin NULL

ALTER TABLE clientes
ADD CONSTRAINT fk_clientes_tenant
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT;

ALTER TABLE vehiculos
ADD COLUMN tenant_id UUID,
ALTER COLUMN tenant_id SET DEFAULT 'd36acc3b-7685-4562-8b7f-60755ad328fa'; -- UUID de DevTenant

ALTER TABLE vehiculos
ALTER COLUMN tenant_id SET NOT NULL; -- Esta se ejecuta luego de tener todas las filas sin NULL

ALTER TABLE vehiculos
ADD CONSTRAINT fk_vehiculos_tenant
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT;

ALTER TABLE arreglos
ADD COLUMN tenant_id UUID,
ALTER COLUMN tenant_id SET DEFAULT 'd36acc3b-7685-4562-8b7f-60755ad328fa'; -- UUID de DevTenant

ALTER TABLE arreglos
ALTER COLUMN tenant_id SET NOT NULL; -- Esta se ejecuta luego de tener todas las filas sin NULL

ALTER TABLE arreglos
ADD CONSTRAINT fk_arreglos_tenant
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT;

-- Se crea funcion para agregar claims personalizados al JWT
-- Esta funcion se define como un Auth Hook desde el dashboard de Supabase

CREATE OR REPLACE FUNCTION public.custom_claims(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims      jsonb;
  tenant_uuid uuid;
  user_id     uuid;
  user_role   text;
BEGIN
  claims := event->'claims';

  IF claims IS NULL OR jsonb_typeof(claims) IS NULL THEN
    RETURN event;
  END IF;

  user_id := (claims->>'sub')::uuid;

  SELECT tm.tenant_id, tm.rol
    INTO tenant_uuid, user_role
  FROM public.tenant_members tm
  WHERE tm.cliente_id = user_id
  LIMIT 1;

  IF tenant_uuid IS NULL THEN
    RETURN event;
  END IF;

  claims := claims
    || jsonb_build_object('tenant_id', tenant_uuid)
    || jsonb_build_object('user_role', user_role);

  -- 4. Actualizar claims dentro de event
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Se crean indices para optimizar consultas filtradas por tenant_id

CREATE INDEX idx_clientes_tenant_id ON clientes(tenant_id);
CREATE INDEX idx_vehiculos_tenant_id ON vehiculos(tenant_id);
CREATE INDEX idx_arreglos_tenant_id ON arreglos(tenant_id);

-- Se actualizan los default de tenant_id para que tomen el valor desde el JWT
ALTER TABLE public.vehiculos
ALTER COLUMN tenant_id
SET DEFAULT ((auth.jwt() ->> 'tenant_id')::uuid);

ALTER TABLE public.clientes
ALTER COLUMN tenant_id
SET DEFAULT ((auth.jwt() ->> 'tenant_id')::uuid);

ALTER TABLE public.arreglos
ALTER COLUMN tenant_id
SET DEFAULT ((auth.jwt() ->> 'tenant_id')::uuid);

-- Se deja un ejemplo de como debe ser la politica RLS para cada tabla que tenga tenant_id NO CORRER
-- Tambien se pueden crear desde el Dasboard de Supabase
CREATE POLICY [NOMBRE_POLITICA]
ON [ESQUEMA].[NOMBRE_TABLA]
FOR UPDATE -- Aca poner el tipo de operacion: SELECT, INSERT, UPDATE, DELETE o ALL
USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid) -- Se usa para SELECT, UPDATE y DELETE
WITH CHECK (tenant_id = (auth.jwt()->>'tenant_id')::uuid); -- Se usa para INSERT y UPDATE

CREATE POLICY tenant_access
ON public.vehiculos
FOR ALL 
TO authenticated
USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);
WITH CHECK (tenant_id = (auth.jwt()->>'tenant_id')::uuid);
