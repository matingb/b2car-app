CREATE FUNCTION public.rpc_borrar_operaciones_con_stock_lista (
  p_operacion_ids uuid[]
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
	v_operacion_id uuid;
begin
	if p_operacion_ids is null or array_length(p_operacion_ids, 1) is null then
		return;
	end if;

	foreach v_operacion_id in array p_operacion_ids loop
		perform rpc_borrar_operacion_con_stock(p_operacion_id := v_operacion_id);
	end loop;
end;
$function$;

REVOKE ALL ON FUNCTION public.rpc_borrar_operaciones_con_stock_lista(uuid[]) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_borrar_operaciones_con_stock_lista(uuid[]) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_borrar_operaciones_con_stock_lista(uuid[]) TO service_role;