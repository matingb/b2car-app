-- Procesos administrativos para el ciclo de vida de un tenant.
-- Se ejecutan solo con service_role: no deben exponerse a usuarios autenticados.

CREATE OR REPLACE FUNCTION public.crear_tenant(
  p_nombre text,
  p_administrador_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF nullif(btrim(p_nombre), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre del tenant es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_administrador_id IS NULL THEN
    RAISE EXCEPTION 'El administrador inicial es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM auth.users AS u
  WHERE u.id = p_administrador_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el usuario administrador %', p_administrador_id
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.tenant_members AS tm
  WHERE tm.cliente_id = p_administrador_id;

  IF FOUND THEN
    RAISE EXCEPTION 'El usuario administrador % ya pertenece a un tenant', p_administrador_id
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.tenants (nombre)
  VALUES (btrim(p_nombre))
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.tenant_members (cliente_id, tenant_id, rol)
  VALUES (p_administrador_id, v_tenant_id, 'admin');

  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.eliminar_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'El tenant_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  -- Bloquea el tenant para evitar altas concurrentes mientras se lo elimina.
  PERFORM 1
  FROM public.tenants AS t
  WHERE t.id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el tenant %', p_tenant_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Hijos directos de empleados, arreglos y operaciones.
  DELETE FROM public.empleado_salarios
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.detalle_form_custom
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.detalle_arreglo
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_lineas AS ol
  USING public.operaciones AS o
  WHERE ol.operacion_id = o.id
    AND o.tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_asignacion_arreglo AS oaa
  USING public.operaciones AS o
  WHERE oaa.operacion_id = o.id
    AND o.tenant_id = p_tenant_id;

  -- Filas que dependen de clientes, vehículos, talleres, productos o arreglos.
  DELETE FROM public.turnos
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.operaciones
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.stocks
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.arreglos
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.empleados
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.vehiculos
  WHERE tenant_id = p_tenant_id;

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

  DELETE FROM public.clientes
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.formularios
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.talleres
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.productos
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.tenant_members
  WHERE tenant_id = p_tenant_id;

  -- El tenant se borra al final, cuando ya no quedan referencias.
  DELETE FROM public.tenants
  WHERE id = p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_tenant(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_tenant(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_tenant(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.eliminar_tenant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_tenant(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_tenant(uuid) TO service_role;
