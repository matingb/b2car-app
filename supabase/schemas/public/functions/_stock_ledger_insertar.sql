CREATE OR REPLACE FUNCTION public._stock_ledger_insertar (
  p_tenant_id          uuid,
  p_taller_id          uuid,
  p_producto_id        uuid,
  p_stock_id           uuid,
  p_operacion_id       uuid,
  p_tipo_movimiento    text,
  p_cantidad           integer,
  p_saldo_anterior     integer,
  p_saldo_posterior    integer,
  p_fecha              timestamptz DEFAULT now(),
  p_motivo             text DEFAULT NULL,
  p_created_by         uuid DEFAULT NULL,
  p_detalle_arreglo_id uuid DEFAULT NULL
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.movimientos_stock (
    tenant_id,
    taller_id,
    producto_id,
    stock_id,
    operacion_id,
    detalle_arreglo_id,
    tipo_movimiento,
    cantidad,
    saldo_anterior,
    saldo_posterior,
    fecha,
    motivo,
    created_by
  )
  VALUES (
    p_tenant_id,
    p_taller_id,
    p_producto_id,
    p_stock_id,
    p_operacion_id,
    p_detalle_arreglo_id,
    p_tipo_movimiento,
    p_cantidad,
    p_saldo_anterior,
    p_saldo_posterior,
    COALESCE(p_fecha, now()),
    p_motivo,
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public._stock_ledger_insertar TO "anon", "authenticated", "service_role", "postgres";
