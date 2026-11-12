# Proposal

## Why

Al crear un arreglo con varios repuestos existentes que requieren compra, el helper comparte una sola clave de idempotencia: después de la primera compra pagada, la siguiente se interpreta como un reintento y no repone stock, por lo que falla la asignación y se revierte el alta. Esa clave también se usa para el cobro inicial, que puede omitirse al confundirse con el pago de una compra.

## What Changes

- Derivar una clave determinística por posición y stock del repuesto a partir de la clave recibida, con un prefijo propio de las compras automáticas.
- Reservar la clave original para el cobro inicial del arreglo; conservar `NULL` cuando el llamador no envía clave.
- Mantener una compra por faltante, las firmas actuales, los permisos y la transacción completa de creación.
- Agregar regresiones reales de PostgreSQL para compras múltiples, cobro inicial, stock, saldos y rollback.
- Excluir la idempotencia del alta completa del arreglo, las modificaciones de frontend y la reparación de datos históricos.

## Capabilities

### New Capabilities

- `arreglo-repuestos-compras`: compras automáticas de faltantes al crear arreglos y separación de sus claves respecto del cobro inicial. No existen specs principales registradas; esta capacidad documenta y corrige un comportamiento existente.

### Modified Capabilities

Ninguna.

## Impact

- Una migración nueva en `supabase/migrations/` reemplazará únicamente la variante de cinco argumentos de `_asignar_repuestos_existentes_a_arreglo`.
- Pruebas en `src/tests/integration/arreglos/crearArregloRepuestos.integration.test.ts`, usando los helpers existentes; complementar con un fixture SQL transaccional para comprobar el contrato de derivación y las llamadas sin clave.
- Sin cambios de contrato en `POST /api/arreglos`, `rpc_crear_arreglo_completo`, compra individual o cobro; sin extensiones nuevas ni edición de schemas declarativos.
- Diagnóstico basado en el checkout actual. La reproducción contra PostgreSQL queda pendiente de implementación en una base descartable: el setup de integración trunca y vuelve a sembrar datos antes de cada prueba.
