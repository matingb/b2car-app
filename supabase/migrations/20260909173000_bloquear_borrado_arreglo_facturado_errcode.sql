-- Migración: Asignar código de error específico SQLSTATE 55001 (subclase de object_not_in_prerequisite_state / arreglo facturado)
-- al intentar modificar o borrar un arreglo/vehículo/línea con factura autorizada.

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_arreglo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rec jsonb;
  v_arreglo_id uuid;
  v_protegido boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;

  IF TG_TABLE_NAME = 'arreglos' THEN
    v_arreglo_id := (v_rec ->> 'id')::uuid;
    v_protegido := public.facturacion_arreglo_autorizado(v_arreglo_id);
    IF NOT v_protegido THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
    IF TG_OP = 'DELETE'
       OR OLD.vehiculo_id IS DISTINCT FROM NEW.vehiculo_id
       OR OLD.taller_id IS DISTINCT FROM NEW.taller_id
       OR OLD.fecha IS DISTINCT FROM NEW.fecha
       OR OLD.precio_final IS DISTINCT FROM NEW.precio_final
       OR OLD.precio_sin_iva IS DISTINCT FROM NEW.precio_sin_iva
       OR OLD.estado IS DISTINCT FROM NEW.estado THEN
      RAISE EXCEPTION 'El arreglo ya posee una factura electronica autorizada y sus datos fiscales no se pueden modificar'
        USING ERRCODE = '55001';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'vehiculos' THEN
    IF TG_OP = 'UPDATE' AND OLD.cliente_id IS NOT DISTINCT FROM NEW.cliente_id THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.arreglos a
      WHERE a.vehiculo_id = (v_rec ->> 'id')::uuid
        AND public.facturacion_arreglo_autorizado(a.id)
    ) THEN
      RAISE EXCEPTION 'No se puede cambiar el cliente de un vehiculo con arreglos facturados'
        USING ERRCODE = '55001';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_TABLE_NAME = 'operaciones_lineas' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'operacion_id')::uuid
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'operaciones' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'id')::uuid
    LIMIT 1;
  ELSE
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  END IF;

  IF v_arreglo_id IS NOT NULL AND public.facturacion_arreglo_autorizado(v_arreglo_id) THEN
    RAISE EXCEPTION 'No se pueden modificar lineas de un arreglo con factura electronica autorizada'
      USING ERRCODE = '55001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Actualizar rpc_borrar_arreglo para validar tempranamente si el arreglo está facturado
CREATE OR REPLACE FUNCTION public.rpc_borrar_arreglo(
  p_arreglo_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_cobro record;
  v_asignacion record;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  -- Serializar el borrado con locks
  PERFORM 1
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arreglo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Validación temprana de integridad fiscal: evitar anular cobros/stock si el arreglo no se puede borrar
  IF public.facturacion_arreglo_autorizado(p_arreglo_id) THEN
    RAISE EXCEPTION 'El arreglo ya posee una factura electronica autorizada y sus datos fiscales no se pueden modificar'
      USING ERRCODE = '55001';
  END IF;

  -- Anular cobros asociados
  FOR v_cobro IN
    SELECT oca.operacion_id
    FROM public.operaciones_cobro_arreglo AS oca
    WHERE oca.arreglo_id = p_arreglo_id
      AND oca.tenant_id = v_tenant_id
    ORDER BY oca.created_at, oca.operacion_id
  LOOP
    PERFORM public.rpc_finanzas_anular_cobro_arreglo(
      p_arreglo_id,
      v_cobro.operacion_id
    );
  END LOOP;

  -- Revertir repuestos asociados
  FOR v_asignacion IN
    SELECT oa.operacion_id
    FROM public.operaciones_asignacion_arreglo AS oa
    JOIN public.operaciones AS o ON o.id = oa.operacion_id
    WHERE oa.arreglo_id = p_arreglo_id
      AND o.tenant_id = v_tenant_id
  LOOP
    PERFORM public.rpc_borrar_operacion_con_stock(
      v_asignacion.operacion_id,
      NULL
    );
  END LOOP;

  DELETE FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_borrar_arreglo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_borrar_arreglo(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
