CREATE OR REPLACE FUNCTION public.rpc_listar_movimientos_cuenta (
  p_cuenta_id uuid,
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_limit     integer                  DEFAULT 100,
  p_offset    integer                  DEFAULT 0
)
  RETURNS TABLE (
    id                   uuid,
    cuenta_financiera_id uuid,
    importe              numeric,
    fecha                timestamp with time zone,
    created_at           timestamp with time zone,
    operacion_id         uuid,
    tipo                 text,
    descripcion          text,
    categoria_gasto      text,
    arreglo_id           uuid
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  SELECT
    m.id,
    m.cuenta_financiera_id,
    m.importe,
    m.fecha,
    m.created_at,
    m.operacion_id,
    COALESCE(o.tipo::text, 'MOVIMIENTO') AS tipo,
    CASE
      WHEN m.reversion_de_id IS NOT NULL THEN
        'Anulación — ' || COALESCE(d.base_descripcion, 'movimiento')
      ELSE
        d.base_descripcion
    END AS descripcion,
    og.categoria_gasto,
    COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id
  FROM public.movimientos_financieros AS m
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.id = m.omc_id
  LEFT JOIN public.operaciones AS o ON o.id = COALESCE(omc.operacion_id, m.operacion_id)
  LEFT JOIN public.operaciones_gasto AS og ON og.operacion_id = o.id
  LEFT JOIN public.operaciones_ingreso AS oi ON oi.operacion_id = o.id
  LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
  LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = o.id
  LEFT JOIN public.operaciones_compra AS oc ON oc.operacion_id = o.id
  LEFT JOIN public.operaciones_pago_proveedor AS opp ON opp.operacion_id = o.id
  LEFT JOIN public.operaciones_cobro_proveedor AS ocp ON ocp.operacion_id = o.id
  LEFT JOIN public.proveedores AS prov ON prov.id = COALESCE(oc.proveedor_id, opp.proveedor_id, ocp.proveedor_id)
  LEFT JOIN public.operaciones_cobro_cliente AS occ ON occ.operacion_id = o.id
  LEFT JOIN public.operaciones_pago_cliente AS opc ON opc.operacion_id = o.id
  LEFT JOIN public.operaciones_venta AS ov ON ov.operacion_id = o.id
  LEFT JOIN public.clientes AS cli ON cli.id = COALESCE(occ.cliente_id, opc.cliente_id, ov.cliente_id)
  LEFT JOIN public.empresas AS cli_emp ON cli_emp.id = cli.id
  LEFT JOIN public.particulares AS cli_part ON cli_part.id = cli.id
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN cli.tipo_cliente = 'empresa' THEN cli_emp.nombre
        WHEN cli.tipo_cliente = 'particular' THEN TRIM(concat(cli_part.nombre, ' ', COALESCE(cli_part.apellido, '')))
        ELSE NULL
      END AS cliente_nombre
  ) AS c_nom
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN prov.nombre IS NOT NULL THEN
          CASE
            WHEN NULLIF(btrim(omc.descripcion), '') IS NULL THEN
              CASE
                WHEN o.tipo = 'PAGO_PROVEEDOR'::public.tipo_operacion THEN 'Pago a ' || prov.nombre
                WHEN o.tipo = 'COBRO_PROVEEDOR'::public.tipo_operacion THEN 'Cobro de ' || prov.nombre
                WHEN o.tipo = 'COMPRA'::public.tipo_operacion THEN 'Pago de compra — ' || prov.nombre
                ELSE prov.nombre
              END
            WHEN btrim(omc.descripcion) = 'Pago a cuenta de proveedor' THEN
              'Pago a ' || prov.nombre
            WHEN btrim(omc.descripcion) = 'Cobro / reintegro de proveedor' THEN
              'Cobro de ' || prov.nombre
            WHEN POSITION(lower(prov.nombre) IN lower(btrim(omc.descripcion))) > 0 THEN
              btrim(omc.descripcion)
            WHEN o.tipo = 'PAGO_PROVEEDOR'::public.tipo_operacion THEN
              'Pago a ' || prov.nombre || ' — ' || btrim(omc.descripcion)
            WHEN o.tipo = 'COBRO_PROVEEDOR'::public.tipo_operacion THEN
              'Cobro de ' || prov.nombre || ' — ' || btrim(omc.descripcion)
            ELSE
              prov.nombre || ' — ' || btrim(omc.descripcion)
          END
        WHEN c_nom.cliente_nombre IS NOT NULL AND o.tipo IN ('COBRO_CLIENTE'::public.tipo_operacion, 'PAGO_CLIENTE'::public.tipo_operacion) THEN
          CASE
            WHEN NULLIF(btrim(omc.descripcion), '') IS NULL THEN
              CASE
                WHEN o.tipo = 'COBRO_CLIENTE'::public.tipo_operacion THEN 'Cobro de ' || c_nom.cliente_nombre
                ELSE 'Pago a ' || c_nom.cliente_nombre
              END
            WHEN btrim(omc.descripcion) IN ('Cobro a cuenta de cliente', 'Cobro de cliente') THEN
              'Cobro de ' || c_nom.cliente_nombre
            WHEN btrim(omc.descripcion) IN ('Pago / devolución a cliente', 'Pago a cliente') THEN
              'Pago a ' || c_nom.cliente_nombre
            WHEN POSITION(lower(c_nom.cliente_nombre) IN lower(btrim(omc.descripcion))) > 0 THEN
              btrim(omc.descripcion)
            WHEN o.tipo = 'COBRO_CLIENTE'::public.tipo_operacion THEN
              'Cobro de ' || c_nom.cliente_nombre || ' — ' || btrim(omc.descripcion)
            ELSE
              'Pago a ' || c_nom.cliente_nombre || ' — ' || btrim(omc.descripcion)
          END
        ELSE
          COALESCE(
            NULLIF(btrim(omc.descripcion), ''),
            NULLIF(btrim(og.descripcion), ''),
            NULLIF(btrim(oi.concepto), ''),
            CASE
              WHEN o.tipo = 'VENTA'::public.tipo_operacion THEN 'Cobro de venta'
              WHEN o.tipo = 'COMPRA'::public.tipo_operacion THEN 'Pago de compra'
              WHEN o.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN 'Cobro de arreglo'
              WHEN o.tipo = 'COBRO_CLIENTE'::public.tipo_operacion THEN 'Cobro de cliente'
              WHEN o.tipo = 'PAGO_CLIENTE'::public.tipo_operacion THEN 'Pago a cliente'
              WHEN o.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN 'Transferencia entre cuentas'
              WHEN o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN 'Apertura de cuenta'
              ELSE NULLIF(btrim(o.observaciones), '')
            END
          )
      END AS base_descripcion
  ) AS d
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to IS NULL OR m.fecha < p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

REVOKE ALL ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp with time zone, timestamp with time zone, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp with time zone, timestamp with time zone, integer, integer) TO authenticated, service_role, postgres;
