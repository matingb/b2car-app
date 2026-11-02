CREATE FUNCTION public.delete_empresa (
  empresa_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  AS $function$
BEGIN
  -- Eliminar de la tabla empresas
  DELETE FROM empresas WHERE id = empresa_id;
  
  -- Eliminar de la tabla clientes
  DELETE FROM clientes WHERE id = empresa_id;
END;
$function$;

GRANT ALL ON FUNCTION public.delete_empresa(uuid) TO anon;

GRANT ALL ON FUNCTION public.delete_empresa(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.delete_empresa(uuid) TO service_role;