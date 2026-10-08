-- Migration: 20261006141233_b2c_202_remitos.sql
-- B2C-202: Remitos R y X con numeración propia por clase, CAI obligatorio para R,
-- origen opcional desde un arreglo o factura, asociación posterior a factura e inmutabilidad.
-- Un remito no es un comprobante fiscal: no se informa a ARCA ni guarda importes.

-- 1. Permisos efectivos en políticas RLS
-- Las políticas de remitos se evalúan como `authenticated` y consultan el permiso efectivo
-- (rol ∩ plan) del JWT. La función solo informa sobre los permisos del propio usuario.
GRANT EXECUTE ON FUNCTION public._b2c179_tiene_permiso(text) TO authenticated;

-- 2. Configuración de remitos por tenant y ambiente
CREATE TABLE public.remitos_configuracion (
  tenant_id                  uuid        NOT NULL,
  ambiente                   text        NOT NULL,
  r_cai                      text,
  r_cai_vencimiento          date,
  r_punto_emision            integer,
  r_numero_desde             integer,
  r_numero_hasta             integer,
  r_proximo_numero           integer     NOT NULL DEFAULT 1,
  r_inicio_actividades       date,
  r_autoimpresor             boolean     NOT NULL DEFAULT false,
  r_imprenta_razon_social    text,
  r_imprenta_cuit            text,
  r_imprenta_fecha_impresion date,
  r_imprenta_habilitacion    text,
  x_punto_emision            integer     NOT NULL DEFAULT 1,
  x_proximo_numero           integer     NOT NULL DEFAULT 1,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  updated_by                 uuid,
  CONSTRAINT remitos_configuracion_pkey PRIMARY KEY (tenant_id, ambiente),
  CONSTRAINT remitos_configuracion_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT remitos_configuracion_ambiente_check CHECK (ambiente IN ('HOMOLOGACION', 'PRODUCCION')),
  CONSTRAINT remitos_configuracion_r_cai_check CHECK (r_cai ~ '^[0-9]{14}$'),
  CONSTRAINT remitos_configuracion_r_punto_emision_check CHECK (r_punto_emision BETWEEN 1 AND 99999),
  CONSTRAINT remitos_configuracion_r_numero_desde_check CHECK (r_numero_desde BETWEEN 1 AND 99999999),
  CONSTRAINT remitos_configuracion_r_numero_hasta_check CHECK (r_numero_hasta BETWEEN 1 AND 99999999),
  CONSTRAINT remitos_configuracion_r_rango_check
    CHECK (r_numero_desde IS NULL OR r_numero_hasta IS NULL OR r_numero_desde <= r_numero_hasta),
  CONSTRAINT remitos_configuracion_r_proximo_numero_check CHECK (r_proximo_numero BETWEEN 1 AND 99999999),
  CONSTRAINT remitos_configuracion_r_imprenta_razon_social_check CHECK (char_length(r_imprenta_razon_social) <= 200),
  CONSTRAINT remitos_configuracion_r_imprenta_cuit_check CHECK (r_imprenta_cuit ~ '^[0-9]{11}$'),
  CONSTRAINT remitos_configuracion_r_imprenta_habilitacion_check CHECK (char_length(r_imprenta_habilitacion) <= 50),
  CONSTRAINT remitos_configuracion_x_punto_emision_check CHECK (x_punto_emision BETWEEN 1 AND 99999),
  CONSTRAINT remitos_configuracion_x_proximo_numero_check CHECK (x_proximo_numero BETWEEN 1 AND 99999999)
);

DROP TRIGGER IF EXISTS remitos_configuracion_set_updated_at ON public.remitos_configuracion;
CREATE TRIGGER remitos_configuracion_set_updated_at
  BEFORE UPDATE ON public.remitos_configuracion
  FOR EACH ROW EXECUTE FUNCTION public.facturacion_set_updated_at();

-- 3. Remitos emitidos (snapshots inmutables, sin importes)
CREATE TABLE public.remitos (
  id                     uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id              uuid        NOT NULL,
  ambiente               text        NOT NULL,
  clase                  text        NOT NULL,
  tipo_comprobante       smallint,
  punto_emision          integer     NOT NULL,
  numero                 integer     NOT NULL,
  fecha_emision          date        NOT NULL,
  idempotency_key        uuid        NOT NULL,
  arreglo_id             uuid,
  factura_id             uuid,
  factura_asociada_at    timestamptz,
  factura_asociada_by    uuid,
  emisor_snapshot        jsonb       NOT NULL,
  destinatario_snapshot  jsonb       NOT NULL,
  transportista_snapshot jsonb,
  cai                    text,
  cai_vencimiento        date,
  impresion_snapshot     jsonb,
  observaciones          text,
  created_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT remitos_pkey PRIMARY KEY (id),
  CONSTRAINT remitos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT remitos_arreglo_id_fkey FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE RESTRICT,
  CONSTRAINT remitos_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
  CONSTRAINT remitos_ambiente_check CHECK (ambiente IN ('HOMOLOGACION', 'PRODUCCION')),
  CONSTRAINT remitos_clase_check CHECK (clase IN ('R', 'X')),
  CONSTRAINT remitos_tipo_comprobante_check
    CHECK ((clase = 'R' AND tipo_comprobante IS NOT NULL AND tipo_comprobante = 91)
      OR (clase = 'X' AND tipo_comprobante IS NULL)),
  CONSTRAINT remitos_punto_emision_check CHECK (punto_emision BETWEEN 1 AND 99999),
  CONSTRAINT remitos_numero_check CHECK (numero BETWEEN 1 AND 99999999),
  CONSTRAINT remitos_cai_check
    CHECK ((clase = 'R' AND cai IS NOT NULL AND cai ~ '^[0-9]{14}$'
        AND cai_vencimiento IS NOT NULL AND cai_vencimiento >= fecha_emision
        AND impresion_snapshot IS NOT NULL)
      OR (clase = 'X' AND cai IS NULL AND cai_vencimiento IS NULL AND impresion_snapshot IS NULL)),
  CONSTRAINT remitos_factura_asociada_check CHECK ((factura_id IS NULL) = (factura_asociada_at IS NULL)),
  CONSTRAINT remitos_snapshots_check
    CHECK (jsonb_typeof(emisor_snapshot) = 'object' AND jsonb_typeof(destinatario_snapshot) = 'object'
      AND (transportista_snapshot IS NULL OR jsonb_typeof(transportista_snapshot) = 'object')
      AND (impresion_snapshot IS NULL OR jsonb_typeof(impresion_snapshot) = 'object')),
  CONSTRAINT remitos_observaciones_check CHECK (char_length(observaciones) <= 1000),
  CONSTRAINT remitos_numero_unico UNIQUE (tenant_id, ambiente, clase, punto_emision, numero),
  CONSTRAINT remitos_idempotencia_unica UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX remitos_tenant_fecha_idx
  ON public.remitos USING btree (tenant_id, ambiente, fecha_emision DESC, created_at DESC);

CREATE INDEX remitos_factura_idx
  ON public.remitos USING btree (tenant_id, factura_id)
  WHERE factura_id IS NOT NULL;

CREATE INDEX remitos_arreglo_idx
  ON public.remitos USING btree (tenant_id, arreglo_id)
  WHERE arreglo_id IS NOT NULL;

-- 4. Ítems del remito (bienes y cantidades, nunca precios)
CREATE TABLE public.remitos_lineas (
  id               uuid          NOT NULL DEFAULT gen_random_uuid(),
  remito_id        uuid          NOT NULL,
  ordinal          smallint      NOT NULL,
  codigo           text,
  descripcion      text          NOT NULL,
  observaciones    text,
  cantidad         numeric(14,4) NOT NULL,
  factura_linea_id uuid,
  CONSTRAINT remitos_lineas_pkey PRIMARY KEY (id),
  CONSTRAINT remitos_lineas_remito_id_fkey FOREIGN KEY (remito_id) REFERENCES public.remitos(id) ON DELETE RESTRICT,
  CONSTRAINT remitos_lineas_factura_linea_id_fkey
    FOREIGN KEY (factura_linea_id) REFERENCES public.facturas_electronicas_lineas(id) ON DELETE RESTRICT,
  CONSTRAINT remitos_lineas_ordinal_check CHECK (ordinal > 0),
  CONSTRAINT remitos_lineas_ordinal_unico UNIQUE (remito_id, ordinal),
  CONSTRAINT remitos_lineas_codigo_check CHECK (char_length(codigo) <= 100),
  CONSTRAINT remitos_lineas_descripcion_check CHECK (char_length(btrim(descripcion)) BETWEEN 1 AND 500),
  CONSTRAINT remitos_lineas_observaciones_check CHECK (char_length(observaciones) <= 500),
  CONSTRAINT remitos_lineas_cantidad_check CHECK (cantidad > 0)
);

-- Sirve para sumar lo remitido por línea facturada, incluso si aparece en varias líneas del remito.
CREATE INDEX remitos_lineas_factura_linea_idx
  ON public.remitos_lineas USING btree (factura_linea_id, remito_id)
  WHERE factura_linea_id IS NOT NULL;

-- 5. Validación de numeración progresiva al editar la configuración
CREATE OR REPLACE FUNCTION public.remitos_configuracion_validar_numeracion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ultimo integer;
BEGIN
  IF NEW.r_punto_emision IS NOT NULL THEN
    SELECT max(r.numero) INTO v_ultimo
    FROM public.remitos r
    WHERE r.tenant_id = NEW.tenant_id
      AND r.ambiente = NEW.ambiente
      AND r.clase = 'R'
      AND r.punto_emision = NEW.r_punto_emision;
    IF v_ultimo IS NOT NULL AND NEW.r_proximo_numero <= v_ultimo THEN
      RAISE EXCEPTION 'El próximo número de Remito R debe ser mayor al último emitido (R %-%)',
        lpad(NEW.r_punto_emision::text, 5, '0'), lpad(v_ultimo::text, 8, '0');
    END IF;
  END IF;

  SELECT max(r.numero) INTO v_ultimo
  FROM public.remitos r
  WHERE r.tenant_id = NEW.tenant_id
    AND r.ambiente = NEW.ambiente
    AND r.clase = 'X'
    AND r.punto_emision = NEW.x_punto_emision;
  IF v_ultimo IS NOT NULL AND NEW.x_proximo_numero <= v_ultimo THEN
    RAISE EXCEPTION 'El próximo número de Remito X debe ser mayor al último emitido (X %-%)',
      lpad(NEW.x_punto_emision::text, 5, '0'), lpad(v_ultimo::text, 8, '0');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.remitos_configuracion_validar_numeracion()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS remitos_configuracion_validar_numeracion ON public.remitos_configuracion;
CREATE TRIGGER remitos_configuracion_validar_numeracion
  BEFORE INSERT OR UPDATE ON public.remitos_configuracion
  FOR EACH ROW EXECUTE FUNCTION public.remitos_configuracion_validar_numeracion();

-- 6. Inmutabilidad: solo se permite agregar una vez el vínculo con la factura
CREATE OR REPLACE FUNCTION public.remitos_bloquear_mutacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_factura_remito uuid;
  v_factura_linea uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'remitos' THEN
      RAISE EXCEPTION 'Los remitos emitidos no se pueden eliminar' USING ERRCODE = '55000';
    END IF;
    RAISE EXCEPTION 'Los ítems de un remito emitido no se pueden eliminar' USING ERRCODE = '55000';
  END IF;

  IF TG_TABLE_NAME = 'remitos' THEN
    IF (to_jsonb(NEW) - ARRAY['factura_id', 'factura_asociada_at', 'factura_asociada_by'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['factura_id', 'factura_asociada_at', 'factura_asociada_by']) THEN
      RAISE EXCEPTION 'El remito emitido es inmutable' USING ERRCODE = '55000';
    END IF;
    IF ROW(NEW.factura_id, NEW.factura_asociada_at, NEW.factura_asociada_by)
       IS DISTINCT FROM ROW(OLD.factura_id, OLD.factura_asociada_at, OLD.factura_asociada_by)
       AND NOT (OLD.factura_id IS NULL AND NEW.factura_id IS NOT NULL) THEN
      RAISE EXCEPTION 'El remito ya está asociado a una factura' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'factura_linea_id') IS DISTINCT FROM (to_jsonb(OLD) - 'factura_linea_id') THEN
    RAISE EXCEPTION 'Los ítems de un remito emitido son inmutables' USING ERRCODE = '55000';
  END IF;
  IF NEW.factura_linea_id IS DISTINCT FROM OLD.factura_linea_id THEN
    IF OLD.factura_linea_id IS NOT NULL OR NEW.factura_linea_id IS NULL THEN
      RAISE EXCEPTION 'El ítem del remito ya está asociado a una línea de factura' USING ERRCODE = '55000';
    END IF;
    SELECT r.factura_id INTO v_factura_remito FROM public.remitos r WHERE r.id = NEW.remito_id;
    SELECT fl.factura_id INTO v_factura_linea FROM public.facturas_electronicas_lineas fl WHERE fl.id = NEW.factura_linea_id;
    IF v_factura_remito IS NULL OR v_factura_linea IS DISTINCT FROM v_factura_remito THEN
      RAISE EXCEPTION 'La línea de factura no corresponde a la factura asociada al remito' USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.remitos_bloquear_mutacion()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS remitos_inmutable ON public.remitos;
CREATE TRIGGER remitos_inmutable
  BEFORE UPDATE OR DELETE ON public.remitos
  FOR EACH ROW EXECUTE FUNCTION public.remitos_bloquear_mutacion();

DROP TRIGGER IF EXISTS remitos_lineas_inmutables ON public.remitos_lineas;
CREATE TRIGGER remitos_lineas_inmutables
  BEFORE UPDATE OR DELETE ON public.remitos_lineas
  FOR EACH ROW EXECUTE FUNCTION public.remitos_bloquear_mutacion();

-- 7. RLS y grants: lectura por permisos; toda escritura de remitos pasa por RPC
ALTER TABLE public.remitos_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remitos_lineas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.remitos_configuracion FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.remitos FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.remitos_lineas FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.remitos_configuracion TO authenticated;
GRANT SELECT ON TABLE public.remitos TO authenticated;
GRANT SELECT ON TABLE public.remitos_lineas TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.remitos_configuracion TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.remitos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.remitos_lineas TO service_role;

DROP POLICY IF EXISTS remitos_configuracion_select ON public.remitos_configuracion;
CREATE POLICY remitos_configuracion_select ON public.remitos_configuracion
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND (SELECT public._b2c179_tiene_permiso('facturas:view')));

DROP POLICY IF EXISTS remitos_configuracion_insert ON public.remitos_configuracion;
CREATE POLICY remitos_configuracion_insert ON public.remitos_configuracion
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND (SELECT public._b2c179_tiene_permiso('configuracion:edit'))
    AND (SELECT public._b2c179_tiene_permiso('facturas:edit')));

DROP POLICY IF EXISTS remitos_configuracion_update ON public.remitos_configuracion;
CREATE POLICY remitos_configuracion_update ON public.remitos_configuracion
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND (SELECT public._b2c179_tiene_permiso('configuracion:edit'))
    AND (SELECT public._b2c179_tiene_permiso('facturas:edit')))
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND (SELECT public._b2c179_tiene_permiso('configuracion:edit'))
    AND (SELECT public._b2c179_tiene_permiso('facturas:edit')));

DROP POLICY IF EXISTS remitos_select_tenant ON public.remitos;
CREATE POLICY remitos_select_tenant ON public.remitos
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND (SELECT public._b2c179_tiene_permiso('facturas:view')));

DROP POLICY IF EXISTS remitos_lineas_select_tenant ON public.remitos_lineas;
CREATE POLICY remitos_lineas_select_tenant ON public.remitos_lineas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.remitos r
    WHERE r.id = remitos_lineas.remito_id
      AND r.tenant_id = public.current_tenant_id()
      AND (SELECT public._b2c179_tiene_permiso('facturas:view'))
  ));

-- 8. Fecha de emisión en hora argentina
CREATE OR REPLACE FUNCTION public._remitos_hoy()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
$$;

REVOKE ALL ON FUNCTION public._remitos_hoy() FROM PUBLIC, anon, authenticated, service_role;

-- 9. Emisión de remitos desde arreglo o factura
CREATE OR REPLACE FUNCTION public.rpc_remitos_emitir(
  p_idempotency_key uuid,
  p_ambiente text,
  p_clase text,
  p_arreglo_id uuid,
  p_factura_id uuid,
  p_destinatario jsonb,
  p_transportista jsonb,
  p_observaciones text,
  p_lineas jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_hoy date := public._remitos_hoy();
  v_fiscal public.facturacion_configuracion_ambiente%ROWTYPE;
  v_config public.remitos_configuracion%ROWTYPE;
  v_factura public.facturas_electronicas%ROWTYPE;
  v_existente public.remitos%ROWTYPE;
  v_remito_id uuid;
  v_numero integer;
  v_punto integer;
  v_tipo smallint;
  v_cai text;
  v_cai_vencimiento date;
  v_impresion jsonb;
  v_emisor jsonb;
  v_destinatario jsonb;
  v_transportista jsonb;
  v_observaciones text := NULLIF(btrim(coalesce(p_observaciones, '')), '');
  v_dest_nombre text;
  v_dest_domicilio text;
  v_dest_tipo_doc text;
  v_dest_documento text;
  v_dest_condicion text;
  v_dest_cliente_id uuid;
  v_dest_cliente_txt text;
  v_transp_nombre text;
  v_transp_domicilio text;
  v_transp_cuit text;
  v_item record;
  v_cantidad_txt text;
  v_cantidad numeric;
  v_codigo text;
  v_descripcion text;
  v_item_observaciones text;
  v_codigo_txt text;
  v_descripcion_txt text;
  v_factura_linea_txt text;
  v_factura_linea_id uuid;
  v_exceso record;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF NOT public._b2c179_tiene_permiso('facturas:edit') THEN
    RAISE EXCEPTION 'No tenés permiso para emitir remitos' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'La clave de idempotencia es obligatoria'; END IF;
  IF p_ambiente IS NULL OR p_ambiente NOT IN ('HOMOLOGACION', 'PRODUCCION') THEN
    RAISE EXCEPTION 'El ambiente fiscal no es válido';
  END IF;
  IF p_clase IS NULL OR p_clase NOT IN ('R', 'X') THEN
    RAISE EXCEPTION 'Seleccioná el tipo de remito (R o X)';
  END IF;
  IF p_arreglo_id IS NOT NULL AND p_factura_id IS NOT NULL THEN
    RAISE EXCEPTION 'Iniciá el remito desde un arreglo o desde una factura, no desde ambos';
  END IF;
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'El remito debe tener al menos un ítem';
  END IF;
  IF jsonb_array_length(p_lineas) > 200 THEN
    RAISE EXCEPTION 'El remito admite hasta 200 ítems';
  END IF;
  IF char_length(v_observaciones) > 1000 THEN
    RAISE EXCEPTION 'Las observaciones del remito no pueden superar los 1000 caracteres';
  END IF;

  -- Destinatario
  IF p_destinatario IS NULL OR jsonb_typeof(p_destinatario) <> 'object' THEN
    RAISE EXCEPTION 'Completá los datos del destinatario';
  END IF;
  v_dest_nombre := NULLIF(btrim(coalesce(p_destinatario ->> 'nombre', '')), '');
  IF v_dest_nombre IS NULL THEN RAISE EXCEPTION 'El nombre del destinatario es obligatorio'; END IF;
  IF char_length(v_dest_nombre) > 200 THEN
    RAISE EXCEPTION 'El nombre del destinatario no puede superar los 200 caracteres';
  END IF;
  v_dest_domicilio := NULLIF(btrim(coalesce(p_destinatario ->> 'domicilio', '')), '');
  IF char_length(v_dest_domicilio) > 300 THEN
    RAISE EXCEPTION 'El domicilio del destinatario no puede superar los 300 caracteres';
  END IF;
  v_dest_tipo_doc := NULLIF(btrim(coalesce(p_destinatario ->> 'tipoDocumento', '')), '');
  v_dest_documento := NULLIF(regexp_replace(coalesce(p_destinatario ->> 'numeroDocumento', ''), '\D', '', 'g'), '');
  IF v_dest_tipo_doc IS NOT NULL AND v_dest_tipo_doc NOT IN ('80', '86', '96', '99') THEN
    RAISE EXCEPTION 'El tipo de documento del destinatario no es válido';
  END IF;
  IF v_dest_tipo_doc IS NULL OR v_dest_tipo_doc = '99' THEN
    v_dest_tipo_doc := NULL;
    v_dest_documento := NULL;
  ELSIF v_dest_documento IS NULL THEN
    RAISE EXCEPTION 'Completá el número de documento del destinatario';
  ELSIF v_dest_tipo_doc = '96' AND v_dest_documento !~ '^[0-9]{7,8}$' THEN
    RAISE EXCEPTION 'El DNI del destinatario debe tener entre 7 y 8 dígitos';
  ELSIF v_dest_tipo_doc IN ('80', '86') AND v_dest_documento !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'El CUIT o CUIL del destinatario debe tener 11 dígitos';
  END IF;
  v_dest_condicion := NULLIF(btrim(coalesce(p_destinatario ->> 'condicionIvaReceptorId', '')), '');
  IF v_dest_condicion IS NOT NULL AND v_dest_condicion NOT IN ('1', '4', '5', '6', '15') THEN
    RAISE EXCEPTION 'La condición IVA del destinatario no es válida';
  END IF;
  v_dest_cliente_txt := NULLIF(btrim(coalesce(p_destinatario ->> 'clienteId', '')), '');
  IF v_dest_cliente_txt IS NOT NULL THEN
    IF v_dest_cliente_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'El cliente del destinatario no es válido';
    END IF;
    v_dest_cliente_id := v_dest_cliente_txt::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = v_dest_cliente_id AND c.tenant_id = v_tenant) THEN
      RAISE EXCEPTION 'Cliente no encontrado';
    END IF;
  END IF;
  v_destinatario := jsonb_build_object(
    'clienteId', v_dest_cliente_id,
    'nombre', v_dest_nombre,
    'domicilio', v_dest_domicilio,
    'tipoDocumento', v_dest_tipo_doc::integer,
    'numeroDocumento', v_dest_documento,
    'condicionIvaReceptorId', v_dest_condicion::integer,
    'condicionIva', CASE v_dest_condicion
      WHEN '1' THEN 'Responsable inscripto'
      WHEN '4' THEN 'IVA exento'
      WHEN '5' THEN 'Consumidor final'
      WHEN '6' THEN 'Monotributista'
      WHEN '15' THEN 'IVA no alcanzado'
      ELSE NULL
    END
  );

  -- Transportista (opcional)
  IF p_transportista IS NOT NULL AND jsonb_typeof(p_transportista) <> 'null' THEN
    IF jsonb_typeof(p_transportista) <> 'object' THEN
      RAISE EXCEPTION 'Los datos del transportista no son válidos';
    END IF;
    v_transp_nombre := NULLIF(btrim(coalesce(p_transportista ->> 'nombre', '')), '');
    v_transp_domicilio := NULLIF(btrim(coalesce(p_transportista ->> 'domicilio', '')), '');
    v_transp_cuit := NULLIF(regexp_replace(coalesce(p_transportista ->> 'cuit', ''), '\D', '', 'g'), '');
    IF v_transp_nombre IS NOT NULL OR v_transp_domicilio IS NOT NULL OR v_transp_cuit IS NOT NULL THEN
      IF v_transp_nombre IS NULL THEN RAISE EXCEPTION 'El nombre del transportista es obligatorio'; END IF;
      IF char_length(v_transp_nombre) > 200 THEN
        RAISE EXCEPTION 'El nombre del transportista no puede superar los 200 caracteres';
      END IF;
      IF char_length(v_transp_domicilio) > 300 THEN
        RAISE EXCEPTION 'El domicilio del transportista no puede superar los 300 caracteres';
      END IF;
      IF v_transp_cuit IS NOT NULL AND v_transp_cuit !~ '^[0-9]{11}$' THEN
        RAISE EXCEPTION 'El CUIT del transportista debe tener 11 dígitos';
      END IF;
      v_transportista := jsonb_build_object(
        'nombre', v_transp_nombre, 'domicilio', v_transp_domicilio, 'cuit', v_transp_cuit
      );
    END IF;
  END IF;

  -- Emisor: siempre desde la configuración fiscal guardada, nunca desde el caller.
  SELECT * INTO v_fiscal
  FROM public.facturacion_configuracion_ambiente f
  WHERE f.tenant_id = v_tenant AND f.ambiente = p_ambiente;
  IF NOT FOUND
     OR NULLIF(btrim(coalesce(v_fiscal.razon_social, '')), '') IS NULL
     OR coalesce(v_fiscal.cuit, '') !~ '^[0-9]{11}$'
     OR NULLIF(btrim(coalesce(v_fiscal.domicilio, '')), '') IS NULL
     OR v_fiscal.inicio_actividades IS NULL THEN
    RAISE EXCEPTION 'Completá los datos fiscales del emisor en Configuración > Facturación antes de emitir remitos';
  END IF;
  v_emisor := jsonb_build_object(
    'razonSocial', btrim(v_fiscal.razon_social),
    'nombreFantasia', NULLIF(btrim(coalesce(v_fiscal.nombre_fantasia, '')), ''),
    'cuit', v_fiscal.cuit,
    'domicilio', btrim(v_fiscal.domicilio),
    'ingresosBrutos', NULLIF(btrim(coalesce(v_fiscal.ingresos_brutos, '')), ''),
    'inicioActividades', v_fiscal.inicio_actividades,
    'condicionIvaEmisor', v_fiscal.condicion_iva_emisor,
    'condicionIva', CASE WHEN v_fiscal.condicion_iva_emisor = 'RESPONSABLE_INSCRIPTO'
      THEN 'Responsable inscripto' ELSE 'Monotributista' END
  );

  -- La fila de configuración serializa las emisiones del tenant y ambiente.
  SELECT * INTO v_config
  FROM public.remitos_configuracion c
  WHERE c.tenant_id = v_tenant AND c.ambiente = p_ambiente
  FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.remitos_configuracion (tenant_id, ambiente)
    VALUES (v_tenant, p_ambiente)
    ON CONFLICT (tenant_id, ambiente) DO NOTHING;
    SELECT * INTO v_config
    FROM public.remitos_configuracion c
    WHERE c.tenant_id = v_tenant AND c.ambiente = p_ambiente
    FOR UPDATE;
  END IF;

  -- Idempotencia (después del lock para que un reintento concurrente vea la emisión previa).
  SELECT * INTO v_existente
  FROM public.remitos r
  WHERE r.tenant_id = v_tenant AND r.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existente.clase <> p_clase
       OR v_existente.ambiente <> p_ambiente
       OR v_existente.arreglo_id IS DISTINCT FROM p_arreglo_id
       OR v_existente.factura_id IS DISTINCT FROM p_factura_id THEN
      RAISE EXCEPTION 'La clave de idempotencia ya pertenece a otro remito';
    END IF;
    RETURN v_existente.id;
  END IF;

  IF p_arreglo_id IS NOT NULL THEN
    PERFORM 1
    FROM public.arreglos a
    WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant
    FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado'; END IF;
  END IF;

  IF p_factura_id IS NOT NULL THEN
    -- Serializa los controles de cantidades por factura sin bloquear la fila fiscal.
    PERFORM pg_advisory_xact_lock(hashtextextended('remitos_factura_' || p_factura_id::text, 0));
    SELECT * INTO v_factura
    FROM public.facturas_electronicas f
    WHERE f.id = p_factura_id AND f.tenant_id = v_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;
    IF v_factura.documento_tipo <> 'FACTURA' OR v_factura.estado <> 'AUTORIZADA' THEN
      RAISE EXCEPTION 'Solo se pueden generar remitos desde facturas autorizadas';
    END IF;
    IF v_factura.ambiente <> p_ambiente THEN
      RAISE EXCEPTION 'La factura pertenece a otro ambiente fiscal';
    END IF;
  END IF;

  -- Ítems
  FOR v_item IN
    SELECT e.value AS item, e.ordinality AS ordinal
    FROM jsonb_array_elements(p_lineas) WITH ORDINALITY AS e(value, ordinality)
  LOOP
    IF jsonb_typeof(v_item.item) <> 'object' THEN
      RAISE EXCEPTION 'El ítem % del remito no es válido', v_item.ordinal;
    END IF;

    v_cantidad_txt := btrim(coalesce(v_item.item ->> 'cantidad', ''));
    IF v_cantidad_txt !~ '^[0-9]+(\.[0-9]{1,4})?$' THEN
      RAISE EXCEPTION 'La cantidad del ítem % debe ser un número positivo con hasta 4 decimales', v_item.ordinal;
    END IF;
    v_cantidad := v_cantidad_txt::numeric;
    IF v_cantidad <= 0 OR v_cantidad >= 10000000000 THEN
      RAISE EXCEPTION 'La cantidad del ítem % debe ser mayor a cero', v_item.ordinal;
    END IF;

    v_item_observaciones := NULLIF(btrim(coalesce(v_item.item ->> 'observaciones', '')), '');
    IF char_length(v_item_observaciones) > 500 THEN
      RAISE EXCEPTION 'Las observaciones del ítem % no pueden superar los 500 caracteres', v_item.ordinal;
    END IF;

    v_factura_linea_txt := NULLIF(btrim(coalesce(v_item.item ->> 'factura_linea_id', '')), '');
    v_factura_linea_id := NULL;

    IF p_factura_id IS NOT NULL THEN
      IF v_factura_linea_txt IS NULL
         OR v_factura_linea_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Cada ítem del remito debe corresponder a una línea de la factura';
      END IF;
      v_factura_linea_id := v_factura_linea_txt::uuid;
      PERFORM 1
      FROM public.facturas_electronicas_lineas fl
      WHERE fl.id = v_factura_linea_id AND fl.factura_id = p_factura_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El ítem % no corresponde a una línea de la factura', v_item.ordinal;
      END IF;
    ELSE
      IF v_factura_linea_txt IS NOT NULL THEN
        RAISE EXCEPTION 'Los ítems de un remito sin factura no pueden referenciar líneas de factura';
      END IF;
    END IF;

    v_codigo_txt := NULLIF(btrim(coalesce(v_item.item ->> 'codigo', '')), '');
    IF char_length(v_codigo_txt) > 100 THEN
      RAISE EXCEPTION 'El código del ítem % no puede superar los 100 caracteres', v_item.ordinal;
    END IF;
    v_descripcion_txt := NULLIF(btrim(coalesce(v_item.item ->> 'descripcion', '')), '');
    IF v_descripcion_txt IS NULL THEN
      RAISE EXCEPTION 'La descripción del ítem % es obligatoria', v_item.ordinal;
    END IF;
    IF char_length(v_descripcion_txt) > 500 THEN
      RAISE EXCEPTION 'La descripción del ítem % no puede superar los 500 caracteres', v_item.ordinal;
    END IF;
    v_codigo := v_codigo_txt;
    v_descripcion := v_descripcion_txt;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'ordinal', v_item.ordinal,
      'codigo', v_codigo,
      'descripcion', v_descripcion,
      'observaciones', v_item_observaciones,
      'cantidad', v_cantidad,
      'factura_linea_id', v_factura_linea_id
    ));
  END LOOP;

  IF p_factura_id IS NOT NULL THEN
    SELECT fl.descripcion, fl.cantidad, coalesce(previo.total, 0) AS remitido, nuevo.total AS nuevo
    INTO v_exceso
    FROM (
      SELECT i.factura_linea_id, sum(i.cantidad) AS total
      FROM jsonb_to_recordset(v_items) AS i(factura_linea_id uuid, cantidad numeric)
      GROUP BY i.factura_linea_id
    ) nuevo
    JOIN public.facturas_electronicas_lineas fl ON fl.id = nuevo.factura_linea_id
    LEFT JOIN LATERAL (
      SELECT sum(rl.cantidad) AS total
      FROM public.remitos_lineas rl
      WHERE rl.factura_linea_id = fl.id
    ) previo ON true
    WHERE coalesce(previo.total, 0) + nuevo.total > fl.cantidad
    ORDER BY fl.ordinal
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'La cantidad a remitir de "%" supera la cantidad facturada disponible (%)',
        v_exceso.descripcion, trim_scale(greatest(v_exceso.cantidad - v_exceso.remitido, 0));
    END IF;
  END IF;

  -- Numeración y reglas propias de cada clase
  IF p_clase = 'R' THEN
    IF v_config.r_cai IS NULL THEN
      RAISE EXCEPTION 'Para emitir un Remito R configurá el CAI en Configuración > Facturación';
    END IF;
    IF v_config.r_cai_vencimiento IS NULL THEN
      RAISE EXCEPTION 'El CAI del Remito R no tiene fecha de vencimiento configurada';
    END IF;
    IF v_config.r_cai_vencimiento < v_hoy THEN
      RAISE EXCEPTION 'El CAI del Remito R está vencido (venció el %)', to_char(v_config.r_cai_vencimiento, 'DD/MM/YYYY');
    END IF;
    IF v_config.r_punto_emision IS NULL THEN
      RAISE EXCEPTION 'Configurá el punto de emisión del Remito R en Configuración > Facturación';
    END IF;
    IF NOT v_config.r_autoimpresor AND (
      NULLIF(btrim(coalesce(v_config.r_imprenta_razon_social, '')), '') IS NULL
      OR v_config.r_imprenta_cuit IS NULL
      OR v_config.r_imprenta_fecha_impresion IS NULL
      OR NULLIF(btrim(coalesce(v_config.r_imprenta_habilitacion, '')), '') IS NULL
    ) THEN
      RAISE EXCEPTION 'Faltan los datos del establecimiento impresor del Remito R';
    END IF;

    v_punto := v_config.r_punto_emision;
    v_numero := v_config.r_proximo_numero;
    IF (v_config.r_numero_desde IS NOT NULL AND v_numero < v_config.r_numero_desde)
       OR (v_config.r_numero_hasta IS NOT NULL AND v_numero > v_config.r_numero_hasta) THEN
      RAISE EXCEPTION 'El número R %-% está fuera del rango autorizado (% a %)',
        lpad(v_punto::text, 5, '0'), lpad(v_numero::text, 8, '0'),
        coalesce(lpad(v_config.r_numero_desde::text, 8, '0'), 'sin mínimo'),
        coalesce(lpad(v_config.r_numero_hasta::text, 8, '0'), 'sin máximo');
    END IF;
    IF v_numero >= 99999999 THEN
      RAISE EXCEPTION 'Se agotó la numeración del Remito R para el punto de emisión %. Configurá un nuevo punto de emisión.',
        lpad(v_punto::text, 5, '0');
    END IF;

    v_tipo := 91;
    v_cai := v_config.r_cai;
    v_cai_vencimiento := v_config.r_cai_vencimiento;
    v_impresion := jsonb_build_object(
      'autoimpresor', v_config.r_autoimpresor,
      'numeroDesde', v_config.r_numero_desde,
      'numeroHasta', v_config.r_numero_hasta,
      'inicioActividades', v_config.r_inicio_actividades,
      'imprenta', CASE WHEN v_config.r_autoimpresor THEN NULL ELSE jsonb_build_object(
        'razonSocial', btrim(v_config.r_imprenta_razon_social),
        'cuit', v_config.r_imprenta_cuit,
        'fechaImpresion', v_config.r_imprenta_fecha_impresion,
        'habilitacion', btrim(v_config.r_imprenta_habilitacion)
      ) END
    );

    UPDATE public.remitos_configuracion c
    SET r_proximo_numero = v_numero + 1
    WHERE c.tenant_id = v_tenant AND c.ambiente = p_ambiente;
  ELSE
    v_punto := v_config.x_punto_emision;
    v_numero := v_config.x_proximo_numero;
    IF v_numero >= 99999999 THEN
      RAISE EXCEPTION 'Se agotó la numeración del Remito X para el punto de emisión %. Configurá un nuevo punto de emisión.',
        lpad(v_punto::text, 5, '0');
    END IF;

    UPDATE public.remitos_configuracion c
    SET x_proximo_numero = v_numero + 1
    WHERE c.tenant_id = v_tenant AND c.ambiente = p_ambiente;
  END IF;

  INSERT INTO public.remitos (
    tenant_id, ambiente, clase, tipo_comprobante, punto_emision, numero, fecha_emision,
    idempotency_key, arreglo_id, factura_id, factura_asociada_at, factura_asociada_by,
    emisor_snapshot, destinatario_snapshot, transportista_snapshot,
    cai, cai_vencimiento, impresion_snapshot, observaciones, created_by
  ) VALUES (
    v_tenant, p_ambiente, p_clase, v_tipo, v_punto, v_numero, v_hoy,
    p_idempotency_key, p_arreglo_id, p_factura_id,
    CASE WHEN p_factura_id IS NULL THEN NULL ELSE now() END,
    CASE WHEN p_factura_id IS NULL THEN NULL ELSE auth.uid() END,
    v_emisor, v_destinatario, v_transportista,
    v_cai, v_cai_vencimiento, v_impresion, v_observaciones, auth.uid()
  )
  RETURNING id INTO v_remito_id;

  INSERT INTO public.remitos_lineas (
    remito_id, ordinal, codigo, descripcion, observaciones, cantidad, factura_linea_id
  )
  SELECT v_remito_id, i.ordinal, i.codigo, i.descripcion, i.observaciones, i.cantidad, i.factura_linea_id
  FROM jsonb_to_recordset(v_items) AS i(
    ordinal smallint, codigo text, descripcion text, observaciones text, cantidad numeric, factura_linea_id uuid
  );

  RETURN v_remito_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_remitos_emitir(uuid, text, text, uuid, uuid, jsonb, jsonb, text, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_remitos_emitir(uuid, text, text, uuid, uuid, jsonb, jsonb, text, jsonb) TO authenticated, service_role;

-- 10. Asociación posterior de un remito sin factura
CREATE OR REPLACE FUNCTION public.rpc_remitos_asociar_factura(
  p_remito_id uuid,
  p_factura_id uuid,
  p_lineas jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_remito public.remitos%ROWTYPE;
  v_factura public.facturas_electronicas%ROWTYPE;
  v_item jsonb;
  v_remito_linea_txt text;
  v_factura_linea_txt text;
  v_remito_lineas uuid[] := ARRAY[]::uuid[];
  v_total_items integer;
  v_exceso record;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF NOT public._b2c179_tiene_permiso('facturas:edit') THEN
    RAISE EXCEPTION 'No tenés permiso para asociar remitos' USING ERRCODE = '42501';
  END IF;
  IF p_remito_id IS NULL OR p_factura_id IS NULL THEN
    RAISE EXCEPTION 'El remito y la factura son obligatorios';
  END IF;
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'Asociá cada ítem del remito a una línea de la factura';
  END IF;

  SELECT * INTO v_remito
  FROM public.remitos r
  WHERE r.id = p_remito_id AND r.tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Remito no encontrado'; END IF;
  IF v_remito.factura_id IS NOT NULL THEN
    RAISE EXCEPTION 'El remito ya está asociado a una factura' USING ERRCODE = '55000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('remitos_factura_' || p_factura_id::text, 0));
  SELECT * INTO v_factura
  FROM public.facturas_electronicas f
  WHERE f.id = p_factura_id AND f.tenant_id = v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;
  IF v_factura.documento_tipo <> 'FACTURA' OR v_factura.estado <> 'AUTORIZADA' THEN
    RAISE EXCEPTION 'Solo se pueden asociar facturas autorizadas';
  END IF;
  IF v_factura.ambiente <> v_remito.ambiente THEN
    RAISE EXCEPTION 'La factura pertenece a otro ambiente fiscal';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_lineas) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Asociá cada ítem del remito a una línea de la factura';
    END IF;
    v_remito_linea_txt := btrim(coalesce(v_item ->> 'remito_linea_id', ''));
    v_factura_linea_txt := btrim(coalesce(v_item ->> 'factura_linea_id', ''));
    IF v_remito_linea_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR v_factura_linea_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Asociá cada ítem del remito a una línea de la factura';
    END IF;
    IF v_remito_linea_txt::uuid = ANY (v_remito_lineas) THEN
      RAISE EXCEPTION 'Cada ítem del remito debe asociarse una sola vez';
    END IF;
    v_remito_lineas := v_remito_lineas || v_remito_linea_txt::uuid;
  END LOOP;

  SELECT count(*) INTO v_total_items FROM public.remitos_lineas rl WHERE rl.remito_id = p_remito_id;
  IF cardinality(v_remito_lineas) <> v_total_items
     OR EXISTS (
       SELECT 1 FROM unnest(v_remito_lineas) AS u(id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.remitos_lineas rl WHERE rl.id = u.id AND rl.remito_id = p_remito_id
       )
     ) THEN
    RAISE EXCEPTION 'Asociá todos los ítems del remito, una vez cada uno';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_lineas) AS m(remito_linea_id uuid, factura_linea_id uuid)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.facturas_electronicas_lineas fl
      WHERE fl.id = m.factura_linea_id AND fl.factura_id = p_factura_id
    )
  ) THEN
    RAISE EXCEPTION 'Una de las líneas seleccionadas no pertenece a la factura';
  END IF;

  SELECT fl.descripcion, fl.cantidad, coalesce(previo.total, 0) AS remitido
  INTO v_exceso
  FROM (
    SELECT m.factura_linea_id, sum(rl.cantidad) AS total
    FROM jsonb_to_recordset(p_lineas) AS m(remito_linea_id uuid, factura_linea_id uuid)
    JOIN public.remitos_lineas rl ON rl.id = m.remito_linea_id
    GROUP BY m.factura_linea_id
  ) nuevo
  JOIN public.facturas_electronicas_lineas fl ON fl.id = nuevo.factura_linea_id
  LEFT JOIN LATERAL (
    SELECT sum(x.cantidad) AS total
    FROM public.remitos_lineas x
    WHERE x.factura_linea_id = fl.id
  ) previo ON true
  WHERE coalesce(previo.total, 0) + nuevo.total > fl.cantidad
  ORDER BY fl.ordinal
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'La cantidad a remitir de "%" supera la cantidad facturada disponible (%)',
      v_exceso.descripcion, trim_scale(greatest(v_exceso.cantidad - v_exceso.remitido, 0));
  END IF;

  -- Primero el remito: el trigger de ítems valida que cada línea sea de la factura asociada.
  UPDATE public.remitos r
  SET factura_id = p_factura_id,
      factura_asociada_at = now(),
      factura_asociada_by = auth.uid()
  WHERE r.id = p_remito_id;

  UPDATE public.remitos_lineas rl
  SET factura_linea_id = m.factura_linea_id
  FROM jsonb_to_recordset(p_lineas) AS m(remito_linea_id uuid, factura_linea_id uuid)
  WHERE rl.id = m.remito_linea_id AND rl.remito_id = p_remito_id;

  RETURN p_remito_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_remitos_asociar_factura(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_remitos_asociar_factura(uuid, uuid, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
