-- ============================================================================
-- Permisos de Cuenta Corriente: Clientes y Proveedores (Cobros y Pagos Directos)
-- ============================================================================

-- 1. Catálogo de permisos
INSERT INTO public.permissions (id, descripcion) VALUES
  ('clientes:finanzas:edit', 'Registro de movimientos directos en cuenta corriente de clientes (cobros y pagos)'),
  ('proveedores:finanzas:edit', 'Registro de movimientos directos en cuenta corriente de proveedores (pagos y cobros)')
ON CONFLICT (id) DO UPDATE SET descripcion = excluded.descripcion;

-- 2. Asignación a roles (solo admin gestiona cobros y pagos de cuenta corriente)
INSERT INTO public.role_permissions (role, permission, granted) VALUES
  ('admin', 'clientes:finanzas:edit', true),
  ('admin', 'proveedores:finanzas:edit', true)
ON CONFLICT (role, permission) DO UPDATE SET granted = excluded.granted;

-- 3. Asignación a planes de suscripción (BASE y PRO)
INSERT INTO public.plan_permissions (plan, permission, granted) VALUES
  ('BASE', 'clientes:finanzas:edit', true),
  ('PRO', 'clientes:finanzas:edit', true),
  ('BASE', 'proveedores:finanzas:edit', true),
  ('PRO', 'proveedores:finanzas:edit', true)
ON CONFLICT (plan, permission) DO UPDATE SET granted = excluded.granted;

