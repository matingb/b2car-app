-- Solo lectura, después de aplicar toda la cadena. La consulta debe devolver 0 filas.
BEGIN READ ONLY;
SELECT 'saldo_financiero' AS problema, c.id
FROM public.cuentas_financieras c
WHERE c.saldo IS DISTINCT FROM (SELECT COALESCE(SUM(m.importe),0) FROM public.movimientos_financieros m WHERE m.cuenta_financiera_id=c.id)
UNION ALL
SELECT 'total_pagado', o.id FROM public.operaciones o
WHERE o.tipo IN ('COMPRA','VENTA','GASTO','AJUSTE_FINANCIERO')
  AND o.total_pagado IS DISTINCT FROM (SELECT COALESCE(ABS(SUM(m.importe)),0) FROM public.operaciones_movimiento_cuenta m WHERE m.operacion_id=o.id)
UNION ALL
SELECT 'omc_original_activo', c.id FROM public.operaciones_movimiento_cuenta c
WHERE (SELECT count(*) FROM public.movimientos_financieros m WHERE m.omc_id=c.id AND m.reversion_de_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.movimientos_financieros rev WHERE rev.reversion_de_id=m.id)) <> 1
  OR NOT EXISTS (SELECT 1 FROM public.movimientos_financieros m WHERE m.omc_id=c.id AND m.importe=c.importe
    AND m.cuenta_financiera_id=c.cuenta_id AND m.reversion_de_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.movimientos_financieros rev WHERE rev.reversion_de_id=m.id))
UNION ALL
SELECT 'cantidad_cumplida', l.id FROM public.operaciones_lineas l
WHERE l.cantidad_cumplida IS DISTINCT FROM (SELECT COALESCE(SUM(l.sentido*m.cantidad),0)::integer FROM public.operaciones_movimiento_stock m WHERE m.operacion_linea_id=l.id)
UNION ALL
SELECT 'reservas', s.id FROM public.stocks s
WHERE s.cantidad_reservada IS DISTINCT FROM (SELECT COALESCE(SUM(l.cantidad-l.cantidad_cumplida-l.cantidad_cancelada),0)::integer
  FROM public.operaciones_lineas l JOIN public.operaciones o ON o.id=l.operacion_id WHERE l.stock_id=s.id AND o.tipo='VENTA')
  OR s.cantidad_pendiente IS DISTINCT FROM (SELECT COALESCE(SUM(l.cantidad-l.cantidad_cumplida-l.cantidad_cancelada),0)::integer
  FROM public.operaciones_lineas l JOIN public.operaciones o ON o.id=l.operacion_id WHERE l.stock_id=s.id AND o.tipo='COMPRA')
UNION ALL
SELECT 'saldo_stock', s.id FROM public.stocks s
WHERE s.cantidad IS DISTINCT FROM COALESCE((SELECT m.saldo_posterior FROM public.movimientos_stock m WHERE m.stock_id=s.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1),0)
UNION ALL
SELECT 'tipo_obsoleto', o.id FROM public.operaciones o WHERE o.tipo='MOVIMIENTO_CUENTA';

-- Valida hija única, referencias del tenant/taller y coherencia instantánea de TODOS los documentos.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.operaciones LOOP PERFORM public._operacion_validar_documento_id(r.id); END LOOP;
END $$;
ROLLBACK;
