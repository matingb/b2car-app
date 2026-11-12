BEGIN;

SET LOCAL ROLE service_role;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '7ff568f8-4d46-463b-969c-9e68157fa769',
    'role', 'service_role',
    'tenant_id', '11111111-1111-1111-1111-111111111111',
    'user_role', 'admin',
    'plan_sub', 'PRO'
  )::text,
  true
);

SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $fixture$
DECLARE
  v_taller_id       uuid := '50000000-0000-0000-0000-000000000001';
  v_vehiculo_id     uuid := '40000000-0000-0000-0000-000000000001';
  v_stock_id        uuid := '70000000-0000-0000-0000-000000000001';
  v_otro_stock_id   uuid := '70000000-0000-0000-0000-000000000002';
  v_root_key        uuid := 'f0000000-0000-4000-8000-000000000001';
  v_otro_root_key   uuid := 'f0000000-0000-4000-8000-000000000002';
  v_cuenta_id       uuid;
  v_arreglo_id      uuid;
  v_stock_inicial   integer;
  v_clave_primera   uuid;
  v_clave_repetida  uuid;
  v_clave_otro_root uuid;
  v_clave_otro_stock uuid;
  v_clave_otra_posicion uuid;
  v_cantidad        integer;
  v_cantidad_asignada integer;
  v_cantidad_compras integer;
  v_cantidad_pagos  integer;
  v_total_pagos     numeric;
  v_saldo           numeric;
  v_default_args    text;
BEGIN
  SELECT s.cantidad INTO v_stock_inicial
  FROM public.stocks AS s
  WHERE s.id = v_stock_id AND s.taller_id = v_taller_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fixture requiere el stock semilla %', v_stock_id;
  END IF;

  SELECT c.id INTO v_cuenta_id
  FROM public.rpc_finanzas_crear_cuenta(
    'Fixture idempotencia ' || gen_random_uuid()::text,
    'EFECTIVO',
    10000
  ) AS c;

  SELECT public.rpc_crear_arreglo_completo(
    p_vehiculo_id := v_vehiculo_id,
    p_taller_id := v_taller_id,
    p_estado := 'SIN_INICIAR',
    p_descripcion := 'Fixture SQL idempotencia compras',
    p_kilometraje_leido := 0,
    p_fecha := now(),
    p_observaciones := NULL,
    p_precio_final := 0,
    p_precio_sin_iva := 0,
    p_esta_pago := false,
    p_extra_data := '{}'::jsonb,
    p_detalles := '[]'::jsonb,
    p_repuestos := '[]'::jsonb,
    p_repuestos_nuevos := '[]'::jsonb,
    p_cuenta_id := v_cuenta_id,
    p_idempotency_key := NULL,
    p_es_facturable := false
  ) INTO v_arreglo_id;

  PERFORM public._asignar_repuestos_existentes_a_arreglo(
    p_arreglo_id := v_arreglo_id,
    p_taller_id := v_taller_id,
    p_repuestos := jsonb_build_array(
      jsonb_build_object(
        'stock_id', v_stock_id,
        'cantidad', v_stock_inicial + 1,
        'monto_unitario', 0,
        'precio_compra', 100
      ),
      jsonb_build_object(
        'stock_id', v_stock_id,
        'cantidad', v_stock_inicial + 2,
        'monto_unitario', 0,
        'precio_compra', 100
      )
    ),
    p_cuenta_id := v_cuenta_id,
    p_idempotency_key := v_root_key
  );

  v_clave_primera := md5(format(
    'arreglo-compra:v1:%s:%s:%s', v_root_key, v_stock_id, 1
  ))::uuid;
  v_clave_repetida := md5(format(
    'arreglo-compra:v1:%s:%s:%s', v_root_key, v_stock_id, 1
  ))::uuid;
  v_clave_otro_root := md5(format(
    'arreglo-compra:v1:%s:%s:%s', v_otro_root_key, v_stock_id, 1
  ))::uuid;
  v_clave_otro_stock := md5(format(
    'arreglo-compra:v1:%s:%s:%s', v_root_key, v_otro_stock_id, 1
  ))::uuid;
  v_clave_otra_posicion := md5(format(
    'arreglo-compra:v1:%s:%s:%s', v_root_key, v_stock_id, 2
  ))::uuid;

  IF v_clave_primera <> v_clave_repetida THEN
    RAISE EXCEPTION 'La derivación no es estable para la misma entrada';
  END IF;
  IF v_clave_primera IN (v_clave_otro_root, v_clave_otro_stock, v_clave_otra_posicion) THEN
    RAISE EXCEPTION 'La derivación no separa raíz, stock y posición';
  END IF;

  SELECT count(*), COALESCE(sum(omc.importe), 0)
  INTO v_cantidad_pagos, v_total_pagos
  FROM public.operaciones_movimiento_cuenta AS omc
  WHERE omc.cuenta_id = v_cuenta_id
    AND omc.idempotency_key IN (v_clave_primera, v_clave_otra_posicion);
  IF v_cantidad_pagos <> 2 OR v_total_pagos <> -200 THEN
    RAISE EXCEPTION 'Compras repetidas: pagos inesperados, count=%, total=%',
      v_cantidad_pagos, v_total_pagos;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.operaciones_movimiento_cuenta AS omc
    WHERE omc.cuenta_id = v_cuenta_id AND omc.idempotency_key = v_root_key
  ) THEN
    RAISE EXCEPTION 'La clave raíz quedó asociada a una compra';
  END IF;

  SELECT l.cantidad INTO v_cantidad_asignada
  FROM public.operaciones_asignacion_arreglo AS oa
  JOIN public.operaciones_lineas AS l ON l.operacion_id = oa.operacion_id
  WHERE oa.arreglo_id = v_arreglo_id AND l.stock_id = v_stock_id;
  IF v_cantidad_asignada IS DISTINCT FROM v_stock_inicial + 2 THEN
    RAISE EXCEPTION 'Cantidad asignada inesperada: %', v_cantidad_asignada;
  END IF;

  SELECT count(*) INTO v_cantidad_compras
  FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones AS o ON o.id = omc.operacion_id
  JOIN public.operaciones_compra AS oc ON oc.operacion_id = o.id
  JOIN public.operaciones_lineas AS l ON l.operacion_id = o.id
  WHERE o.tipo = 'COMPRA'
    AND l.stock_id = v_stock_id
    AND omc.idempotency_key IN (v_clave_primera, v_clave_otra_posicion);
  IF v_cantidad_compras <> 2 THEN
    RAISE EXCEPTION 'Se esperaban dos compras por posiciones repetidas; se encontraron %',
      v_cantidad_compras;
  END IF;

  SELECT s.cantidad INTO v_cantidad
  FROM public.stocks AS s WHERE s.id = v_stock_id;
  IF v_cantidad <> 0 THEN
    RAISE EXCEPTION 'El stock debía terminar en cero, quedó en %', v_cantidad;
  END IF;

  -- Llamada con cuatro argumentos: el quinto conserva el DEFAULT NULL.
  PERFORM public._asignar_repuestos_existentes_a_arreglo(
    v_arreglo_id,
    v_taller_id,
    jsonb_build_array(jsonb_build_object(
      'stock_id', v_stock_id,
      'cantidad', v_stock_inicial + 3,
      'monto_unitario', 0,
      'precio_compra', 50
    )),
    v_cuenta_id
  );

  SELECT count(*) INTO v_cantidad_pagos
  FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones AS o ON o.id = omc.operacion_id
  WHERE omc.cuenta_id = v_cuenta_id
    AND omc.idempotency_key IS NULL
    AND o.created_at = transaction_timestamp()
    AND o.tipo = 'COMPRA'
    AND EXISTS (
      SELECT 1 FROM public.operaciones_lineas AS l
      WHERE l.operacion_id = o.id AND l.stock_id = v_stock_id
    );
  IF v_cantidad_pagos <> 1 THEN
    RAISE EXCEPTION 'La compra sin clave no conservó una clave NULL';
  END IF;

  SELECT a.cantidad INTO v_cantidad
  FROM public.stocks AS a WHERE a.id = v_stock_id;
  IF v_cantidad <> 0 THEN
    RAISE EXCEPTION 'La llamada sin clave no completó la reposición';
  END IF;

  SELECT c.saldo INTO v_saldo
  FROM public.cuentas_financieras AS c WHERE c.id = v_cuenta_id;
  IF v_saldo <> 9750 THEN
    RAISE EXCEPTION 'Saldo inesperado luego de las tres compras: %', v_saldo;
  END IF;

  SELECT pg_get_function_arguments(
    'public._asignar_repuestos_existentes_a_arreglo(uuid,uuid,jsonb,uuid,uuid)'::regprocedure
  ) INTO v_default_args;
  IF v_default_args NOT LIKE '%p_cuenta_id uuid DEFAULT NULL::uuid%'
     OR v_default_args NOT LIKE '%p_idempotency_key uuid DEFAULT NULL::uuid%' THEN
    RAISE EXCEPTION 'Cambió la firma/defaults de la variante de cinco argumentos: %',
      v_default_args;
  END IF;

  IF has_function_privilege(
       'authenticated',
       'public._asignar_repuestos_existentes_a_arreglo(uuid,uuid,jsonb,uuid,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'public._asignar_repuestos_existentes_a_arreglo(uuid,uuid,jsonb,uuid,uuid)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'service_role',
       'public._asignar_repuestos_existentes_a_arreglo(uuid,uuid,jsonb,uuid,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Los permisos del helper privado cambiaron';
  END IF;
END;
$fixture$;

ROLLBACK;
