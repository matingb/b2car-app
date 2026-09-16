-- Restricción de valores permitidos para roles de miembros del tenant.
-- 'admin': Acceso total administrativo y financiero.
-- 'operativo': Gestión de taller y arreglos sin acceso financiero ni de configuración.
ALTER TABLE public.tenant_members
  DROP CONSTRAINT IF EXISTS tenant_members_rol_check;

ALTER TABLE public.tenant_members
  ADD CONSTRAINT tenant_members_rol_check
  CHECK (rol IN ('admin', 'operativo'));
