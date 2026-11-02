CREATE FUNCTION public.rpc_crear_operacion_con_stock (
  p_tipo            public.tipo_operacion,
  p_taller_id       uuid,
  p_lineas          jsonb,
  p_arreglo_id      uuid                     DEFAULT NULL::uuid,
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_pagos           jsonb                    DEFAULT NULL::jsonb,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_idempotency_key uuid                     DEFAULT NULL::uuid,
  p_observaciones   text                     DEFAULT NULL::text,
  p_estado_pago     text                     DEFAULT NULL::text,
  p_monto_inicial   numeric                  DEFAULT NULL::numeric,
  p_mover_stock     boolean                  DEFAULT true,
  p_proveedor_id    uuid                     DEFAULT NULL::uuid,
  p_cliente_id      uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  RETURN public._crear_operacion_con_stock(
    p_tipo := p_tipo,
    p_taller_id := p_taller_id,
    p_lineas := p_lineas,
    p_arreglo_id := p_arreglo_id,
    p_cuenta_id := p_cuenta_id,
    p_pagos := p_pagos,
    p_fecha := p_fecha,
    p_idempotency_key := p_idempotency_key,
    p_observaciones := p_observaciones,
    p_estado_pago := p_estado_pago,
    p_monto_inicial := p_monto_inicial,
    p_mover_stock := p_mover_stock,
    p_proveedor_id := p_proveedor_id,
    p_cliente_id := p_cliente_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp
  WITH time zone, uuid, text, text, numeric, boolean, uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp
  WITH time zone, uuid, text, text, numeric, boolean, uuid, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, uuid, jsonb, timestamp
  WITH time zone, uuid, text, text, numeric, boolean, uuid, uuid) TO service_role;