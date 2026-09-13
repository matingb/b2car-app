-- Evolución del POC fiscal a un módulo multiambiente, multi-origen y auditable.
-- Los documentos previos se conservan como facturas C de homologación.

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_documento_fiscal_valido,
  ADD CONSTRAINT clientes_documento_fiscal_valido CHECK (
    (tipo_documento_fiscal IS NULL AND numero_documento_fiscal IS NULL)
    OR (
      tipo_documento_fiscal IN (80, 86, 96)
      AND numero_documento_fiscal ~ '^[0-9]{7,11}$'
    )
  ),
  ADD COLUMN IF NOT EXISTS fce_mipyme_alcanzado boolean NOT NULL DEFAULT false;

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS iva_alicuota_id smallint NOT NULL DEFAULT 5
    CHECK (iva_alicuota_id IN (3, 4, 5, 6, 8, 9));

ALTER TABLE public.detalle_arreglo
  ADD COLUMN IF NOT EXISTS iva_alicuota_id smallint NOT NULL DEFAULT 5
    CHECK (iva_alicuota_id IN (3, 4, 5, 6, 8, 9));

ALTER TABLE public.operaciones_lineas
  ADD COLUMN IF NOT EXISTS iva_alicuota_id smallint NOT NULL DEFAULT 5
    CHECK (iva_alicuota_id IN (3, 4, 5, 6, 8, 9));

ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS operaciones_cliente_idx
  ON public.operaciones (tenant_id, cliente_id)
  WHERE cliente_id IS NOT NULL;

CREATE TABLE public.facturacion_configuracion_ambiente (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ambiente text NOT NULL CHECK (ambiente IN ('HOMOLOGACION', 'PRODUCCION')),
  razon_social text NOT NULL,
  nombre_fantasia text,
  cuit text NOT NULL CHECK (cuit ~ '^[0-9]{11}$'),
  condicion_iva_emisor text NOT NULL DEFAULT 'MONOTRIBUTISTA'
    CHECK (condicion_iva_emisor IN ('MONOTRIBUTISTA', 'RESPONSABLE_INSCRIPTO')),
  domicilio text NOT NULL,
  ingresos_brutos text,
  inicio_actividades date NOT NULL,
  punto_venta integer NOT NULL CHECK (punto_venta > 0),
  habilitada boolean NOT NULL DEFAULT false,
  cert_storage_path text,
  key_storage_path text,
  cert_original_filename text,
  key_original_filename text,
  cert_fingerprint_sha256 text,
  cert_expires_at timestamptz,
  credenciales_updated_at timestamptz,
  credenciales_updated_by uuid,
  fce_monto_minimo numeric(14,2) CHECK (fce_monto_minimo IS NULL OR fce_monto_minimo > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, ambiente),
  CONSTRAINT facturacion_config_ambiente_credenciales_completas CHECK (
    (
      cert_storage_path IS NULL AND key_storage_path IS NULL
      AND cert_original_filename IS NULL AND key_original_filename IS NULL
      AND cert_fingerprint_sha256 IS NULL AND cert_expires_at IS NULL
    ) OR (
      NULLIF(btrim(cert_storage_path), '') IS NOT NULL
      AND NULLIF(btrim(key_storage_path), '') IS NOT NULL
      AND NULLIF(btrim(cert_original_filename), '') IS NOT NULL
      AND NULLIF(btrim(key_original_filename), '') IS NOT NULL
      AND cert_fingerprint_sha256 ~ '^[A-F0-9:]{95}$'
      AND cert_expires_at IS NOT NULL
    )
  )
);

CREATE TABLE public.facturacion_parametros_normativos (
  clave text NOT NULL,
  vigente_desde date NOT NULL,
  valor_numerico numeric(18,2),
  fuente text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clave, vigente_desde)
);

INSERT INTO public.facturacion_parametros_normativos (
  clave, vigente_desde, valor_numerico, fuente
) VALUES (
  'CONSUMIDOR_FINAL_IDENTIFICACION', DATE '2025-07-01', 10000000,
  'https://www.arca.gob.ar/fe/emision-autorizacion/datos-comprobantes.asp'
);

INSERT INTO public.facturacion_configuracion_ambiente (
  tenant_id, ambiente, razon_social, nombre_fantasia, cuit,
  condicion_iva_emisor, domicilio, ingresos_brutos, inicio_actividades,
  punto_venta, habilitada, cert_storage_path, key_storage_path,
  cert_original_filename, key_original_filename, cert_fingerprint_sha256,
  cert_expires_at, credenciales_updated_at, credenciales_updated_by,
  created_at, updated_at
)
SELECT
  tenant_id, 'HOMOLOGACION', razon_social, nombre_fantasia, cuit,
  'MONOTRIBUTISTA', domicilio, ingresos_brutos, inicio_actividades,
  punto_venta, habilitada, cert_storage_path, key_storage_path,
  cert_original_filename, key_original_filename, cert_fingerprint_sha256,
  cert_expires_at, credenciales_updated_at, credenciales_updated_by,
  created_at, updated_at
FROM public.facturacion_configuracion_tenant;

CREATE TRIGGER facturacion_config_ambiente_set_updated_at
BEFORE UPDATE ON public.facturacion_configuracion_ambiente
FOR EACH ROW EXECUTE FUNCTION public.facturacion_set_updated_at();

ALTER TABLE public.facturas_electronicas
  DROP CONSTRAINT IF EXISTS facturas_electronicas_unica_por_arreglo,
  DROP CONSTRAINT IF EXISTS facturas_electronicas_estado_check,
  DROP CONSTRAINT IF EXISTS facturas_electronicas_ambiente_check,
  DROP CONSTRAINT IF EXISTS facturas_electronicas_moneda_check,
  DROP CONSTRAINT IF EXISTS facturas_electronicas_tipo_comprobante_check,
  ALTER COLUMN arreglo_id DROP NOT NULL,
  ALTER COLUMN estado SET DEFAULT 'BORRADOR',
  ADD COLUMN IF NOT EXISTS origen_tipo text NOT NULL DEFAULT 'ARREGLO',
  ADD COLUMN IF NOT EXISTS operacion_id uuid REFERENCES public.operaciones(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS documento_tipo text NOT NULL DEFAULT 'FACTURA',
  ADD COLUMN IF NOT EXISTS documento_asociado_id uuid REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS clase_comprobante text NOT NULL DEFAULT 'C',
  ADD COLUMN IF NOT EXISTS condicion_venta text NOT NULL DEFAULT 'CONTADO',
  ADD COLUMN IF NOT EXISTS importe_neto_gravado numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importe_no_gravado numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importe_exento numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importe_iva numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importe_tributos numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otros_impuestos_nacionales numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contenido_hash text,
  ADD COLUMN IF NOT EXISTS autorizada_at timestamptz,
  ADD COLUMN IF NOT EXISTS origen_externo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS pdf_sha256 text,
  ADD COLUMN IF NOT EXISTS pdf_template_version text;

ALTER TABLE public.facturas_electronicas
  DISABLE TRIGGER facturacion_snapshot_factura_inmutable;

UPDATE public.facturas_electronicas
SET estado = CASE estado WHEN 'PENDIENTE' THEN 'ENVIANDO' ELSE estado END,
    origen_tipo = 'ARREGLO', documento_tipo = 'FACTURA', clase_comprobante = 'C',
    importe_neto_gravado = total,
    autorizada_at = CASE WHEN estado = 'AUTORIZADA' THEN updated_at ELSE autorizada_at END;

ALTER TABLE public.facturas_electronicas
  ENABLE TRIGGER facturacion_snapshot_factura_inmutable;

ALTER TABLE public.facturas_electronicas
  ADD CONSTRAINT facturas_electronicas_estado_check
    CHECK (estado IN ('BORRADOR', 'LISTA', 'ENVIANDO', 'AUTORIZADA', 'RECHAZADA', 'INCIERTA')),
  ADD CONSTRAINT facturas_electronicas_ambiente_check
    CHECK (ambiente IN ('HOMOLOGACION', 'PRODUCCION')),
  ADD CONSTRAINT facturas_electronicas_moneda_check CHECK (moneda = 'PES'),
  ADD CONSTRAINT facturas_electronicas_tipo_comprobante_check
    CHECK (tipo_comprobante IN (1, 2, 3, 6, 7, 8, 11, 12, 13, 51, 52, 53)),
  ADD CONSTRAINT facturas_electronicas_origen_tipo_check
    CHECK (origen_tipo IN ('ARREGLO', 'VENTA')),
  ADD CONSTRAINT facturas_electronicas_documento_tipo_check
    CHECK (documento_tipo IN ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO')),
  ADD CONSTRAINT facturas_electronicas_clase_check
    CHECK (clase_comprobante IN ('A', 'B', 'C', 'M')),
  ADD CONSTRAINT facturas_electronicas_origen_check CHECK (
    (origen_tipo = 'ARREGLO' AND arreglo_id IS NOT NULL AND operacion_id IS NULL)
    OR (origen_tipo = 'VENTA' AND operacion_id IS NOT NULL AND arreglo_id IS NULL)
  ),
  ADD CONSTRAINT facturas_electronicas_asociacion_check CHECK (
    (documento_tipo = 'FACTURA' AND documento_asociado_id IS NULL)
    OR (documento_tipo IN ('NOTA_CREDITO', 'NOTA_DEBITO') AND documento_asociado_id IS NOT NULL)
  ),
  ADD CONSTRAINT facturas_electronicas_totales_no_negativos CHECK (
    importe_neto_gravado >= 0 AND importe_no_gravado >= 0
    AND importe_exento >= 0 AND importe_iva >= 0
    AND importe_tributos >= 0 AND otros_impuestos_nacionales >= 0
  );

DROP INDEX IF EXISTS public.facturas_electronicas_numero_emisor_unico;
CREATE UNIQUE INDEX facturas_electronicas_numero_emisor_unico
  ON public.facturas_electronicas (
    ambiente, ((emisor_snapshot ->> 'cuit')), punto_venta,
    tipo_comprobante, numero_comprobante
  ) WHERE numero_comprobante IS NOT NULL;

CREATE INDEX facturas_electronicas_tenant_fecha_idx
  ON public.facturas_electronicas (tenant_id, fecha_comprobante DESC, created_at DESC);
CREATE INDEX facturas_electronicas_arreglo_idx
  ON public.facturas_electronicas (tenant_id, arreglo_id, created_at DESC)
  WHERE arreglo_id IS NOT NULL;
CREATE INDEX facturas_electronicas_operacion_idx
  ON public.facturas_electronicas (tenant_id, operacion_id, created_at DESC)
  WHERE operacion_id IS NOT NULL;
CREATE INDEX facturas_electronicas_asociado_idx
  ON public.facturas_electronicas (documento_asociado_id)
  WHERE documento_asociado_id IS NOT NULL;

ALTER TABLE public.facturas_electronicas_lineas
  DROP CONSTRAINT IF EXISTS facturas_electronicas_lineas_origen_check,
  ADD COLUMN IF NOT EXISTS tratamiento_iva text NOT NULL DEFAULT 'GRAVADO',
  ADD COLUMN IF NOT EXISTS iva_alicuota_id smallint,
  ADD COLUMN IF NOT EXISTS iva_alicuota numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importe_neto numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importe_iva numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importe_total numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.facturas_electronicas_lineas
  DISABLE TRIGGER facturacion_snapshot_lineas_inmutables;

UPDATE public.facturas_electronicas_lineas
SET importe_neto = subtotal, importe_total = subtotal
WHERE importe_total = 0;

ALTER TABLE public.facturas_electronicas_lineas
  ENABLE TRIGGER facturacion_snapshot_lineas_inmutables;

ALTER TABLE public.facturas_electronicas_lineas
  ADD CONSTRAINT facturas_electronicas_lineas_origen_check
    CHECK (origen IN ('SERVICIO', 'FORMULARIO', 'REPUESTO', 'VENTA', 'AJUSTE')),
  ADD CONSTRAINT facturas_electronicas_lineas_tratamiento_check
    CHECK (tratamiento_iva IN ('GRAVADO', 'EXENTO', 'NO_GRAVADO')),
  ADD CONSTRAINT facturas_electronicas_lineas_alicuota_check
    CHECK (iva_alicuota_id IS NULL OR iva_alicuota_id IN (3, 4, 5, 6, 8, 9)),
  ADD CONSTRAINT facturas_electronicas_lineas_importes_check
    CHECK (importe_neto >= 0 AND importe_iva >= 0 AND importe_total >= 0);

ALTER TABLE public.facturacion_emision_leases
  DROP CONSTRAINT IF EXISTS facturacion_emision_leases_tipo_comprobante_check;

CREATE OR REPLACE FUNCTION public.rpc_facturacion_adquirir_lease(
  p_emisor_cuit text, p_punto_venta integer, p_tipo_comprobante smallint,
  p_lease_token uuid, p_segundos integer DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_emisor_cuit !~ '^[0-9]{11}$' OR p_punto_venta IS NULL OR p_punto_venta <= 0
     OR p_tipo_comprobante NOT IN (1, 2, 3, 6, 7, 8, 11, 12, 13, 51, 52, 53)
     OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Parametros de lease fiscal invalidos';
  END IF;
  INSERT INTO public.facturacion_emision_leases (
    emisor_cuit, punto_venta, tipo_comprobante, lease_token, expires_at, updated_at
  ) VALUES (
    p_emisor_cuit, p_punto_venta, p_tipo_comprobante, p_lease_token,
    now() + make_interval(secs => LEAST(GREATEST(COALESCE(p_segundos, 90), 15), 300)), now()
  )
  ON CONFLICT (emisor_cuit, punto_venta, tipo_comprobante) DO UPDATE
    SET lease_token = EXCLUDED.lease_token, expires_at = EXCLUDED.expires_at, updated_at = now()
    WHERE public.facturacion_emision_leases.expires_at < now()
       OR public.facturacion_emision_leases.lease_token = EXCLUDED.lease_token;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_facturacion_adquirir_lease(text, integer, smallint, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_adquirir_lease(text, integer, smallint, uuid, integer)
  TO service_role;

-- Prepara encabezado y líneas en una sola transacción. Un reintento conserva
-- sus intentos previos y sólo puede reemplazar un documento rechazado.
CREATE OR REPLACE FUNCTION public.rpc_facturacion_preparar_documento(
  p_encabezado jsonb, p_lineas jsonb, p_factura_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE(p_factura_id, gen_random_uuid());
  v_estado text;
BEGIN
  IF jsonb_typeof(p_encabezado) <> 'object' OR jsonb_typeof(p_lineas) <> 'array'
     OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'Documento fiscal invalido';
  END IF;

  IF p_factura_id IS NOT NULL THEN
    SELECT estado INTO v_estado FROM public.facturas_electronicas
    WHERE id = p_factura_id FOR UPDATE;
    IF v_estado IS DISTINCT FROM 'RECHAZADA' THEN
      RAISE EXCEPTION 'Solo puede reintentarse un documento rechazado';
    END IF;
    DELETE FROM public.facturas_electronicas_lineas WHERE factura_id = v_id;
    UPDATE public.facturas_electronicas SET
      arreglo_id = NULLIF(p_encabezado->>'arreglo_id','')::uuid,
      operacion_id = NULLIF(p_encabezado->>'operacion_id','')::uuid,
      origen_tipo = p_encabezado->>'origen_tipo',
      documento_tipo = p_encabezado->>'documento_tipo',
      documento_asociado_id = NULLIF(p_encabezado->>'documento_asociado_id','')::uuid,
      idempotency_key = (p_encabezado->>'idempotency_key')::uuid,
      estado = 'ENVIANDO', ambiente = p_encabezado->>'ambiente',
      emisor_snapshot = p_encabezado->'emisor_snapshot',
      receptor_snapshot = p_encabezado->'receptor_snapshot',
      concepto = (p_encabezado->>'concepto')::smallint,
      fecha_comprobante = (p_encabezado->>'fecha_comprobante')::date,
      fecha_servicio_desde = NULLIF(p_encabezado->>'fecha_servicio_desde','')::date,
      fecha_servicio_hasta = NULLIF(p_encabezado->>'fecha_servicio_hasta','')::date,
      fecha_vencimiento_pago = NULLIF(p_encabezado->>'fecha_vencimiento_pago','')::date,
      total = (p_encabezado->>'total')::numeric,
      punto_venta = (p_encabezado->>'punto_venta')::integer,
      tipo_comprobante = (p_encabezado->>'tipo_comprobante')::smallint,
      clase_comprobante = p_encabezado->>'clase_comprobante',
      numero_comprobante = (p_encabezado->>'numero_comprobante')::integer,
      condicion_venta = p_encabezado->>'condicion_venta',
      importe_neto_gravado = (p_encabezado->>'importe_neto_gravado')::numeric,
      importe_no_gravado = (p_encabezado->>'importe_no_gravado')::numeric,
      importe_exento = (p_encabezado->>'importe_exento')::numeric,
      importe_iva = (p_encabezado->>'importe_iva')::numeric,
      importe_tributos = (p_encabezado->>'importe_tributos')::numeric,
      otros_impuestos_nacionales = (p_encabezado->>'otros_impuestos_nacionales')::numeric,
      contenido_hash = p_encabezado->>'contenido_hash',
      cae = NULL, cae_vencimiento = NULL, autorizada_at = NULL,
      error_codigo = NULL, error_mensaje = NULL
    WHERE id = v_id;
  ELSE
    INSERT INTO public.facturas_electronicas (
      id, tenant_id, arreglo_id, operacion_id, origen_tipo, documento_tipo,
      documento_asociado_id, idempotency_key, estado, ambiente,
      emisor_snapshot, receptor_snapshot, concepto, fecha_comprobante,
      fecha_servicio_desde, fecha_servicio_hasta, fecha_vencimiento_pago,
      moneda, total, punto_venta, tipo_comprobante, clase_comprobante,
      numero_comprobante, condicion_venta, importe_neto_gravado,
      importe_no_gravado, importe_exento, importe_iva, importe_tributos,
      otros_impuestos_nacionales, contenido_hash, created_by
    ) VALUES (
      v_id, (p_encabezado->>'tenant_id')::uuid,
      NULLIF(p_encabezado->>'arreglo_id','')::uuid,
      NULLIF(p_encabezado->>'operacion_id','')::uuid,
      p_encabezado->>'origen_tipo', p_encabezado->>'documento_tipo',
      NULLIF(p_encabezado->>'documento_asociado_id','')::uuid,
      (p_encabezado->>'idempotency_key')::uuid, 'ENVIANDO',
      p_encabezado->>'ambiente', p_encabezado->'emisor_snapshot',
      p_encabezado->'receptor_snapshot', (p_encabezado->>'concepto')::smallint,
      (p_encabezado->>'fecha_comprobante')::date,
      NULLIF(p_encabezado->>'fecha_servicio_desde','')::date,
      NULLIF(p_encabezado->>'fecha_servicio_hasta','')::date,
      NULLIF(p_encabezado->>'fecha_vencimiento_pago','')::date,
      'PES', (p_encabezado->>'total')::numeric,
      (p_encabezado->>'punto_venta')::integer,
      (p_encabezado->>'tipo_comprobante')::smallint,
      p_encabezado->>'clase_comprobante',
      (p_encabezado->>'numero_comprobante')::integer,
      p_encabezado->>'condicion_venta',
      (p_encabezado->>'importe_neto_gravado')::numeric,
      (p_encabezado->>'importe_no_gravado')::numeric,
      (p_encabezado->>'importe_exento')::numeric,
      (p_encabezado->>'importe_iva')::numeric,
      (p_encabezado->>'importe_tributos')::numeric,
      (p_encabezado->>'otros_impuestos_nacionales')::numeric,
      p_encabezado->>'contenido_hash', NULLIF(p_encabezado->>'created_by','')::uuid
    );
  END IF;

  INSERT INTO public.facturas_electronicas_lineas (
    factura_id, ordinal, origen, source_id, descripcion, codigo, cantidad,
    importe_unitario, subtotal, tratamiento_iva, iva_alicuota_id,
    iva_alicuota, importe_neto, importe_iva, importe_total, snapshot
  )
  SELECT v_id, x.ordinal, x.origen, x.source_id, x.descripcion, x.codigo,
    x.cantidad, x.importe_unitario, x.subtotal, x.tratamiento_iva,
    x.iva_alicuota_id, x.iva_alicuota, x.importe_neto, x.importe_iva,
    x.importe_total, COALESCE(x.snapshot, '{}'::jsonb)
  FROM jsonb_to_recordset(p_lineas) AS x(
    ordinal smallint, origen text, source_id uuid, descripcion text, codigo text,
    cantidad numeric, importe_unitario numeric, subtotal numeric,
    tratamiento_iva text, iva_alicuota_id smallint, iva_alicuota numeric,
    importe_neto numeric, importe_iva numeric, importe_total numeric, snapshot jsonb
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_facturacion_preparar_documento(jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_preparar_documento(jsonb, jsonb, uuid)
  TO service_role;

-- El snapshot fiscal es inmutable. Se permite persistir únicamente el artefacto
-- PDF derivado y su hash luego de la autorización.
CREATE OR REPLACE FUNCTION public.facturacion_bloquear_snapshot_autorizado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_factura_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'facturas_electronicas' THEN
    IF OLD.estado = 'AUTORIZADA' THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'El documento fiscal autorizado es inmutable';
      END IF;
      IF ROW(OLD.tenant_id, OLD.arreglo_id, OLD.operacion_id, OLD.origen_tipo,
          OLD.documento_tipo, OLD.documento_asociado_id, OLD.idempotency_key,
          OLD.estado, OLD.ambiente, OLD.emisor_snapshot, OLD.receptor_snapshot,
          OLD.concepto, OLD.fecha_comprobante, OLD.fecha_servicio_desde,
          OLD.fecha_servicio_hasta, OLD.fecha_vencimiento_pago, OLD.moneda,
          OLD.total, OLD.punto_venta, OLD.tipo_comprobante, OLD.numero_comprobante,
          OLD.cae, OLD.cae_vencimiento, OLD.clase_comprobante, OLD.condicion_venta,
          OLD.importe_neto_gravado, OLD.importe_no_gravado, OLD.importe_exento,
          OLD.importe_iva, OLD.importe_tributos, OLD.otros_impuestos_nacionales)
        IS DISTINCT FROM
        ROW(NEW.tenant_id, NEW.arreglo_id, NEW.operacion_id, NEW.origen_tipo,
          NEW.documento_tipo, NEW.documento_asociado_id, NEW.idempotency_key,
          NEW.estado, NEW.ambiente, NEW.emisor_snapshot, NEW.receptor_snapshot,
          NEW.concepto, NEW.fecha_comprobante, NEW.fecha_servicio_desde,
          NEW.fecha_servicio_hasta, NEW.fecha_vencimiento_pago, NEW.moneda,
          NEW.total, NEW.punto_venta, NEW.tipo_comprobante, NEW.numero_comprobante,
          NEW.cae, NEW.cae_vencimiento, NEW.clase_comprobante, NEW.condicion_venta,
          NEW.importe_neto_gravado, NEW.importe_no_gravado, NEW.importe_exento,
          NEW.importe_iva, NEW.importe_tributos, NEW.otros_impuestos_nacionales) THEN
        RAISE EXCEPTION 'El documento fiscal autorizado es inmutable';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);
  IF EXISTS (SELECT 1 FROM public.facturas_electronicas f
             WHERE f.id = v_factura_id AND f.estado = 'AUTORIZADA') THEN
    RAISE EXCEPTION 'Las líneas de un documento fiscal autorizado son inmutables';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.facturacion_operacion_autorizada(p_operacion_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.facturas_electronicas f
    WHERE f.operacion_id = p_operacion_id AND f.estado = 'AUTORIZADA');
$$;

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_operacion_id uuid;
BEGIN
  v_operacion_id := CASE WHEN TG_TABLE_NAME = 'operaciones'
    THEN COALESCE(NEW.id, OLD.id) ELSE COALESCE(NEW.operacion_id, OLD.operacion_id) END;
  IF public.facturacion_operacion_autorizada(v_operacion_id) THEN
    RAISE EXCEPTION 'No se puede modificar una venta con comprobante fiscal autorizado';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER facturacion_proteger_venta_facturada
BEFORE UPDATE OR DELETE ON public.operaciones
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada();

CREATE TRIGGER facturacion_proteger_lineas_venta_facturada
BEFORE INSERT OR UPDATE OR DELETE ON public.operaciones_lineas
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada();

ALTER TABLE public.facturacion_configuracion_ambiente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturacion_parametros_normativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY facturacion_config_ambiente_lectura_admin
  ON public.facturacion_configuracion_ambiente
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND (SELECT auth.jwt() ->> 'user_role') = 'admin');

REVOKE ALL ON TABLE public.facturacion_configuracion_ambiente FROM anon, authenticated;
GRANT SELECT ON TABLE public.facturacion_configuracion_ambiente TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.facturacion_configuracion_ambiente TO service_role;
REVOKE ALL ON TABLE public.facturacion_parametros_normativos FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.facturacion_parametros_normativos TO service_role;

GRANT SELECT ON TABLE public.facturas_electronicas,
  public.facturas_electronicas_lineas,
  public.facturacion_emision_intentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.facturas_electronicas,
  public.facturas_electronicas_lineas,
  public.facturacion_emision_intentos,
  public.facturacion_emision_leases TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('facturacion-comprobantes', 'facturacion-comprobantes', false, 10485760,
  ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];
