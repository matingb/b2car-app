-- El trigger de asignación debe poder consultar la guarda privada de B2C-152.
-- Ejecutarlo como su dueño evita conceder EXECUTE de esa guarda a authenticated.
alter function public._b2c152_guardar_asignacion() security definer;
alter function public._b2c152_guardar_asignacion()
  set search_path = pg_catalog, public;
