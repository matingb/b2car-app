CREATE FUNCTION public.delete_particular (
  particular_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  AS $function$
BEGIN
  -- Eliminar de la tabla particulares
  DELETE FROM particulares WHERE id = particular_id;
  
  -- Eliminar de la tabla clientes
  DELETE FROM clientes WHERE id = particular_id;
END;
$function$;

GRANT ALL ON FUNCTION public.delete_particular(uuid) TO anon;

GRANT ALL ON FUNCTION public.delete_particular(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.delete_particular(uuid) TO service_role;