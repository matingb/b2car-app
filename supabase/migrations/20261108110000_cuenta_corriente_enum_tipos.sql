-- Migración previa: Nuevos valores en public.tipo_operacion para movimientos directos
-- de cuenta corriente (Proveedores y Clientes) vinculados a cuentas financieras.
-- Separado en migración previa para que PostgreSQL comitee los valores del enum
-- antes de compilar funciones LANGUAGE sql y validaciones de documentos.

ALTER TYPE public.tipo_operacion ADD VALUE IF NOT EXISTS 'PAGO_PROVEEDOR';
ALTER TYPE public.tipo_operacion ADD VALUE IF NOT EXISTS 'COBRO_PROVEEDOR';
ALTER TYPE public.tipo_operacion ADD VALUE IF NOT EXISTS 'COBRO_CLIENTE';
ALTER TYPE public.tipo_operacion ADD VALUE IF NOT EXISTS 'PAGO_CLIENTE';

