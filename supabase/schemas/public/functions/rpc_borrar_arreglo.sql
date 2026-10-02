CREATE OR REPLACE FUNCTION public.rpc_borrar_arreglo (
  p_arreglo_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_borrar_arreglo"(uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_borrar_arreglo"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_borrar_arreglo"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_borrar_arreglo"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_borrar_arreglo"(uuid) TO "postgres";
