-- POC de facturacion electronica ARCA / AFIP SDK.
-- La emision y las escrituras fiscales se realizan exclusivamente desde el
-- servidor con service_role. Ningun secreto o contenido de certificado se
-- persiste en Postgres.

-- Perfil fiscal comun de clientes. empresas.cuit se conserva por compatibilidad.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_documento_fiscal smallint,
  ADD COLUMN IF NOT EXISTS numero_documento_fiscal text,
  ADD COLUMN IF NOT EXISTS condicion_iva_receptor_id smallint;

UPDATE public.clientes AS c
SET tipo_documento_fiscal = 80,
    numero_documento_fiscal = regexp_replace(e.cuit, '[^0-9]', '', 'g')
FROM public.empresas AS e
WHERE e.id = c.id
  AND NULLIF(regexp_replace(e.cuit, '[^0-9]', '', 'g'), '') IS NOT NULL
  AND c.tipo_documento_fiscal IS NULL;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_documento_fiscal_valido,
  ADD CONSTRAINT clientes_documento_fiscal_valido CHECK (
    (tipo_documento_fiscal IS NULL AND numero_documento_fiscal IS NULL)
    OR (
      tipo_documento_fiscal IN (80, 86, 96)
      AND numero_documento_fiscal ~ '^[0-9]{7,11}$'
    )
  ),
  DROP CONSTRAINT IF EXISTS clientes_condicion_iva_receptor_valida,
  ADD CONSTRAINT clientes_condicion_iva_receptor_valida CHECK (
    condicion_iva_receptor_id IS NULL
    OR condicion_iva_receptor_id IN (1, 4, 5, 6, 7, 8, 9, 10, 13, 15, 16)
  );

CREATE TABLE IF NOT EXISTS public.facturacion_configuracion_tenant (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  razon_social text NOT NULL,
  nombre_fantasia text,
  cuit text NOT NULL CHECK (cuit ~ '^[0-9]{11}$'),
  domicilio text NOT NULL,
  ingresos_brutos text,
  inicio_actividades date NOT NULL,
  punto_venta integer NOT NULL CHECK (punto_venta > 0),
  cert_subdirectory text NOT NULL CHECK (cert_subdirectory ~ '^[A-Za-z0-9._-]+$'),
  cert_filename text NOT NULL CHECK (cert_filename ~ '^[A-Za-z0-9._-]+\.(crt|pem)$'),
  key_filename text NOT NULL CHECK (key_filename ~ '^[A-Za-z0-9._-]+\.key$'),
  habilitada boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.facturas_electronicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  arreglo_id uuid NOT NULL REFERENCES public.arreglos(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  estado text NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'AUTORIZADA', 'RECHAZADA', 'INCIERTA')),
  ambiente text NOT NULL DEFAULT 'HOMOLOGACION' CHECK (ambiente = 'HOMOLOGACION'),
  emisor_snapshot jsonb NOT NULL,
  receptor_snapshot jsonb NOT NULL,
  concepto smallint NOT NULL CHECK (concepto IN (1, 2, 3)),
  fecha_comprobante date NOT NULL,
  fecha_servicio_desde date,
  fecha_servicio_hasta date,
  fecha_vencimiento_pago date,
  moneda text NOT NULL DEFAULT 'PES' CHECK (moneda = 'PES'),
  total numeric(14,2) NOT NULL CHECK (total > 0),
  punto_venta integer NOT NULL CHECK (punto_venta > 0),
  tipo_comprobante smallint NOT NULL DEFAULT 11 CHECK (tipo_comprobante = 11),
  numero_comprobante integer,
  cae text,
  cae_vencimiento date,
  error_codigo text,
  error_mensaje text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturas_electronicas_unica_por_arreglo UNIQUE (tenant_id, arreglo_id),
  CONSTRAINT facturas_electronicas_idempotencia_unica UNIQUE (tenant_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS facturas_electronicas_numero_emisor_unico
  ON public.facturas_electronicas (
    ((emisor_snapshot ->> 'cuit')), punto_venta, tipo_comprobante, numero_comprobante
  )
  WHERE numero_comprobante IS NOT NULL;

CREATE INDEX IF NOT EXISTS facturas_electronicas_tenant_estado_idx
  ON public.facturas_electronicas (tenant_id, estado, created_at DESC);

CREATE TABLE IF NOT EXISTS public.facturas_electronicas_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid NOT NULL REFERENCES public.facturas_electronicas(id) ON DELETE CASCADE,
  ordinal smallint NOT NULL CHECK (ordinal > 0),
  origen text NOT NULL CHECK (origen IN ('SERVICIO', 'FORMULARIO', 'REPUESTO')),
  source_id uuid,
  descripcion text NOT NULL,
  codigo text,
  cantidad numeric(14,4) NOT NULL CHECK (cantidad > 0),
  importe_unitario numeric(14,2) NOT NULL CHECK (importe_unitario >= 0),
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT facturas_electronicas_lineas_ordinal_unico UNIQUE (factura_id, ordinal)
);

CREATE TABLE IF NOT EXISTS public.facturacion_emision_intentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid NOT NULL REFERENCES public.facturas_electronicas(id) ON DELETE CASCADE,
  numero_intento integer NOT NULL CHECK (numero_intento > 0),
  estado text NOT NULL CHECK (estado IN ('ENVIADO', 'AUTORIZADO', 'RECHAZADO', 'INCIERTO')),
  candidato jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_sanitizado jsonb,
  response_sanitizada jsonb,
  error_codigo text,
  error_mensaje text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT facturacion_emision_intentos_numero_unico UNIQUE (factura_id, numero_intento)
);

-- Una lease durable evita que dos procesos generen el mismo numero de factura.
CREATE TABLE IF NOT EXISTS public.facturacion_emision_leases (
  emisor_cuit text NOT NULL CHECK (emisor_cuit ~ '^[0-9]{11}$'),
  punto_venta integer NOT NULL CHECK (punto_venta > 0),
  tipo_comprobante smallint NOT NULL DEFAULT 11 CHECK (tipo_comprobante = 11),
  lease_token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (emisor_cuit, punto_venta, tipo_comprobante)
);

CREATE OR REPLACE FUNCTION public.facturacion_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS facturacion_configuracion_set_updated_at ON public.facturacion_configuracion_tenant;
CREATE TRIGGER facturacion_configuracion_set_updated_at
BEFORE UPDATE ON public.facturacion_configuracion_tenant
FOR EACH ROW EXECUTE FUNCTION public.facturacion_set_updated_at();

DROP TRIGGER IF EXISTS facturas_electronicas_set_updated_at ON public.facturas_electronicas;
CREATE TRIGGER facturas_electronicas_set_updated_at
BEFORE UPDATE ON public.facturas_electronicas
FOR EACH ROW EXECUTE FUNCTION public.facturacion_set_updated_at();

CREATE OR REPLACE FUNCTION public.rpc_facturacion_adquirir_lease(
  p_emisor_cuit text,
  p_punto_venta integer,
  p_tipo_comprobante smallint,
  p_lease_token uuid,
  p_segundos integer DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_emisor_cuit !~ '^[0-9]{11}$' OR p_punto_venta IS NULL OR p_punto_venta <= 0
     OR p_tipo_comprobante <> 11 OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Parametros de lease fiscal invalidos';
  END IF;

  INSERT INTO public.facturacion_emision_leases (
    emisor_cuit, punto_venta, tipo_comprobante, lease_token, expires_at, updated_at
  ) VALUES (
    p_emisor_cuit, p_punto_venta, p_tipo_comprobante, p_lease_token,
    now() + make_interval(secs => LEAST(GREATEST(COALESCE(p_segundos, 90), 15), 300)), now()
  )
  ON CONFLICT (emisor_cuit, punto_venta, tipo_comprobante) DO UPDATE
    SET lease_token = EXCLUDED.lease_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = now()
    WHERE public.facturacion_emision_leases.expires_at < now()
       OR public.facturacion_emision_leases.lease_token = EXCLUDED.lease_token;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_facturacion_liberar_lease(
  p_emisor_cuit text,
  p_punto_venta integer,
  p_tipo_comprobante smallint,
  p_lease_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.facturacion_emision_leases
  WHERE emisor_cuit = p_emisor_cuit
    AND punto_venta = p_punto_venta
    AND tipo_comprobante = p_tipo_comprobante
    AND lease_token = p_lease_token;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_facturacion_adquirir_lease(text, integer, smallint, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_facturacion_liberar_lease(text, integer, smallint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_adquirir_lease(text, integer, smallint, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_liberar_lease(text, integer, smallint, uuid) TO service_role;

-- A partir de una factura autorizada, solo se permiten cambios no fiscales
-- (por ejemplo observaciones) sobre el arreglo. Las lineas quedan inmutables.
CREATE OR REPLACE FUNCTION public.facturacion_arreglo_autorizado(p_arreglo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.facturas_electronicas f
    WHERE f.arreglo_id = p_arreglo_id AND f.estado = 'AUTORIZADA'
  );
$$;

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_arreglo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_arreglo_id uuid;
  v_protegido boolean;
BEGIN
  IF TG_TABLE_NAME = 'arreglos' THEN
    v_arreglo_id := COALESCE(NEW.id, OLD.id);
    v_protegido := public.facturacion_arreglo_autorizado(v_arreglo_id);
    IF NOT v_protegido THEN RETURN COALESCE(NEW, OLD); END IF;
    IF TG_OP = 'DELETE'
       OR OLD.vehiculo_id IS DISTINCT FROM NEW.vehiculo_id
       OR OLD.taller_id IS DISTINCT FROM NEW.taller_id
       OR OLD.fecha IS DISTINCT FROM NEW.fecha
       OR OLD.precio_final IS DISTINCT FROM NEW.precio_final
       OR OLD.precio_sin_iva IS DISTINCT FROM NEW.precio_sin_iva
       OR OLD.estado IS DISTINCT FROM NEW.estado THEN
      RAISE EXCEPTION 'El arreglo ya posee una factura electronica autorizada y sus datos fiscales no se pueden modificar';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'vehiculos' THEN
    IF TG_OP = 'UPDATE' AND OLD.cliente_id IS NOT DISTINCT FROM NEW.cliente_id THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.arreglos a
      WHERE a.vehiculo_id = COALESCE(NEW.id, OLD.id)
        AND public.facturacion_arreglo_autorizado(a.id)
    ) THEN
      RAISE EXCEPTION 'No se puede cambiar el cliente de un vehiculo con arreglos facturados';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'operaciones_lineas' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = COALESCE(NEW.operacion_id, OLD.operacion_id)
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'operaciones' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = COALESCE(NEW.id, OLD.id)
    LIMIT 1;
  ELSE
    v_arreglo_id := COALESCE(NEW.arreglo_id, OLD.arreglo_id);
  END IF;

  IF v_arreglo_id IS NOT NULL AND public.facturacion_arreglo_autorizado(v_arreglo_id) THEN
    RAISE EXCEPTION 'No se pueden modificar lineas de un arreglo con factura electronica autorizada';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS facturacion_proteger_arreglos ON public.arreglos;
CREATE TRIGGER facturacion_proteger_arreglos
BEFORE UPDATE OR DELETE ON public.arreglos
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

DROP TRIGGER IF EXISTS facturacion_proteger_vehiculos ON public.vehiculos;
CREATE TRIGGER facturacion_proteger_vehiculos
BEFORE UPDATE OF cliente_id ON public.vehiculos
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

DROP TRIGGER IF EXISTS facturacion_proteger_detalle_arreglo ON public.detalle_arreglo;
CREATE TRIGGER facturacion_proteger_detalle_arreglo
BEFORE INSERT OR UPDATE OR DELETE ON public.detalle_arreglo
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

DROP TRIGGER IF EXISTS facturacion_proteger_detalle_form_custom ON public.detalle_form_custom;
CREATE TRIGGER facturacion_proteger_detalle_form_custom
BEFORE INSERT OR UPDATE OR DELETE ON public.detalle_form_custom
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

DROP TRIGGER IF EXISTS facturacion_proteger_asignacion_arreglo ON public.operaciones_asignacion_arreglo;
CREATE TRIGGER facturacion_proteger_asignacion_arreglo
BEFORE INSERT OR UPDATE OR DELETE ON public.operaciones_asignacion_arreglo
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

DROP TRIGGER IF EXISTS facturacion_proteger_operaciones_lineas ON public.operaciones_lineas;
CREATE TRIGGER facturacion_proteger_operaciones_lineas
BEFORE INSERT OR UPDATE OR DELETE ON public.operaciones_lineas
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

DROP TRIGGER IF EXISTS facturacion_proteger_operaciones ON public.operaciones;
CREATE TRIGGER facturacion_proteger_operaciones
BEFORE DELETE ON public.operaciones
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

ALTER TABLE public.facturacion_configuracion_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_electronicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_electronicas_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturacion_emision_intentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturacion_emision_leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY facturacion_configuracion_lectura_admin
  ON public.facturacion_configuracion_tenant
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

CREATE POLICY facturas_electronicas_lectura_tenant
  ON public.facturas_electronicas
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY facturas_electronicas_lineas_lectura_tenant
  ON public.facturas_electronicas_lineas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = factura_id AND f.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY facturacion_intentos_lectura_admin
  ON public.facturacion_emision_intentos
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = factura_id AND f.tenant_id = public.current_tenant_id()
    )
  );

REVOKE ALL ON TABLE public.facturacion_configuracion_tenant,
  public.facturas_electronicas,
  public.facturas_electronicas_lineas,
  public.facturacion_emision_intentos,
  public.facturacion_emision_leases FROM anon, authenticated;

GRANT SELECT ON TABLE public.facturacion_configuracion_tenant TO authenticated;
GRANT SELECT ON TABLE public.facturas_electronicas,
  public.facturas_electronicas_lineas,
  public.facturacion_emision_intentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.facturacion_configuracion_tenant,
  public.facturas_electronicas,
  public.facturas_electronicas_lineas,
  public.facturacion_emision_intentos,
  public.facturacion_emision_leases TO service_role;
