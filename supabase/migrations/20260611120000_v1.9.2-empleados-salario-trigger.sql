-- v1.9.2 - Elimina el trigger que creaba automáticamente el registro inicial de salario.
-- El trigger usaba fecha_ingreso (o el primer día del mes actual) como vigente_desde,
-- ignorando la fecha que el usuario ingresa en el campo "Vigente desde" del formulario.
-- La API ahora maneja el registro inicial llamando a recordSalarioChange con la fecha correcta.

DROP TRIGGER IF EXISTS empleados_initial_salario ON public.empleados;
DROP FUNCTION IF EXISTS public.empleados_register_initial_salario();
