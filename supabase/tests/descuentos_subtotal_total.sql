-- ============================================================================
-- Tests: Descuentos, Subtotal y Total Autocalculados en Arreglos y Operaciones
-- ============================================================================
-- Correr con psql -v ON_ERROR_STOP=1 contra base migrada:
--   docker exec -i supabase_db_b2car-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/descuentos_subtotal_total.sql
-- Todo el fixture hace ROLLBACK. No deja datos sucios.
-- ============================================================================
BEGIN;

DO $test$
DECLARE
  t uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  v uuid := gen_random_uuid();
  taller uuid := gen_random_uuid();
  prod uuid := gen_random_uuid();
  st uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  d uuid := gen_random_uuid();
  venta uuid := gen_random_uuid();
  linea_v uuid := gen_random_uuid();
  compra uuid := gen_random_uuid();
  linea_c uuid := gen_random_uuid();
  gasto uuid := gen_random_uuid();
  asig uuid := gen_random_uuid();
  asig_linea uuid := gen_random_uuid();
  factura uuid := gen_random_uuid();
  cat uuid := gen_random_uuid();
  emp uuid := gen_random_uuid();
  r_arr public.arreglos;
  r_op public.operaciones;
  r_det public.detalle_arreglo;
  r_lin public.operaciones_lineas;
  r_form public.detalle_form_custom;
  r_dash record;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','service_role','tenant_id',t)::text, true);

  -- Fixture base
  INSERT INTO public.tenants(id, nombre) VALUES (t, 'Test Descuentos Fixture');
  INSERT INTO public.clientes(id, tenant_id) VALUES (c, t);
  INSERT INTO public.talleres(id, tenant_id, nombre, ubicacion) VALUES (taller, t, 'Taller Test', 'Centro');
  INSERT INTO public.productos(id, tenant_id, codigo, nombre) VALUES (prod, t, 'DESC-PROD-1', 'Producto Test');
  INSERT INTO public.stocks(id, tenant_id, taller_id, producto_id) VALUES (st, t, taller, prod);
  INSERT INTO public.vehiculos(id, cliente_id, tenant_id, patente, marca, modelo)
    VALUES (v, c, t, 'DESC-001', 'Test', 'Test');

  -- --------------------------------------------------------------------------
  -- 1. DETALLE_ARREGLO: cálculo de subtotal, validación de descuento y total
  -- --------------------------------------------------------------------------
  INSERT INTO public.arreglos(id, vehiculo_id, tenant_id, taller_id, precios_incluyen_iva, tasa_iva)
    VALUES (a, v, t, taller, true, 0.21);

  -- Inserción con cantidad 2, horas 1.5, precio 1000 => subtotal = 3000, descuento = 500 => total = 2500
  INSERT INTO public.detalle_arreglo(id, arreglo_id, tenant_id, descripcion, cantidad, horas_facturadas, precio_hora_facturada, descuento)
    VALUES (d, a, t, 'Mano de obra', 2, 1.5, 1000, 500);

  SELECT * INTO r_det FROM public.detalle_arreglo WHERE id = d;
  ASSERT r_det.subtotal = 3000.00 AND r_det.descuento = 500.00 AND r_det.total = 2500.00,
    'detalle_arreglo: subtotal o total incorrecto tras INSERT';

  -- Validar que descuento no puede ser negativo
  BEGIN
    UPDATE public.detalle_arreglo SET descuento = -10 WHERE id = d;
    RAISE EXCEPTION 'descuento negativo no fue rechazado';
  EXCEPTION WHEN SQLSTATE '22023' OR check_violation THEN NULL; END;

  -- Validar que descuento no puede superar el subtotal
  BEGIN
    UPDATE public.detalle_arreglo SET descuento = 3500 WHERE id = d;
    RAISE EXCEPTION 'descuento mayor al subtotal no fue rechazado';
  EXCEPTION WHEN SQLSTATE '22023' OR check_violation THEN NULL; END;

  -- --------------------------------------------------------------------------
  -- 2. DETALLE_FORM_CUSTOM: cálculo de subtotal, descuento y total
  -- --------------------------------------------------------------------------
  INSERT INTO public.detalle_form_custom(arreglo_id, tenant_id, costo, descuento)
    VALUES (a, t, 1200, 200);

  SELECT * INTO r_form FROM public.detalle_form_custom WHERE arreglo_id = a;
  ASSERT r_form.subtotal = 1200.00 AND r_form.descuento = 200.00 AND r_form.total = 1000.00,
    'detalle_form_custom: subtotal, descuento o total incorrecto';

  -- --------------------------------------------------------------------------
  -- 3. CABECERA ARREGLOS: sincronización autocalculada con IVA
  -- --------------------------------------------------------------------------
  -- Arreglo con precios_incluyen_iva = true:
  -- d.subtotal = 3000, d.descuento = 500, d.total = 2500
  -- form.subtotal = 1200, form.descuento = 200, form.total = 1000
  -- Total subtotal = 4200, Total descuento = 700, Total precio_final = 3500
  SELECT * INTO r_arr FROM public.arreglos WHERE id = a;
  ASSERT r_arr.subtotal = 4200.00 AND r_arr.descuento = 700.00 AND r_arr.precio_final = 3500.00,
    'arreglos: subtotal, descuento o precio_final no cuadran con precios_incluyen_iva = true';

  -- Cambiar a precios_incluyen_iva = false (IVA 21% aplicado luego de los descuentos)
  -- Neto sin IVA: subtotal = 4200, descuento = 700, neto descontado = 3500
  -- Con IVA 21%: precio_final = 3500 + 735 = 4235.00
  -- precio_sin_iva = 3500.00
  UPDATE public.arreglos SET precios_incluyen_iva = false, tasa_iva = 0.21 WHERE id = a;
  SELECT * INTO r_arr FROM public.arreglos WHERE id = a;
  ASSERT r_arr.subtotal = 4200.00 AND r_arr.descuento = 700.00
     AND r_arr.precio_sin_iva = 3500.00 AND r_arr.precio_final = 4235.00,
    'arreglos: orden IVA post-descuento fallo en precios_incluyen_iva = false';

  -- Probar 100% de descuento en el arreglo:
  -- Bonificamos todo el detalle (3000) y todo el formulario (1200)
  UPDATE public.detalle_arreglo SET descuento = 3000 WHERE id = d;
  UPDATE public.detalle_form_custom SET descuento = 1200 WHERE arreglo_id = a;
  SELECT * INTO r_arr FROM public.arreglos WHERE id = a;
  ASSERT r_arr.precio_final = 0.00 AND r_arr.esta_pago = true,
    'arreglos: 100% descuento debe dejar precio_final = 0 y esta_pago = true';

  -- --------------------------------------------------------------------------
  -- 4. OPERACIONES_LINEAS y VENTA
  -- --------------------------------------------------------------------------
  INSERT INTO public.operaciones(id, tenant_id, tipo, taller_id, monto_total)
    VALUES (venta, t, 'VENTA', taller, 0);
  INSERT INTO public.operaciones_venta(operacion_id, tenant_id, cliente_id)
    VALUES (venta, t, c);

  -- Insertar línea en venta: cantidad 3, unitario 100 => subtotal 300, descuento 50 => total 250
  INSERT INTO public.operaciones_lineas(id, operacion_id, stock_id, cantidad, monto_unitario, sentido, descuento)
    VALUES (linea_v, venta, st, 3, 100, -1, 50);

  SELECT * INTO r_lin FROM public.operaciones_lineas WHERE id = linea_v;
  ASSERT r_lin.subtotal = 300.00 AND r_lin.descuento = 50.00 AND r_lin.total = 250.00,
    'operaciones_lineas: subtotal o total incorrecto en VENTA';

  -- La cabecera venta debe sincronizarse automáticamente via trigger AFTER
  SELECT * INTO r_op FROM public.operaciones WHERE id = venta;
  ASSERT r_op.subtotal = 300.00 AND r_op.descuento = 50.00 AND r_op.monto_total = 250.00,
    'operaciones (VENTA): cabecera no se actualizó automáticamente';

  -- Modificar el descuento de la línea: subtotal 300, descuento 100 => total 200
  UPDATE public.operaciones_lineas SET descuento = 100 WHERE id = linea_v;
  SELECT * INTO r_op FROM public.operaciones WHERE id = venta;
  ASSERT r_op.subtotal = 300.00 AND r_op.descuento = 100.00 AND r_op.monto_total = 200.00,
    'operaciones (VENTA): actualización de descuento en línea no reflejada en cabecera';

  -- Bonificación al 100% en venta:
  UPDATE public.operaciones_lineas SET descuento = 300 WHERE id = linea_v;
  SELECT * INTO r_op FROM public.operaciones WHERE id = venta;
  ASSERT r_op.monto_total = 0.00 AND r_op.esta_pago = true AND r_op.estado_pago = 'PAGADO',
    'operaciones (VENTA): 100% descuento debe dejar monto_total = 0 y esta_pago = true';

  -- --------------------------------------------------------------------------
  -- 5. OPERACIONES_COMPRA con precios_incluyen_iva = false y CARGOS
  -- --------------------------------------------------------------------------
  INSERT INTO public.operaciones(id, tenant_id, tipo, taller_id, monto_total)
    VALUES (compra, t, 'COMPRA', taller, 0);
  INSERT INTO public.operaciones_compra(operacion_id, tenant_id, precios_incluyen_iva)
    VALUES (compra, t, false);

  -- Línea neta: cantidad 2, unitario 500 => subtotal 1000, descuento 200 => total neto 800 (IVA 21% = 168)
  INSERT INTO public.operaciones_lineas(id, operacion_id, stock_id, cantidad, monto_unitario, sentido, descuento, iva_alicuota_id)
    VALUES (linea_c, compra, st, 2, 500, 1, 200, 5);

  -- Cargo (percepción): 50
  INSERT INTO public.operaciones_cargos(operacion_id, tenant_id, orden, tipo, percepcion_codigo, descripcion, importe)
    VALUES (compra, t, 1, 'PERCEPCION', 'IIBB_BUENOS_AIRES', 'Percepcion IIBB', 50);

  -- Cabecera compra: subtotal líneas = 1000, descuento líneas = 200, total líneas netas = 800
  -- IVA 21% sobre 800 = 168.00
  -- Cargos = 50.00
  -- monto_total = 800 + 168 + 50 = 1018.00
  SELECT * INTO r_op FROM public.operaciones WHERE id = compra;
  ASSERT r_op.subtotal = 1000.00 AND r_op.descuento = 200.00 AND r_op.monto_total = 1018.00,
    'operaciones (COMPRA con IVA y cargos): monto_total no coincide';

  -- --------------------------------------------------------------------------
  -- 6. OPERACIONES FINANCIERAS SIN LÍNEAS (ej. GASTO)
  -- --------------------------------------------------------------------------
  INSERT INTO public.operaciones(id, tenant_id, tipo, taller_id, monto_total)
    VALUES (gasto, t, 'GASTO', taller, 1500);
  INSERT INTO public.operaciones_gasto(operacion_id, tenant_id, categoria)
    VALUES (gasto, t, 'Servicios');

  SELECT * INTO r_op FROM public.operaciones WHERE id = gasto;
  ASSERT r_op.subtotal = 1500.00 AND r_op.descuento = 0.00 AND r_op.monto_total = 1500.00,
    'operaciones (GASTO): subtotal o descuento incorrecto para operacion sin lineas';

  -- --------------------------------------------------------------------------
  -- 7. BLOQUEO FISCAL: no permitir alterar subtotal ni descuento con factura activa
  -- --------------------------------------------------------------------------
  -- Crear venta facturada activa
  INSERT INTO public.facturas_electronicas (
    id, tenant_id, operacion_id, origen_tipo, idempotency_key, estado, ambiente,
    emisor_snapshot, receptor_snapshot, concepto, fecha_comprobante, total, punto_venta
  ) VALUES (
    factura, t, venta, 'VENTA', gen_random_uuid(), 'AUTORIZADA', 'HOMOLOGACION',
    jsonb_build_object('cuit', '20111111112'), '{}'::jsonb, 1, current_date, 200, 1
  );

  BEGIN
    UPDATE public.operaciones SET descuento = 50 WHERE id = venta;
    RAISE EXCEPTION 'descuento editable en venta con factura autorizada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%comprobante fiscal%' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.operaciones_lineas SET descuento = 0 WHERE id = linea_v;
    RAISE EXCEPTION 'descuento de linea editable en venta con factura autorizada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%comprobante fiscal%' THEN RAISE; END IF;
  END;

  -- --------------------------------------------------------------------------
  -- 8. REPUESTOS ASIGNADOS A ARREGLO CON DESCUENTO
  -- --------------------------------------------------------------------------
  -- Registrar categoría y empleado
  INSERT INTO public.categorias_arreglo(id, tenant_id, nombre)
    VALUES (cat, t, 'Frenos Test');
  INSERT INTO public.empleados(id, tenant_id, taller_id, nombre, apellido, dni)
    VALUES (emp, t, taller, 'Juan', 'Mecanico', 'DNI-DESC-01');

  -- Operación de asignación de repuesto al arreglo
  INSERT INTO public.operaciones(id, tenant_id, tipo, taller_id, monto_total)
    VALUES (asig, t, 'ASIGNACION_ARREGLO', taller, 0);
  INSERT INTO public.operaciones_asignacion_arreglo(operacion_id, tenant_id, arreglo_id)
    VALUES (asig, t, a);

  -- Asignar repuesto: cantidad 2, unitario 4000 => subtotal 8000, descuento 1000 => total 7000
  INSERT INTO public.operaciones_lineas(
    id, operacion_id, stock_id, cantidad, monto_unitario, sentido, descuento,
    categoria_arreglo_id, empleado_id
  ) VALUES (
    asig_linea, asig, st, 2, 4000, -1, 1000, cat, emp
  );

  SELECT * INTO r_lin FROM public.operaciones_lineas WHERE id = asig_linea;
  ASSERT r_lin.subtotal = 8000.00 AND r_lin.descuento = 1000.00 AND r_lin.total = 7000.00,
    'operaciones_lineas: repuesto asignado debe tener subtotal=8000, descuento=1000, total=7000';

  SELECT * INTO r_op FROM public.operaciones WHERE id = asig;
  ASSERT r_op.subtotal = 8000.00 AND r_op.descuento = 1000.00 AND r_op.monto_total = 7000.00,
    'operaciones (ASIGNACION_ARREGLO): cabecera debe reflejar subtotal=8000, descuento=1000, monto_total=7000';

  -- --------------------------------------------------------------------------
  -- 9. DASHBOARD: facturación por categoría y empleado con descuento
  -- --------------------------------------------------------------------------
  -- Crear un arreglo limpio para verificar dashboard sin interferencias previas
  DECLARE
    a_dash uuid := gen_random_uuid();
    d_dash uuid := gen_random_uuid();
    asig_dash uuid := gen_random_uuid();
    asig_lin_dash uuid := gen_random_uuid();
  BEGIN
    INSERT INTO public.arreglos(id, vehiculo_id, tenant_id, taller_id, fecha, precios_incluyen_iva, tasa_iva)
      VALUES (a_dash, v, t, taller, now(), true, 0.21);

    -- Mano de obra con descuento:
    -- cantidad 1, horas 2, precio 5000 => subtotal 10000, descuento 2000 => total 8000
    INSERT INTO public.detalle_arreglo(
      id, arreglo_id, tenant_id, descripcion, cantidad, horas_facturadas,
      precio_hora_facturada, descuento, categoria_arreglo_id, empleado_id
    ) VALUES (
      d_dash, a_dash, t, 'Servicio Frenos', 1, 2, 5000, 2000, cat, emp
    );

    -- Repuesto con descuento:
    -- cantidad 1, unitario 6000 => subtotal 6000, descuento 1500 => total 4500
    INSERT INTO public.operaciones(id, tenant_id, tipo, taller_id, monto_total)
      VALUES (asig_dash, t, 'ASIGNACION_ARREGLO', taller, 0);
    INSERT INTO public.operaciones_asignacion_arreglo(operacion_id, tenant_id, arreglo_id)
      VALUES (asig_dash, t, a_dash);
    INSERT INTO public.operaciones_lineas(
      id, operacion_id, stock_id, cantidad, monto_unitario, sentido, descuento,
      categoria_arreglo_id, empleado_id
    ) VALUES (
      asig_lin_dash, asig_dash, st, 1, 6000, -1, 1500, cat, emp
    );

    -- Verificar dashboard_facturacion_por_categoria:
    -- Total categoría 'Frenos Test' = 8000 (mano de obra) + 4500 (repuesto) = 12500 (NO el bruto 16000)
    SELECT * INTO r_dash FROM public.dashboard_facturacion_por_categoria(10)
    WHERE label = 'Frenos Test';

    ASSERT r_dash.monto = 12500.00,
      format('dashboard_facturacion_por_categoria debe ser 12500 (neto), se obtuvo %s', r_dash.monto);

    -- Verificar dashboard_facturacion_por_empleado:
    -- Total empleado 'Juan Mecanico' = 8000 + 4500 = 12500 (NO el bruto 16000)
    SELECT * INTO r_dash FROM public.dashboard_facturacion_por_empleado(10)
    WHERE label = 'Juan Mecanico';

    ASSERT r_dash.monto = 12500.00,
      format('dashboard_facturacion_por_empleado debe ser 12500 (neto), se obtuvo %s', r_dash.monto);
  END;

END;
$test$;

ROLLBACK;
