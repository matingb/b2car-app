-- ============================================================================
-- Comprobantes recibidos: facturas A/B/C y retenciones documentales de compras y gastos.
-- Cambio OpenSpec: facturas-compra-y-reporte-fiscal (capability comprobantes-recibidos).
--
-- Reglas que respalda esta migración:
--   * Cada documento pertenece a exactamente una operación COMPRA/GASTO del mismo tenant
--     (FK obligatoria y restrictiva). Una operación admite varios documentos.
--   * Los documentos son informativos: no crean ni modifican pagos, saldos, estado de pago,
--     cuentas financieras, cuenta corriente ni stock. No hay tablas de imputación.
--   * Factura única por tenant + CUIT emisor + número normalizados (índice único parcial).
--   * Una operación con documentos no puede eliminarse por ningún punto de borrado.
--   * Líneas manuales CONCEPTO/PERCEPCION con importes informados; sin alícuotas ni cálculos.
--   * Sin Storage, adjuntos, borradores ni NC/ND de compra.
-- Los documentos solo se escriben mediante las RPC SECURITY DEFINER de esta migración.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Posición de IVA del proveedor (ficha fiscal configurable)
-- ----------------------------------------------------------------------------

ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS condicion_iva text;

ALTER TABLE public.proveedores
  DROP CONSTRAINT IF EXISTS proveedores_condicion_iva_check;

ALTER TABLE public.proveedores
  ADD CONSTRAINT proveedores_condicion_iva_check
    CHECK (
      condicion_iva IS NULL
      OR condicion_iva = ANY (ARRAY['RESPONSABLE_INSCRIPTO'::text, 'MONOTRIBUTISTA'::text, 'IVA_EXENTO'::text, 'IVA_NO_ALCANZADO'::text])
    );

COMMENT ON COLUMN public.proveedores.condicion_iva IS
  'Posición de IVA del proveedor. Se precarga como copia editable en los comprobantes recibidos; cambiarla no reescribe documentos.';

-- ----------------------------------------------------------------------------
-- 2. Normalización de identidad de facturas
-- ----------------------------------------------------------------------------

-- CUIT: solo dígitos. "30-71234567-8" y "30712345678" son el mismo emisor.
CREATE OR REPLACE FUNCTION public.comprobantes_recibidos_normalizar_cuit(p_cuit text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  SET search_path TO ''
  AS $function$
  SELECT NULLIF(pg_catalog.regexp_replace(COALESCE(p_cuit, ''), '[^0-9]', '', 'g'), '');
$function$;

-- Número de factura: mayúsculas, segmentos separados por cualquier carácter no alfanumérico y
-- ceros a la izquierda quitados en cada segmento numérico. "0001-00001234", "00001-1234" y
-- "1 - 1234" comparten identidad ("1-1234"); "12-1234" y "1-21234" siguen siendo distintos,
-- de modo que no se confunden numeraciones de puntos de venta diferentes.
CREATE OR REPLACE FUNCTION public.comprobantes_recibidos_normalizar_numero(p_numero text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  SET search_path TO ''
  AS $function$
  SELECT NULLIF(
    pg_catalog.array_to_string(
      ARRAY(
        SELECT CASE
                 WHEN t.segmento ~ '^[0-9]+$' THEN COALESCE(NULLIF(pg_catalog.ltrim(t.segmento, '0'), ''), '0')
                 ELSE t.segmento
               END
        FROM pg_catalog.unnest(
               pg_catalog.regexp_split_to_array(pg_catalog.upper(pg_catalog.btrim(COALESCE(p_numero, ''))), '[^0-9A-Z]+')
             ) WITH ORDINALITY AS t(segmento, posicion)
        WHERE t.segmento <> ''
        ORDER BY t.posicion
      ),
      '-'
    ),
    ''
  );
$function$;

GRANT EXECUTE ON FUNCTION public.comprobantes_recibidos_normalizar_cuit(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.comprobantes_recibidos_normalizar_numero(text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Cabecera: comprobantes_recibidos
-- ----------------------------------------------------------------------------

CREATE TABLE public.comprobantes_recibidos (
  id                       uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id                uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  operacion_id             uuid                     NOT NULL,
  tipo_documento           text                     NOT NULL,
  clase                    text,
  numero                   text,
  numero_normalizado       text                     GENERATED ALWAYS AS (public.comprobantes_recibidos_normalizar_numero(numero)) STORED,
  fecha                    date                     NOT NULL,
  fecha_vencimiento        date,
  proveedor_id             uuid,
  emisor_razon_social      text                     NOT NULL,
  emisor_cuit              text,
  emisor_cuit_normalizado  text                     GENERATED ALWAYS AS (public.comprobantes_recibidos_normalizar_cuit(emisor_cuit)) STORED,
  emisor_condicion_iva     text,
  emisor_domicilio         text,
  receptor_razon_social    text,
  receptor_cuit            text,
  receptor_condicion_iva   text,
  codigo_autorizacion      text,
  vencimiento_autorizacion date,
  observaciones            text,
  -- NULL significa desglose desconocido o sin filas confirmadas.
  desglose_iva             jsonb,
  idempotency_key          uuid                     NOT NULL,
  created_at               timestamp with time zone DEFAULT now() NOT NULL,
  updated_at               timestamp with time zone DEFAULT now() NOT NULL,
  created_by               uuid                     DEFAULT auth.uid(),
  updated_by               uuid                     DEFAULT auth.uid(),
  CONSTRAINT comprobantes_recibidos_pkey PRIMARY KEY (id),
  CONSTRAINT comprobantes_recibidos_id_tenant_key UNIQUE (id, tenant_id),
  CONSTRAINT comprobantes_recibidos_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  -- RESTRICT: una operación con documentos no puede borrarse, ni siquiera por cascada.
  CONSTRAINT comprobantes_recibidos_operacion_id_fkey
    FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE RESTRICT,
  -- El proveedor es solo una referencia: la identidad fiscal vive en la copia histórica.
  CONSTRAINT comprobantes_recibidos_proveedor_id_fkey
    FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE SET NULL,
  CONSTRAINT comprobantes_recibidos_tipo_documento_check
    CHECK (tipo_documento = ANY (ARRAY['FACTURA'::text, 'RETENCION'::text])),
  CONSTRAINT comprobantes_recibidos_clase_check
    CHECK (
      (tipo_documento = 'FACTURA' AND clase = ANY (ARRAY['A'::text, 'B'::text, 'C'::text]))
      OR (tipo_documento = 'RETENCION' AND clase IS NULL)
    ),
  CONSTRAINT comprobantes_recibidos_factura_requeridos_check
    CHECK (
      tipo_documento <> 'FACTURA'
      OR (
        public.comprobantes_recibidos_normalizar_numero(numero) IS NOT NULL
        AND COALESCE(public.comprobantes_recibidos_normalizar_cuit(emisor_cuit), '') ~ '^[0-9]{11}$'
        AND emisor_condicion_iva IS NOT NULL
      )
    ),
  CONSTRAINT comprobantes_recibidos_emisor_condicion_iva_check
    CHECK (
      emisor_condicion_iva IS NULL
      OR emisor_condicion_iva = ANY (ARRAY['RESPONSABLE_INSCRIPTO'::text, 'MONOTRIBUTISTA'::text, 'IVA_EXENTO'::text, 'IVA_NO_ALCANZADO'::text])
    ),
  CONSTRAINT comprobantes_recibidos_receptor_condicion_iva_check
    CHECK (
      receptor_condicion_iva IS NULL
      OR receptor_condicion_iva = ANY (ARRAY['RESPONSABLE_INSCRIPTO'::text, 'MONOTRIBUTISTA'::text, 'IVA_EXENTO'::text, 'IVA_NO_ALCANZADO'::text])
    ),
  CONSTRAINT comprobantes_recibidos_emisor_razon_social_check
    CHECK (char_length(btrim(emisor_razon_social)) BETWEEN 1 AND 200),
  CONSTRAINT comprobantes_recibidos_numero_length_check
    CHECK (numero IS NULL OR char_length(numero) <= 50),
  CONSTRAINT comprobantes_recibidos_textos_length_check
    CHECK (
      (emisor_domicilio IS NULL OR char_length(emisor_domicilio) <= 300)
      AND (receptor_razon_social IS NULL OR char_length(receptor_razon_social) <= 200)
      AND (codigo_autorizacion IS NULL OR char_length(codigo_autorizacion) <= 50)
      AND (observaciones IS NULL OR char_length(observaciones) <= 1000)
    ),
  CONSTRAINT comprobantes_recibidos_fecha_vencimiento_check
    CHECK (fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha)
);

COMMENT ON TABLE public.comprobantes_recibidos IS
  'Facturas A/B/C y retenciones recibidas, asociadas a una operación COMPRA/GASTO. Informativas: no afectan pagos, saldos, cuentas ni stock.';
COMMENT ON COLUMN public.comprobantes_recibidos.codigo_autorizacion IS
  'Código de autorización informado manualmente (CAE/CAI). No implica verificación ante ARCA.';
COMMENT ON COLUMN public.comprobantes_recibidos.fecha_vencimiento IS
  'Fecha de vencimiento de la factura informada por el proveedor. Informativa: no genera pagos ni alertas.';

-- Factura única por tenant + CUIT emisor + número (alta, edición y concurrencia).
CREATE UNIQUE INDEX uq_comprobantes_recibidos_factura
  ON public.comprobantes_recibidos (tenant_id, emisor_cuit_normalizado, numero_normalizado)
  WHERE tipo_documento = 'FACTURA';

-- Reintentos de alta sin duplicar el documento de la misma solicitud.
CREATE UNIQUE INDEX uq_comprobantes_recibidos_idempotency
  ON public.comprobantes_recibidos (tenant_id, idempotency_key);

-- Respalda la FK RESTRICT hacia operaciones y las consultas por operación (el tenant lo filtra RLS).
CREATE INDEX idx_comprobantes_recibidos_operacion
  ON public.comprobantes_recibidos (operacion_id);

CREATE INDEX idx_comprobantes_recibidos_tenant_fecha
  ON public.comprobantes_recibidos (tenant_id, fecha DESC, created_at DESC);

CREATE INDEX idx_comprobantes_recibidos_proveedor
  ON public.comprobantes_recibidos (proveedor_id)
  WHERE proveedor_id IS NOT NULL;

CREATE TRIGGER comprobantes_recibidos_set_updated_at
  BEFORE UPDATE ON public.comprobantes_recibidos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. Líneas: CONCEPTO / PERCEPCION con descripción e importe manuales
-- ----------------------------------------------------------------------------

CREATE TABLE public.comprobantes_recibidos_lineas (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id         uuid                     NOT NULL,
  comprobante_id    uuid                     NOT NULL,
  orden             integer                  NOT NULL,
  tipo              text                     NOT NULL,
  descripcion       text                     NOT NULL,
  -- Percepciones sugeridas con identidad estable; OTRA para percepciones libres.
  percepcion_codigo text,
  iva_alicuota_id   integer,
  -- Identidad de agrupación: código sugerido, u OTRA:<descripción con espacios colapsados en mayúsculas>.
  percepcion_clave  text                     GENERATED ALWAYS AS (
    CASE
      WHEN tipo = 'PERCEPCION' AND percepcion_codigo = 'OTRA'
        THEN 'OTRA:' || upper(regexp_replace(btrim(descripcion), '\s+', ' ', 'g'))
      WHEN tipo = 'PERCEPCION'
        THEN percepcion_codigo
      ELSE NULL
    END
  ) STORED,
  importe           numeric(14,2)            NOT NULL,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT comprobantes_recibidos_lineas_pkey PRIMARY KEY (id),
  CONSTRAINT comprobantes_recibidos_lineas_comprobante_fkey
    FOREIGN KEY (comprobante_id, tenant_id)
    REFERENCES public.comprobantes_recibidos(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT comprobantes_recibidos_lineas_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT comprobantes_recibidos_lineas_orden_key UNIQUE (comprobante_id, orden),
  CONSTRAINT comprobantes_recibidos_lineas_tipo_check
    CHECK (tipo = ANY (ARRAY['CONCEPTO'::text, 'PERCEPCION'::text])),
  CONSTRAINT comprobantes_recibidos_lineas_iva_check
    CHECK (iva_alicuota_id IS NULL OR (tipo = 'CONCEPTO' AND iva_alicuota_id IN (3, 4, 5, 6, 8, 9))),
  CONSTRAINT comprobantes_recibidos_lineas_percepcion_check
    CHECK (
      (tipo = 'CONCEPTO' AND percepcion_codigo IS NULL)
      OR (
        tipo = 'PERCEPCION'
        AND percepcion_codigo = ANY (ARRAY['GANANCIAS'::text, 'IVA'::text, 'IIBB_BUENOS_AIRES'::text, 'IIBB_CABA'::text, 'OTRA'::text])
      )
    ),
  CONSTRAINT comprobantes_recibidos_lineas_descripcion_check
    CHECK (char_length(btrim(descripcion)) BETWEEN 1 AND 200),
  CONSTRAINT comprobantes_recibidos_lineas_importe_check
    CHECK (importe > 0),
  CONSTRAINT comprobantes_recibidos_lineas_orden_check
    CHECK (orden > 0)
);

COMMENT ON TABLE public.comprobantes_recibidos_lineas IS
  'Líneas manuales de comprobantes recibidos. Importes informados por el usuario: no se calculan desde porcentajes ni se clasifican por texto.';

-- Sin índice aparte por comprobante: lo cubre el UNIQUE (comprobante_id, orden).

CREATE INDEX idx_comprobantes_recibidos_lineas_tenant_percepcion
  ON public.comprobantes_recibidos_lineas (tenant_id, percepcion_clave)
  WHERE tipo = 'PERCEPCION';

-- ----------------------------------------------------------------------------
-- 5. Permisos: acceso inicial equivalente a facturación de ventas
-- ----------------------------------------------------------------------------

INSERT INTO public.permissions (id, descripcion) VALUES
  ('comprobantes_recibidos:view', 'Consulta de facturas y retenciones recibidas de compras y gastos'),
  ('comprobantes_recibidos:edit', 'Carga, edición y eliminación de facturas y retenciones recibidas de compras y gastos')
ON CONFLICT (id) DO UPDATE SET descripcion = excluded.descripcion;

INSERT INTO public.role_permissions (role, permission, granted)
SELECT rp.role, 'comprobantes_recibidos:view', rp.granted
FROM public.role_permissions AS rp
WHERE rp.permission = 'facturas:view'
ON CONFLICT (role, permission) DO UPDATE SET granted = excluded.granted;

INSERT INTO public.role_permissions (role, permission, granted)
SELECT rp.role, 'comprobantes_recibidos:edit', rp.granted
FROM public.role_permissions AS rp
WHERE rp.permission = 'facturas:edit'
ON CONFLICT (role, permission) DO UPDATE SET granted = excluded.granted;

INSERT INTO public.plan_permissions (plan, permission, granted)
SELECT pp.plan, 'comprobantes_recibidos:view', pp.granted
FROM public.plan_permissions AS pp
WHERE pp.permission = 'facturas:view'
ON CONFLICT (plan, permission) DO UPDATE SET granted = excluded.granted;

INSERT INTO public.plan_permissions (plan, permission, granted)
SELECT pp.plan, 'comprobantes_recibidos:edit', pp.granted
FROM public.plan_permissions AS pp
WHERE pp.permission = 'facturas:edit'
ON CONFLICT (plan, permission) DO UPDATE SET granted = excluded.granted;

-- ----------------------------------------------------------------------------
-- 6. RLS y grants: lectura por tenant con permiso de consulta; escritura solo por RPC
-- ----------------------------------------------------------------------------

ALTER TABLE public.comprobantes_recibidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobantes_recibidos_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY comprobantes_recibidos_select ON public.comprobantes_recibidos
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public._b2c179_tiene_permiso('comprobantes_recibidos:view')
  );

CREATE POLICY comprobantes_recibidos_lineas_select ON public.comprobantes_recibidos_lineas
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public._b2c179_tiene_permiso('comprobantes_recibidos:view')
  );

REVOKE ALL ON public.comprobantes_recibidos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.comprobantes_recibidos_lineas FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.comprobantes_recibidos TO authenticated;
GRANT SELECT ON public.comprobantes_recibidos_lineas TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comprobantes_recibidos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comprobantes_recibidos_lineas TO service_role;

-- ----------------------------------------------------------------------------
-- 7. Bloqueo de borrado de operaciones documentadas (todos los puntos de borrado)
-- ----------------------------------------------------------------------------
-- Todas las RPC de borrado (rpc_borrar_operacion_completa, rpc_borrar_operacion_con_stock,
-- rpc_borrar_operaciones_con_stock_lista, rpc_eliminar_movimiento_cuenta, borrado de arreglos
-- y cascadas) terminan en DELETE FROM public.operaciones. El trigger rechaza el borrado con un
-- mensaje claro y la FK RESTRICT respalda la regla ante concurrencia. Al fallar, la transacción
-- completa se revierte: no hay borrados parciales ni reversas de pagos o stock.

CREATE OR REPLACE FUNCTION public.comprobantes_recibidos_bloquear_borrado_operacion()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.comprobantes_recibidos AS c
    WHERE c.operacion_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'La operación tiene facturas o retenciones asociadas. Eliminá primero esos documentos para poder borrarla.'
      USING ERRCODE = 'P1801';
  END IF;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.comprobantes_recibidos_bloquear_borrado_operacion() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER comprobantes_recibidos_proteger_operacion
  BEFORE DELETE ON public.operaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.comprobantes_recibidos_bloquear_borrado_operacion();

-- ----------------------------------------------------------------------------
-- 8. RPC: alta y edición (cabecera + líneas en una transacción)
-- ----------------------------------------------------------------------------
-- p_comprobante_id NULL = alta (requiere p_idempotency_key); con valor = edición.
-- No toca operaciones, pagos, movimientos financieros ni stock.

CREATE OR REPLACE FUNCTION public.rpc_comprobante_recibido_guardar(
  p_comprobante_id  uuid,
  p_operacion_id    uuid,
  p_datos           jsonb,
  p_lineas          jsonb,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id              uuid := public.current_tenant_id();
  v_tipo_documento         text;
  v_clase                  text;
  v_numero                 text;
  v_fecha                  date;
  v_proveedor_id           uuid;
  v_emisor_razon_social    text;
  v_emisor_cuit            text;
  v_emisor_condicion_iva   text;
  v_emisor_domicilio       text;
  v_receptor_razon_social  text;
  v_receptor_cuit          text;
  v_receptor_condicion_iva text;
  v_codigo_autorizacion    text;
  v_vencimiento            date;
  v_fecha_vencimiento      date;
  v_observaciones          text;
  v_operacion_tipo         public.tipo_operacion;
  v_existente_id           uuid;
  v_existente_operacion    uuid;
  v_existente_tipo         text;
  v_duplicado              uuid;
  v_id                     uuid;
  v_linea                  jsonb;
  v_orden                  integer := 0;
  v_linea_tipo             text;
  v_linea_descripcion      text;
  v_linea_codigo           text;
  v_linea_importe          numeric;
  v_linea_iva              integer;
  v_desglose               jsonb := p_datos -> 'desglose_iva';
  v_iva                    jsonb;
  v_iva_ids                integer[] := ARRAY[]::integer[];
  v_iva_id                 integer;
  v_base                   numeric;
  v_impuesto               numeric;
  v_desglose_total         numeric := 0;
  v_conceptos_total        numeric := 0;
  v_condiciones            text[] := ARRAY['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'IVA_EXENTO', 'IVA_NO_ALCANZADO'];
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('comprobantes_recibidos:edit') THEN
    RAISE EXCEPTION 'permiso comprobantes_recibidos:edit requerido' USING ERRCODE = '42501';
  END IF;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_operacion_id IS NULL THEN
    RAISE EXCEPTION 'El documento debe asociarse a una operación' USING ERRCODE = '22023';
  END IF;
  IF p_datos IS NULL OR jsonb_typeof(p_datos) <> 'object' THEN
    RAISE EXCEPTION 'Los datos del documento son obligatorios' USING ERRCODE = '22023';
  END IF;
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'Cargá al menos una línea con descripción e importe' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_lineas) > 100 THEN
    RAISE EXCEPTION 'El documento admite hasta 100 líneas' USING ERRCODE = '22023';
  END IF;

  -- Normalización de entrada
  v_tipo_documento         := upper(btrim(COALESCE(p_datos ->> 'tipo_documento', '')));
  v_clase                  := NULLIF(upper(btrim(COALESCE(p_datos ->> 'clase', ''))), '');
  v_numero                 := NULLIF(btrim(COALESCE(p_datos ->> 'numero', '')), '');
  v_emisor_razon_social    := NULLIF(btrim(COALESCE(p_datos ->> 'emisor_razon_social', '')), '');
  v_emisor_cuit            := NULLIF(btrim(COALESCE(p_datos ->> 'emisor_cuit', '')), '');
  v_emisor_condicion_iva   := NULLIF(upper(btrim(COALESCE(p_datos ->> 'emisor_condicion_iva', ''))), '');
  v_emisor_domicilio       := NULLIF(btrim(COALESCE(p_datos ->> 'emisor_domicilio', '')), '');
  v_receptor_razon_social  := NULLIF(btrim(COALESCE(p_datos ->> 'receptor_razon_social', '')), '');
  v_receptor_cuit          := NULLIF(btrim(COALESCE(p_datos ->> 'receptor_cuit', '')), '');
  v_receptor_condicion_iva := NULLIF(upper(btrim(COALESCE(p_datos ->> 'receptor_condicion_iva', ''))), '');
  v_codigo_autorizacion    := NULLIF(btrim(COALESCE(p_datos ->> 'codigo_autorizacion', '')), '');
  v_observaciones          := NULLIF(btrim(COALESCE(p_datos ->> 'observaciones', '')), '');

  BEGIN
    v_fecha := NULLIF(btrim(COALESCE(p_datos ->> 'fecha', '')), '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'La fecha del documento no es válida' USING ERRCODE = '22023';
  END;
  BEGIN
    v_vencimiento := NULLIF(btrim(COALESCE(p_datos ->> 'vencimiento_autorizacion', '')), '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'El vencimiento de la autorización no es válido' USING ERRCODE = '22023';
  END;
  BEGIN
    v_fecha_vencimiento := NULLIF(btrim(COALESCE(p_datos ->> 'fecha_vencimiento', '')), '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'La fecha de vencimiento de la factura no es válida' USING ERRCODE = '22023';
  END;
  IF v_fecha_vencimiento IS NOT NULL AND v_fecha IS NOT NULL AND v_fecha_vencimiento < v_fecha THEN
    RAISE EXCEPTION 'La fecha de vencimiento no puede ser anterior a la fecha de la factura' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_proveedor_id := NULLIF(btrim(COALESCE(p_datos ->> 'proveedor_id', '')), '')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'El proveedor no es válido' USING ERRCODE = '22023';
  END;

  -- Validaciones de cabecera
  IF v_tipo_documento NOT IN ('FACTURA', 'RETENCION') THEN
    RAISE EXCEPTION 'El tipo de documento debe ser FACTURA o RETENCION' USING ERRCODE = '22023';
  END IF;
  IF v_fecha IS NULL THEN
    RAISE EXCEPTION 'La fecha del documento es obligatoria' USING ERRCODE = '22023';
  END IF;
  IF v_emisor_razon_social IS NULL THEN
    RAISE EXCEPTION 'La razón social del emisor es obligatoria' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_emisor_razon_social) > 200 OR char_length(COALESCE(v_receptor_razon_social, '')) > 200 THEN
    RAISE EXCEPTION 'La razón social no puede superar los 200 caracteres' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_numero, '')) > 50 THEN
    RAISE EXCEPTION 'El número no puede superar los 50 caracteres' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_emisor_domicilio, '')) > 300 THEN
    RAISE EXCEPTION 'El domicilio no puede superar los 300 caracteres' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_codigo_autorizacion, '')) > 50 THEN
    RAISE EXCEPTION 'El código de autorización no puede superar los 50 caracteres' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_observaciones, '')) > 1000 THEN
    RAISE EXCEPTION 'Las observaciones no pueden superar los 1000 caracteres' USING ERRCODE = '22023';
  END IF;
  IF v_emisor_condicion_iva IS NOT NULL AND NOT (v_emisor_condicion_iva = ANY (v_condiciones)) THEN
    RAISE EXCEPTION 'La posición de IVA del proveedor no es válida' USING ERRCODE = '22023';
  END IF;
  IF v_receptor_condicion_iva IS NOT NULL AND NOT (v_receptor_condicion_iva = ANY (v_condiciones)) THEN
    RAISE EXCEPTION 'La posición de IVA del receptor no es válida' USING ERRCODE = '22023';
  END IF;
  IF v_emisor_cuit IS NOT NULL
     AND COALESCE(public.comprobantes_recibidos_normalizar_cuit(v_emisor_cuit), '') !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'El CUIT del emisor debe tener 11 dígitos' USING ERRCODE = '22023';
  END IF;
  IF v_receptor_cuit IS NOT NULL
     AND COALESCE(public.comprobantes_recibidos_normalizar_cuit(v_receptor_cuit), '') !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'El CUIT del receptor debe tener 11 dígitos' USING ERRCODE = '22023';
  END IF;

  IF v_tipo_documento = 'FACTURA' THEN
    IF v_clase IS NULL OR v_clase NOT IN ('A', 'B', 'C') THEN
      RAISE EXCEPTION 'La clase de la factura debe ser A, B o C' USING ERRCODE = '22023';
    END IF;
    IF v_numero IS NULL OR public.comprobantes_recibidos_normalizar_numero(v_numero) IS NULL THEN
      RAISE EXCEPTION 'El número de factura es obligatorio' USING ERRCODE = '22023';
    END IF;
    IF v_emisor_condicion_iva IS NULL THEN
      RAISE EXCEPTION 'La posición de IVA del proveedor es obligatoria' USING ERRCODE = '22023';
    END IF;
    IF v_emisor_cuit IS NULL THEN
      RAISE EXCEPTION 'El CUIT del emisor es obligatorio' USING ERRCODE = '22023';
    END IF;
  ELSE
    -- Las retenciones no tienen clase A/B/C y admiten número propio opcional.
    v_clase := NULL;
  END IF;

  IF v_desglose = 'null'::jsonb THEN v_desglose := NULL; END IF;
  IF v_desglose IS NOT NULL THEN
    IF v_tipo_documento <> 'FACTURA' OR v_clase NOT IN ('A', 'B') OR jsonb_typeof(v_desglose) <> 'array' THEN
      RAISE EXCEPTION 'El desglose de IVA solo corresponde a facturas A o B' USING ERRCODE = '22023';
    END IF;
    FOR v_iva IN SELECT value FROM jsonb_array_elements(v_desglose) LOOP
      BEGIN
        v_iva_id := (v_iva ->> 'iva_alicuota_id')::integer;
        v_base := (v_iva ->> 'base')::numeric;
        v_impuesto := (v_iva ->> 'iva')::numeric;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Desglose de IVA inválido' USING ERRCODE = '22023';
      END;
      IF v_iva_id IS NULL OR v_iva_id NOT IN (3, 4, 5, 6, 8, 9) OR v_iva_id = ANY(v_iva_ids)
         OR v_base IS NULL OR v_impuesto IS NULL OR v_base < 0 OR v_impuesto < 0
         OR v_base >= 1000000000000 OR v_impuesto >= 1000000000000
         OR v_base <> round(v_base, 2) OR v_impuesto <> round(v_impuesto, 2) THEN
        RAISE EXCEPTION 'Desglose de IVA inválido' USING ERRCODE = '22023';
      END IF;
      v_iva_ids := array_append(v_iva_ids, v_iva_id);
      v_desglose_total := v_desglose_total + v_base + v_impuesto;
    END LOOP;
    IF jsonb_array_length(v_desglose) = 0 THEN v_desglose := NULL; END IF;
  END IF;

  -- Idempotencia del alta: el mismo pedido reintentado devuelve el documento ya creado.
  IF p_comprobante_id IS NULL THEN
    IF p_idempotency_key IS NULL THEN
      RAISE EXCEPTION 'La clave de idempotencia es obligatoria' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(
      hashtext(v_tenant_id::text || ':comprobante-recibido:' || p_idempotency_key::text)
    );
    SELECT c.id, c.operacion_id
    INTO v_existente_id, v_existente_operacion
    FROM public.comprobantes_recibidos AS c
    WHERE c.tenant_id = v_tenant_id
      AND c.idempotency_key = p_idempotency_key;
    IF FOUND THEN
      IF v_existente_operacion <> p_operacion_id THEN
        RAISE EXCEPTION 'La clave de idempotencia ya se usó para otra operación' USING ERRCODE = '22023';
      END IF;
      RETURN v_existente_id;
    END IF;
  END IF;

  -- Operación del tenant, de tipo COMPRA o GASTO. FOR KEY SHARE impide su borrado concurrente
  -- sin bloquear registros de pagos ni cambios de stock sobre la operación.
  SELECT o.tipo
  INTO v_operacion_tipo
  FROM public.operaciones AS o
  WHERE o.id = p_operacion_id
    AND o.tenant_id = v_tenant_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_operacion_tipo NOT IN ('COMPRA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'Solo se pueden asociar facturas y retenciones a compras o gastos' USING ERRCODE = '22023';
  END IF;

  IF v_proveedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.proveedores AS p
    WHERE p.id = v_proveedor_id AND p.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Proveedor no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_comprobante_id IS NOT NULL THEN
    SELECT c.id, c.operacion_id, c.tipo_documento
    INTO v_existente_id, v_existente_operacion, v_existente_tipo
    FROM public.comprobantes_recibidos AS c
    WHERE c.id = p_comprobante_id
      AND c.tenant_id = v_tenant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Documento no encontrado' USING ERRCODE = 'P0002';
    END IF;
    IF v_existente_operacion <> p_operacion_id THEN
      RAISE EXCEPTION 'El documento pertenece a otra operación' USING ERRCODE = '22023';
    END IF;
    IF v_existente_tipo <> v_tipo_documento THEN
      RAISE EXCEPTION 'No se puede cambiar el tipo de un documento registrado' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Duplicados: mismo CUIT emisor y número en otra factura del tenant (cualquier operación).
  -- El índice único uq_comprobantes_recibidos_factura cubre las solicitudes concurrentes.
  IF v_tipo_documento = 'FACTURA' THEN
    SELECT c.id
    INTO v_duplicado
    FROM public.comprobantes_recibidos AS c
    WHERE c.tenant_id = v_tenant_id
      AND c.tipo_documento = 'FACTURA'
      AND c.emisor_cuit_normalizado = public.comprobantes_recibidos_normalizar_cuit(v_emisor_cuit)
      AND c.numero_normalizado = public.comprobantes_recibidos_normalizar_numero(v_numero)
      AND c.id IS DISTINCT FROM p_comprobante_id
    LIMIT 1;
    IF v_duplicado IS NOT NULL THEN
      RAISE EXCEPTION 'Ya existe una factura registrada con el mismo CUIT emisor y número'
        USING ERRCODE = '23505', CONSTRAINT = 'uq_comprobantes_recibidos_factura';
    END IF;
  END IF;

  IF p_comprobante_id IS NULL THEN
    INSERT INTO public.comprobantes_recibidos (
      tenant_id, operacion_id, tipo_documento, clase, numero, fecha, proveedor_id,
      emisor_razon_social, emisor_cuit, emisor_condicion_iva, emisor_domicilio,
      receptor_razon_social, receptor_cuit, receptor_condicion_iva,
      codigo_autorizacion, vencimiento_autorizacion, fecha_vencimiento, observaciones, idempotency_key, desglose_iva
    ) VALUES (
      v_tenant_id, p_operacion_id, v_tipo_documento, v_clase, v_numero, v_fecha, v_proveedor_id,
      v_emisor_razon_social, v_emisor_cuit, v_emisor_condicion_iva, v_emisor_domicilio,
      v_receptor_razon_social, v_receptor_cuit, v_receptor_condicion_iva,
      v_codigo_autorizacion, v_vencimiento, v_fecha_vencimiento, v_observaciones, p_idempotency_key, v_desglose
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.comprobantes_recibidos
    SET clase                    = v_clase,
        numero                   = v_numero,
        fecha                    = v_fecha,
        proveedor_id             = v_proveedor_id,
        emisor_razon_social      = v_emisor_razon_social,
        emisor_cuit              = v_emisor_cuit,
        emisor_condicion_iva     = v_emisor_condicion_iva,
        emisor_domicilio         = v_emisor_domicilio,
        receptor_razon_social    = v_receptor_razon_social,
        receptor_cuit            = v_receptor_cuit,
        receptor_condicion_iva   = v_receptor_condicion_iva,
        codigo_autorizacion      = v_codigo_autorizacion,
        vencimiento_autorizacion = v_vencimiento,
        fecha_vencimiento        = v_fecha_vencimiento,
        observaciones            = v_observaciones,
        desglose_iva             = v_desglose,
        updated_by               = auth.uid()
    WHERE id = p_comprobante_id
      AND tenant_id = v_tenant_id;
    v_id := p_comprobante_id;

    DELETE FROM public.comprobantes_recibidos_lineas
    WHERE comprobante_id = v_id
      AND tenant_id = v_tenant_id;
  END IF;

  FOR v_linea IN SELECT value FROM jsonb_array_elements(p_lineas) LOOP
    v_orden := v_orden + 1;
    IF jsonb_typeof(v_linea) <> 'object' THEN
      RAISE EXCEPTION 'Línea %: formato inválido', v_orden USING ERRCODE = '22023';
    END IF;

    v_linea_tipo        := upper(btrim(COALESCE(v_linea ->> 'tipo', '')));
    v_linea_descripcion := NULLIF(btrim(COALESCE(v_linea ->> 'descripcion', '')), '');
    v_linea_codigo      := NULLIF(upper(btrim(COALESCE(v_linea ->> 'percepcion_codigo', ''))), '');
    BEGIN
      v_linea_iva := NULLIF(v_linea ->> 'iva_alicuota_id', '')::integer;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Línea %: alícuota inválida', v_orden USING ERRCODE = '22023';
    END;
    IF v_linea_iva IS NOT NULL AND (v_tipo_documento <> 'FACTURA' OR v_clase NOT IN ('A', 'B')
      OR v_linea_tipo <> 'CONCEPTO' OR v_linea_iva NOT IN (3, 4, 5, 6, 8, 9)) THEN
      RAISE EXCEPTION 'Línea %: alícuota inválida', v_orden USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_linea_importe := (v_linea ->> 'importe')::numeric;
    EXCEPTION WHEN others THEN
      v_linea_importe := NULL;
    END;

    IF v_linea_tipo NOT IN ('CONCEPTO', 'PERCEPCION') THEN
      RAISE EXCEPTION 'Línea %: el tipo debe ser CONCEPTO o PERCEPCION', v_orden USING ERRCODE = '22023';
    END IF;
    IF v_tipo_documento = 'FACTURA' AND v_clase = 'B' AND v_linea_tipo = 'CONCEPTO' AND v_linea_iva IS NULL THEN
      RAISE EXCEPTION 'Línea %: elegí la alícuota de IVA para una factura B', v_orden USING ERRCODE = '22023';
    END IF;
    IF v_tipo_documento = 'RETENCION' AND v_linea_tipo <> 'CONCEPTO' THEN
      RAISE EXCEPTION 'Línea %: las retenciones solo admiten líneas de concepto', v_orden USING ERRCODE = '22023';
    END IF;
    IF v_linea_descripcion IS NULL THEN
      RAISE EXCEPTION 'Línea %: la descripción es obligatoria', v_orden USING ERRCODE = '22023';
    END IF;
    IF char_length(v_linea_descripcion) > 200 THEN
      RAISE EXCEPTION 'Línea %: la descripción no puede superar los 200 caracteres', v_orden USING ERRCODE = '22023';
    END IF;
    IF v_linea_importe IS NULL OR v_linea_importe <= 0 THEN
      RAISE EXCEPTION 'Línea %: el importe debe ser mayor a 0', v_orden USING ERRCODE = '22023';
    END IF;
    IF v_linea_importe <> round(v_linea_importe, 2) OR v_linea_importe >= 1000000000000 THEN
      RAISE EXCEPTION 'Línea %: el importe admite hasta 2 decimales y 12 dígitos enteros', v_orden USING ERRCODE = '22023';
    END IF;

    IF v_linea_tipo = 'PERCEPCION' THEN
      v_linea_codigo := COALESCE(v_linea_codigo, 'OTRA');
      IF v_linea_codigo NOT IN ('GANANCIAS', 'IVA', 'IIBB_BUENOS_AIRES', 'IIBB_CABA', 'OTRA') THEN
        RAISE EXCEPTION 'Línea %: la percepción no es válida', v_orden USING ERRCODE = '22023';
      END IF;
    ELSE
      v_linea_codigo := NULL;
      v_conceptos_total := v_conceptos_total + v_linea_importe;
    END IF;

    INSERT INTO public.comprobantes_recibidos_lineas (
      tenant_id, comprobante_id, orden, tipo, descripcion, percepcion_codigo, importe, iva_alicuota_id
    ) VALUES (
      v_tenant_id, v_id, v_orden, v_linea_tipo, v_linea_descripcion, v_linea_codigo, v_linea_importe, v_linea_iva
    );
  END LOOP;

  IF v_desglose_total > v_conceptos_total THEN
    RAISE EXCEPTION 'La base y el IVA del desglose no pueden superar el total de conceptos' USING ERRCODE = '22023';
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_comprobante_recibido_guardar(uuid, uuid, jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_comprobante_recibido_guardar(uuid, uuid, jsonb, jsonb, uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. RPC: eliminación de un documento (no elimina la operación ni revierte pagos o stock)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_comprobante_recibido_eliminar(
  p_comprobante_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('comprobantes_recibidos:edit') THEN
    RAISE EXCEPTION 'permiso comprobantes_recibidos:edit requerido' USING ERRCODE = '42501';
  END IF;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_comprobante_id IS NULL THEN
    RAISE EXCEPTION 'p_comprobante_id requerido' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.comprobantes_recibidos
  WHERE id = p_comprobante_id
    AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento no encontrado' USING ERRCODE = 'P0002';
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_comprobante_recibido_eliminar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_comprobante_recibido_eliminar(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 10. Limpieza de tenant: borrar documentos recibidos antes que las operaciones
-- ----------------------------------------------------------------------------
-- Misma definición vigente (20261108120000) con el borrado previo de comprobantes recibidos,
-- necesario por la FK restrictiva y el bloqueo de borrado de operaciones documentadas.

CREATE OR REPLACE FUNCTION public.eliminar_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'El tenant_id es obligatorio' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.tenants AS t WHERE t.id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el tenant %', p_tenant_id USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);
  PERFORM set_config('app.stock_tenant_cleanup', 'on', true);
  PERFORM set_config('app.stock_cleanup', 'on', true);

  DELETE FROM public.empleado_salarios WHERE tenant_id = p_tenant_id;
  DELETE FROM public.detalle_form_custom WHERE tenant_id = p_tenant_id;
  DELETE FROM public.detalle_arreglo WHERE tenant_id = p_tenant_id;

  -- Documentos recibidos (las líneas se eliminan por cascada) antes que sus operaciones.
  DELETE FROM public.comprobantes_recibidos WHERE tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_movimiento_stock WHERE tenant_id = p_tenant_id;
  DELETE FROM public.movimientos_stock WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_movimiento_cuenta WHERE tenant_id = p_tenant_id;
  DELETE FROM public.movimientos_financieros WHERE tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_lineas AS ol
  USING public.operaciones AS o
  WHERE ol.operacion_id = o.id AND o.tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_asignacion_arreglo WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_gasto WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_ingreso WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_transferencia WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_apertura_cuenta WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_ajuste_financiero WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_ajuste WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_venta WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_compra WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_cobro_arreglo WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_movimiento_proveedor WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_movimiento_cliente WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones WHERE tenant_id = p_tenant_id;

  DELETE FROM public.turnos WHERE tenant_id = p_tenant_id;
  DELETE FROM public.stocks WHERE tenant_id = p_tenant_id;
  DELETE FROM public.arreglos WHERE tenant_id = p_tenant_id;
  DELETE FROM public.empleados WHERE tenant_id = p_tenant_id;
  DELETE FROM public.vehiculos WHERE tenant_id = p_tenant_id;

  DELETE FROM public.representantes AS r
  USING public.empresas AS e, public.clientes AS c
  WHERE r.empresa_id = e.id
    AND e.id = c.id
    AND c.tenant_id = p_tenant_id;

  DELETE FROM public.empresas AS e
  USING public.clientes AS c
  WHERE e.id = c.id
    AND c.tenant_id = p_tenant_id;

  DELETE FROM public.particulares AS p
  USING public.clientes AS c
  WHERE p.id = c.id
    AND c.tenant_id = p_tenant_id;

  DELETE FROM public.clientes WHERE tenant_id = p_tenant_id;
  DELETE FROM public.productos_proveedores WHERE tenant_id = p_tenant_id;
  DELETE FROM public.proveedores WHERE tenant_id = p_tenant_id;
  DELETE FROM public.cuentas_financieras WHERE tenant_id = p_tenant_id;
  DELETE FROM public.categorias_arreglo WHERE tenant_id = p_tenant_id;
  DELETE FROM public.formularios WHERE tenant_id = p_tenant_id;
  DELETE FROM public.talleres WHERE tenant_id = p_tenant_id;
  DELETE FROM public.productos WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant_members WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenants WHERE id = p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.eliminar_tenant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_tenant(uuid) TO service_role, postgres;
