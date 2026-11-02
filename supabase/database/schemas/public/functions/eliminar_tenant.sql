CREATE FUNCTION public.eliminar_tenant (
  p_tenant_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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

  -- Borrar OMS, OMC y ledgers inmutables antes que líneas, operaciones, stocks y cuentas
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
  DELETE FROM public.operaciones_ajuste WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_venta WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_compra WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_cobro_arreglo WHERE tenant_id = p_tenant_id;
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
$function$;

REVOKE ALL ON FUNCTION public.eliminar_tenant(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.eliminar_tenant(uuid) TO service_role;