-- v1.5.5 - RPCs para borrar operaciones con reversa de stock

-- RPC: revierte una línea de operación (aplica delta inverso) y la elimina
CREATE OR REPLACE FUNCTION public.rpc_revertir_operacion_linea(
	p_operacion_linea_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
	v_tenant_id uuid;
	v_operacion_id uuid;
	v_stock_id uuid;
	v_delta int;
	v_reverse int;
	v_rowcount int;
BEGIN
	v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
	IF v_tenant_id IS NULL THEN
		RAISE EXCEPTION 'JWT sin tenant_id';
	END IF;

	IF p_operacion_linea_id IS NULL THEN
		RAISE EXCEPTION 'operacion_linea_id requerido';
	END IF;

	SELECT l.operacion_id, l.stock_id, l.delta_cantidad
	INTO v_operacion_id, v_stock_id, v_delta
	FROM public.operaciones_lineas l
	JOIN public.operaciones o ON o.id = l.operacion_id
	WHERE l.id = p_operacion_linea_id
		AND o.tenant_id = v_tenant_id;

	IF v_operacion_id IS NULL THEN
		RAISE EXCEPTION 'línea no encontrada (%)', p_operacion_linea_id;
	END IF;

	IF v_delta IS NULL OR v_delta = 0 THEN
		RAISE EXCEPTION 'delta inválido para línea %', p_operacion_linea_id;
	END IF;

	-- Lock del stock involucrado
	PERFORM 1
	FROM public.stocks s
	WHERE s.id = v_stock_id
	FOR UPDATE;

	v_reverse := -v_delta;

	IF v_reverse < 0 THEN
		UPDATE public.stocks s
		SET cantidad = s.cantidad + v_reverse,
				updated_at = now()
		WHERE s.id = v_stock_id
			AND s.cantidad >= (-v_reverse);

		GET DIAGNOSTICS v_rowcount = ROW_COUNT;
		IF v_rowcount = 0 THEN
			RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id
			USING ERRCODE = 'P0001';
		END IF;
	ELSE
		UPDATE public.stocks s
		SET cantidad = s.cantidad + v_reverse,
				updated_at = now()
		WHERE s.id = v_stock_id;

		GET DIAGNOSTICS v_rowcount = ROW_COUNT;
		IF v_rowcount = 0 THEN
			RAISE EXCEPTION 'stock no encontrado (%)', v_stock_id;
		END IF;
	END IF;

	DELETE FROM public.operaciones_lineas
	WHERE id = p_operacion_linea_id;

	RETURN v_operacion_id;
END;
$$;

-- RPC: borra una operación completa y revierte su impacto en stock
CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock(
	p_operacion_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
	v_tenant_id uuid;
	v_op_id uuid;

	l record;
BEGIN
	v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
	IF v_tenant_id IS NULL THEN
		RAISE EXCEPTION 'JWT sin tenant_id';
	END IF;

	IF p_operacion_id IS NULL THEN
		RAISE EXCEPTION 'operacion_id requerido';
	END IF;

	SELECT o.id
	INTO v_op_id
	FROM public.operaciones o
	WHERE o.id = p_operacion_id
		AND o.tenant_id = v_tenant_id;

	IF v_op_id IS NULL THEN
		RAISE EXCEPTION 'operación no encontrada (%)', p_operacion_id;
	END IF;

	-- Revertir cada línea y borrarla
	FOR l IN
		SELECT id, stock_id, delta_cantidad
		FROM public.operaciones_lineas
		WHERE operacion_id = v_op_id
	LOOP
		PERFORM public.rpc_revertir_operacion_linea(l.id);
	END LOOP;

	DELETE FROM public.operaciones o WHERE o.id = v_op_id;

	RETURN v_op_id;
END;
$$;
