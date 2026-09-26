-- Separar Taller de la configuración fiscal. El backend anterior usa
-- configuracion:view para ARCA; ese permiso sigue siendo exclusivo de PRO.
insert into public.permissions (id, descripcion)
values ('configuracion:taller:view', 'Consulta y edición de datos del taller')
on conflict (id) do update set descripcion = excluded.descripcion;

insert into public.role_permissions (role, permission, granted)
values ('admin', 'configuracion:taller:view', true)
on conflict (role, permission) do update set granted = excluded.granted;

insert into public.plan_permissions (plan, permission, granted)
values
  ('BASE', 'configuracion:taller:view', true),
  ('PRO', 'configuracion:taller:view', true)
on conflict (plan, permission) do update set granted = excluded.granted;
