-- Migración A: Nuevos tipos reales en tipo_operacion
ALTER TYPE tipo_operacion ADD VALUE IF NOT EXISTS 'INGRESO';
ALTER TYPE tipo_operacion ADD VALUE IF NOT EXISTS 'APERTURA_CUENTA';
ALTER TYPE tipo_operacion ADD VALUE IF NOT EXISTS 'COBRO_ARREGLO';

