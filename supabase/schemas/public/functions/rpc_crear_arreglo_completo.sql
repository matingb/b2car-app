CREATE OR REPLACE FUNCTION public.rpc_crear_arreglo_completo (
  p_vehiculo_id        uuid,
  p_taller_id          uuid,
  p_estado             public.estado_arreglo,
  p_descripcion        text,
  p_kilometraje_leido  integer,
  p_fecha              timestamp with time zone,
  p_observaciones      text,
  p_precio_final       numeric,
  p_precio_sin_iva     numeric,
  p_esta_pago          boolean,
  p_extra_data         jsonb,
  p_detalles           jsonb                    DEFAULT '[]'::jsonb,
  p_repuestos          jsonb                    DEFAULT '[]'::jsonb,
  p_repuestos_nuevos   jsonb                    DEFAULT '[]'::jsonb,
  p_detalle_formulario jsonb                    DEFAULT NULL::jsonb,
  p_cuenta_id          uuid                     DEFAULT NULL::uuid,
  p_fecha_cobro        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_idempotency_key    uuid                     DEFAULT NULL::uuid,
  p_combustible_leido  integer                  DEFAULT NULL::integer,
  p_es_facturable      boolean                  DEFAULT false,
  p_iva_rate           numeric                  DEFAULT 0.21
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_arreglo_id uuid;
  v_pendientes jsonb;
  v_precio_final numeric;
  v_precio_sin_iva numeric;
BEGIN
  IF p_vehiculo_id IS NULL OR p_taller_id IS NULL OR p_fecha IS NULL THEN
    RAISE EXCEPTION 'vehiculo_id, taller_id y fecha son requeridos' USING ERRCODE = '22023';
  END IF;
  IF p_iva_rate IS NULL OR p_iva_rate < 0 OR p_iva_rate >= 1 THEN
    RAISE EXCEPTION 'iva_rate debe ser un número entre 0 y 1' USING ERRCODE = '22023';
  END IF;
  IF p_combustible_leido IS NOT NULL AND p_combustible_leido NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'combustible_leido debe estar entre 0 y 100' USING ERRCODE = '22023';
  END IF;
  IF p_estado = 'PRESUPUESTO' AND coalesce(p_esta_pago, false) THEN
    RAISE EXCEPTION 'No se puede crear un presupuesto como pagado' USING ERRCODE = '22023';
  END IF;
  p_detalles := coalesce(p_detalles, '[]'::jsonb);
  p_repuestos := coalesce(p_repuestos, '[]'::jsonb);
  p_repuestos_nuevos := coalesce(p_repuestos_nuevos, '[]'::jsonb);
  IF jsonb_typeof(p_detalles) <> 'array' OR jsonb_typeof(p_repuestos) <> 'array'
     OR jsonb_typeof(p_repuestos_nuevos) <> 'array' THEN
    RAISE EXCEPTION 'detalles y repuestos deben ser arrays' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_repuestos_nuevos) > 0 AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para registrar la compra automatica' USING ERRCODE = '22023';
  END IF;
  IF p_cuenta_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cuentas_financieras c
    WHERE c.id = p_cuenta_id AND c.tenant_id = public.current_tenant_id() AND c.activo
  ) THEN
    RAISE EXCEPTION 'CUENTA_FINANCIERA_REQUERIDA' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public._check_codigos_unicos_en_array(p_repuestos_nuevos);
  v_arreglo_id := public._insert_arreglo_base(
    p_vehiculo_id, p_taller_id, p_estado, p_descripcion, p_kilometraje_leido,
    p_fecha, p_observaciones, p_precio_final, p_precio_sin_iva, false, p_extra_data
  );
  PERFORM public._insert_detalles_arreglo(v_arreglo_id, p_detalles);
  PERFORM public._insert_detalle_form_custom(v_arreglo_id, p_detalle_formulario);
  -- p_precio_final is only the client preview; triggers may resolve a different
  -- workshop rate, so persisted lines are the source of truth for the final total.
  IF p_estado = 'PRESUPUESTO' THEN
    v_pendientes := public._b2c152_normalizar_pendientes(
      p_repuestos, p_repuestos_nuevos, p_cuenta_id, p_taller_id, public.current_tenant_id()
    );
    UPDATE public.arreglos
    SET repuestos_pendientes = v_pendientes,
        combustible_leido = p_combustible_leido,
        es_facturable = false,
        updated_at = now()
    WHERE id = v_arreglo_id;
    v_precio_final := public.calcular_precio_final_arreglo(v_arreglo_id);
    v_precio_sin_iva := round(v_precio_final / (1 + p_iva_rate), 2);
    UPDATE public.arreglos
    SET precio_final = v_precio_final,
        precio_sin_iva = v_precio_sin_iva
    WHERE id = v_arreglo_id;
    RETURN v_arreglo_id;
  END IF;
  PERFORM public._asignar_repuestos_existentes_a_arreglo(v_arreglo_id, p_taller_id, p_repuestos, p_cuenta_id, p_idempotency_key);
  PERFORM public._crear_repuestos_nuevos_para_arreglo(v_arreglo_id, p_taller_id, p_repuestos_nuevos, p_cuenta_id);
  v_precio_final := public.calcular_precio_final_arreglo(v_arreglo_id);
  v_precio_sin_iva := round(v_precio_final / (1 + p_iva_rate), 2);
  UPDATE public.arreglos
  SET combustible_leido = p_combustible_leido,
      precio_final = v_precio_final,
      precio_sin_iva = v_precio_sin_iva,
      es_facturable = CASE WHEN (SELECT auth.jwt() ->> 'plan_sub') = 'PRO' THEN coalesce(p_es_facturable, false) ELSE false END,
      updated_at = now()
  WHERE id = v_arreglo_id;
  IF coalesce(p_esta_pago, false) THEN
    IF p_cuenta_id IS NULL OR p_idempotency_key IS NULL THEN
      RAISE EXCEPTION 'cuenta_id e idempotency_key requeridos para registrar el cobro' USING ERRCODE = '22023';
    END IF;
    PERFORM public.rpc_finanzas_cobrar_arreglo(v_arreglo_id, p_cuenta_id, v_precio_final, coalesce(p_fecha_cobro, p_fecha), NULL, p_idempotency_key);
  END IF;
  RETURN v_arreglo_id;
END;
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."rpc_crear_arreglo_completo"(uuid, uuid, public.estado_arreglo, text, integer, timestamp
    WITH time zone, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, timestamp WITH time zone, uuid, integer, boolean, numeric)
  TO "anon", "authenticated";

GRANT EXECUTE
  ON FUNCTION "public"."rpc_crear_arreglo_completo"(uuid, uuid, public.estado_arreglo, text, integer, timestamp
    WITH time zone, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, timestamp WITH time zone, uuid, integer, boolean, numeric)
  TO "service_role";

REVOKE ALL
  ON FUNCTION "public"."rpc_crear_arreglo_completo"(uuid, uuid, public.estado_arreglo, text, integer, timestamp
    WITH time zone, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, timestamp WITH time zone, uuid, integer, boolean, numeric)
  FROM PUBLIC;

REVOKE ALL
  ON FUNCTION "public"."rpc_crear_arreglo_completo"(uuid, uuid, public.estado_arreglo, text, integer, timestamp
    WITH time zone, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, timestamp WITH time zone, uuid, integer, boolean, numeric)
  FROM "postgres";

GRANT EXECUTE
  ON FUNCTION "public"."rpc_crear_arreglo_completo"(uuid, uuid, public.estado_arreglo, text, integer, timestamp
    WITH time zone, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, timestamp WITH time zone, uuid, integer, boolean, numeric)
  TO "postgres";
