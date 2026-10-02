CREATE OR REPLACE FUNCTION public.eliminar_tenant (
  p_tenant_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."eliminar_tenant"(uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."eliminar_tenant"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."eliminar_tenant"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."eliminar_tenant"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."eliminar_tenant"(uuid) TO "postgres";
