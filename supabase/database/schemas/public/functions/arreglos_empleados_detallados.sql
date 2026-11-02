CREATE FUNCTION public.arreglos_empleados_detallados (
  a public.arreglos
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  AS $function$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', e.id, 'nombre', e.nombre, 'apellido', e.apellido)
    ), '[]'::jsonb
  )
  FROM unnest(a.empleados) AS emp_id
  JOIN public.empleados e ON e.id = emp_id;
$function$;

GRANT ALL ON FUNCTION public.arreglos_empleados_detallados(public.arreglos) TO anon;

GRANT ALL ON FUNCTION public.arreglos_empleados_detallados(public.arreglos) TO authenticated;

GRANT ALL ON FUNCTION public.arreglos_empleados_detallados(public.arreglos) TO service_role;