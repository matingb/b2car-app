# Proposal

## Why

Hoy una operación mueve plata y mercadería por caminos distintos según quién la escribe:

- Los pagos viven en `operaciones_pagos` y cada RPC escribe a mano el ledger financiero.
- Los movimientos de cuenta (gastos manuales, ingresos, transferencias, aperturas y cobros de arreglo) son todos `MOVIMIENTO_CUENTA` y se distinguen por un `subtipo` de OMC.
- El kardex de stock lo escriben solo algunas RPCs. Las asignaciones a arreglos, la NC, el alta inline y la edición manual de stock no dejan rastro, y `stocks.cantidad` se actualiza a mano desde RPCs y desde la app.

El resultado:

- saldos e inventario que no se pueden reconstruir desde sus ledgers;
- estados derivados (`total_pagado`, `cantidad_cumplida`, reservada/pendiente) que cada RPC mantiene por su cuenta;
- listados que tienen que cruzar con OMC para inventar el tipo de una operación.

Este cambio llega ahora porque hay 23 migraciones de dev que todavía no llegaron a producción y van en esta misma dirección. Conviene fijar el modelo destino antes del próximo despliegue.

## What Changes

- **Operación = documento con tabla hija por tipo.** Todo tipo de operación tiene su tabla hija 1:1 con los datos propios del tipo.
  - Nuevos tipos reales: `INGRESO`, `APERTURA_CUENTA` y `COBRO_ARREGLO`.
  - `TRANSFERENCIA` pasa a usarse.
  - **BREAKING:** `MOVIMIENTO_CUENTA` deja de usarse.
  - Nuevas tablas hijas: `operaciones_ingreso`, `operaciones_transferencia`, `operaciones_apertura_cuenta` y `operaciones_ajuste`.
- **Impacto financiero solo vía OMC.**
  - `operaciones_movimiento_cuenta` pasa a ser 1:N con la operación, con PK y fecha propias, y es el único camino hacia `movimientos_financieros`, por trigger.
  - **BREAKING:** OMC pierde `subtipo`, `cuenta_origen_id`, `cuenta_destino_id` y `categoria_gasto`. Una OMC equivale a un asiento.
  - **BREAKING:** se elimina `operaciones_pagos`. Todo pago o cobro de compra, venta o gasto es una OMC del documento.
- **Impacto de stock solo vía OMS.**
  - Nueva tabla `operaciones_movimiento_stock` (N por línea). Es el único camino hacia `movimientos_stock`, por trigger, y el kardex es el único escritor de `stocks.cantidad`.
  - El stock inicial y la edición manual de cantidad generan una operación `AJUSTE`.
  - Las asignaciones a arreglos, la NC y el alta inline de productos aparecen en el kardex.
- **Derivados por trigger:** `total_pagado`, `estado_pago`, `cantidad_cumplida`, `estado_stock`, `cantidad_reservada` y `cantidad_pendiente` dejan de mantenerse a mano.
- **Ledgers trazables:** cada asiento y cada fila del kardex guarda su hecho de origen (`omc_id` / `oms_id`) y lo que revierte (`reversion_de_id`). `operacion_id` queda como referencia histórica sin FK. Se mantiene el borrado físico de operaciones.
- **BREAKING:** editar una operación (`PUT /api/operaciones/[id]`) solo cambia `fecha` y `observaciones`. Para corregir ítems se borra la operación y se carga de nuevo.
- **BREAKING:** `/api/gastos` deja de aceptar `arregloId`. Los gastos eventuales no se relacionan con arreglos.
- **Correcciones de comportamiento:**
  - se puede cobrar o pagar una venta facturada;
  - el dashboard de gastos deja de contar dos veces los pagos de compras;
  - la NC devuelve físicamente solo lo entregado y libera la reserva de lo no entregado;
  - la facturación de una venta no depende de que se haya entregado.

## Capabilities

### New Capabilities

- `operaciones`: el documento de operación. Cubre tipos, tabla hija por tipo, lo pactado, estados derivados, listado y filtros por tipo, edición y borrado.
- `operaciones-impacto-financiero`: cómo una operación mueve plata. Cubre las OMC como única vía al ledger financiero, pagos y cobros diferidos, anulación y edición de pagos, reversas trazables, coherencia de los tipos instantáneos y neutralidad de transferencias y aperturas en los totales.
- `operaciones-impacto-stock`: cómo una operación mueve mercadería. Cubre las OMS como única vía al kardex, `stocks.cantidad` derivada del kardex, entregas y recepciones parciales, reversión, ajustes, asignaciones a arreglos, devolución por NC y facturación independiente de la entrega.

### Modified Capabilities

Ninguna: el proyecto todavía no tiene specs principales.

## Impact

- **Base de datos.**
  - Migraciones nuevas para el esquema, los triggers, el backfill y las RPCs.
  - Corren en producción **después** de las 23 migraciones pendientes, incluida `20261029110500`, que llena `operaciones_pagos` con los pagos históricos. Por eso el backfill hacia OMC hace falta aunque `operaciones_pagos` nunca haya estado en producción.
  - Se reescriben o eliminan unas 40 funciones: pagos, alta y borrado de operaciones, stock, movimientos de cuenta, listados, estadísticas, dashboards, cuenta corriente, guards de facturación y `eliminar_tenant`.
  - Hay que reescribir `supabase/seed.sql`.
- **API.**
  - Rutas de `operaciones`: detalle, pagos, stock y edición.
  - Rutas de `stocks` (POST y PUT pasan a generar ajustes).
  - Rutas de `gastos`, `cuentas-financieras/ingresos` y `cuentas-financieras/transferencias`.
  - Facturación: lectura de `delta_cantidad`.
- **Frontend.**
  - Tipos `pagos` en el modelo y el cliente.
  - Detalle de operación (pagos y reversión de movimientos).
  - Filtros por tipo del listado de operaciones.
  - Texto de ajuste al editar la cantidad de un stock.
- **Tests.** Integración de operaciones, finanzas, cuenta corriente, arreglos, stock y dashboard. Los tests de finanzas agregados el 31/10 asumen `operaciones_pagos`.
- **Fuera de alcance:**
  - anulación lógica de operaciones;
  - pagos que imputan varias operaciones y anticipos;
  - unificar el cobro de arreglo con una operación madre;
  - idempotencia de `rpc_crear_operacion_con_stock`;
  - borrado de stocks y productos con historial;
  - vincular remitos con OMS;
  - datos adicionales en las tablas hijas de ingreso y transferencia.
