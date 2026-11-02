# Tasks

Las migraciones siguen el orden de `design.md`, sección Migration Plan:
- **A:** enum;
- **B:** finanzas y documentos;
- **C:** stock;
- **D:** cierre.

Como nada de esto se desplegó todavía, las migraciones B, C y D se pueden seguir editando hasta la entrega.

En todo lo que sigue, "test de integración" significa un test en `src/tests/integration/` que corre con `npm run test:integration` contra la base local.

## 1. Preparación

- [x] 1.1 Acordar con matias que los pagos convergen en OMC y que `operaciones_pagos` se elimina, revirtiendo la dirección de `20261029223000`. Verificación: el acuerdo queda anotado en la sección Context de `design.md`.
- [x] 1.2 Escribir `.codex-work/rediseno-operaciones-ledgers/diagnostico.sql` con una consulta por invariante y correrlo sobre la base local actual para registrar el punto de partida. Verificación: el script corre y el resultado queda anotado en `.codex-work/rediseno-operaciones-ledgers/IMPLEMENTATION_NOTES.md`. Las consultas cubren:
  - saldo de cuenta igual a la suma del ledger;
  - `total_pagado` igual a la suma de OMC;
  - asientos y filas del kardex sin hecho de origen;
  - kardex encadenado y último saldo igual a `stocks.cantidad`;
  - cantidad cumplida igual a la suma de OMS;
  - reservada y pendiente según su fórmula;
  - toda operación con su tabla hija;
  - coherencia de las operaciones instantáneas;
  - cero operaciones `MOVIMIENTO_CUENTA`.
- [x] 1.3 Confirmar que todas las funciones que escriben `operaciones`, sus hijas, líneas, OMC y ledgers son `SECURITY DEFINER`, partiendo de la tabla de ubicaciones de `design.md`. Verificación: la lista queda en `IMPLEMENTATION_NOTES.md`, con las excepciones marcadas para corregir en el grupo 10.
- [x] 1.4 Preparar una base local con el estado previo al rediseño para probar los backfills: migraciones actuales + seed actual. Las migraciones nuevas se aplican después con `npx supabase migration up`. Verificación: el procedimiento queda documentado en `IMPLEMENTATION_NOTES.md` y se puede repetir.

## 2. Tipos reales y tablas hijas

- [x] 2.1 Migración A: agregar `INGRESO`, `APERTURA_CUENTA` y `COBRO_ARREGLO` a `tipo_operacion`, en una migración propia. Verificación: `npx supabase db reset` termina sin errores.
- [x] 2.2 Migración B: crear `operaciones_ingreso`, `operaciones_transferencia` (con `CHECK` de que origen y destino sean distintos), `operaciones_apertura_cuenta` y `operaciones_ajuste` (`motivo` con `CHECK`), con RLS, policy de SELECT por tenant y grants explícitos. Verificación: test de integración que comprueba que un tenant no ve las filas de otro.
- [x] 2.3 Migración B: agregar `tenant_id` y `created_at` a `operaciones_asignacion_arreglo` (con backfill desde `operaciones`), mover el `CHECK` de categorías a `operaciones_gasto` y cambiar `operaciones_taller_requerido` para que exija taller solo en COMPRA, VENTA, ASIGNACION_ARREGLO y AJUSTE. Verificación: test de integración de que un gasto sin taller se crea y una compra sin taller se rechaza.

## 3. Pagos vía OMC y ledger financiero por trigger

- [x] 3.1 Migración B: darle a OMC PK propia `id`, `fecha` y su índice por `operacion_id`. En `movimientos_financieros`: agregar `omc_id` y `reversion_de_id` y borrar la FK de `operacion_id`. Verificación: `db reset` sin errores.
- [x] 3.2 Migración B: trigger `_omc_validar`, que completa la fecha, valida el tenant, aplica la regla de signo por tipo y rechaza OMC en ASIGNACION_ARREGLO y AJUSTE con `22023`. Verificación: tests de integración del requirement "Signo del impacto según el tipo de operación".
- [x] 3.3 Migración B:
  - nueva firma de `_ledger_insertar`;
  - reescribir `_omc_after_insert/update/delete`: un asiento por OMC; contraasiento con `reversion_de_id`, `omc_id` y el `operacion_id` conservado; en un UPDATE, contraasiento más asiento nuevo;
  - `DROP` de `_finanzas_insertar_movimiento` y `_finanzas_reversar_movimiento`.
  Verificación: tests de integración de los requirements "Impactos financieros como única vía al ledger", "Anulación de un pago" y "Corrección de un impacto financiero".
- [x] 3.4 Migración B: trigger `_omc_sync_total_pagado` y `DROP` de `trg_sync_operacion_total_pagado` y `_sync_operacion_total_pagado`. Verificación: test de integración "Del pago parcial al pago total".
- [x] 3.5 Migración B: reescribir para que inserten OMC, sin escritura directa del ledger, sin `operaciones_pagos` y sin UPDATE manual de `total_pagado`:
  - `rpc_registrar_pago_operacion` (idempotencia en OMC, `pago_id` = `omc.id`);
  - `rpc_finanzas_anular_pago_operacion` (DELETE de la OMC);
  - los pagos iniciales de `rpc_crear_operacion_con_stock` y `rpc_crear_operacion_gasto`.
  Verificación: tests de integración "Compra pagada en cuatro partes", "Pago mayor al saldo" y "Reintento de un pago".
- [x] 3.6 Migración B: lista blanca de columnas derivadas en `facturacion_bloquear_mutacion_operacion_facturada`, `facturacion_bloquear_mutacion_arreglo` y `facturacion_bloquear_mutacion_devolucion_nc` (decisión 11 de `design.md`). Verificación: tests de integración "Cobrar una venta facturada" y "Anular el cobro de una venta facturada", más un test de que cambiar `monto_total` de una venta facturada sigue rechazado.
- [x] 3.7 Backend y frontend:
  - en `operacionRepository.ts`, cambiar el embed `operaciones_pagos` por `pagos` desde OMC;
  - mapear `pagos` en `operaciones/route.ts` y `operaciones/[id]/route.ts`;
  - actualizar `src/model/types.ts`, `src/model/dtos.ts` y `src/clients/operacionesClient.ts`;
  - listar y anular pagos por `pago.id` en `operaciones/[id]/page.tsx`.
  Verificación: tests unitarios del repositorio, del servicio y de la página actualizados y pasando; `npx tsc --noEmit` sin errores.

## 4. Movimientos de cuenta como documentos

- [x] 4.1 Migración B: reescribir `rpc_crear_movimiento_cuenta` (sin `p_arreglo_id`) para que cree el tipo real con su hija y sus OMC: GASTO comparte helper con `rpc_crear_operacion_gasto`; INGRESO lleva 1 OMC; TRANSFERENCIA lleva 2. Verificación: test de integración "Transferencia entre cuentas", más tests de alta de gasto eventual y de ingreso.
- [x] 4.2 Migración B: reescribir `rpc_actualizar_movimiento_cuenta` y `rpc_eliminar_movimiento_cuenta` según la decisión 6 de `design.md`: tipos permitidos, gasto de contado y rechazo de `COBRO_ARREGLO`. Verificación: tests de integración "Corregir el monto de un ingreso", "Corregir un gasto con pagos parciales" y "Editar un cobro de arreglo como movimiento manual".
- [x] 4.3 Migración B: `_crear_apertura_cuenta` crea `APERTURA_CUENTA` con su hija, y `rpc_finanzas_cobrar_arreglo` crea `COBRO_ARREGLO`. Revisar que `rpc_finanzas_anular_cobro_arreglo` y `rpc_get_arreglo_detalle` no dependan de `MOVIMIENTO_CUENTA` ni de `subtipo`. Verificación: los tests de `finanzas/*` y `arreglos/*` sobre cobros y aperturas pasan.
- [x] 4.4 Migración B: constraint trigger diferido de coherencia para las operaciones instantáneas, disparado desde `operaciones`, OMC y las hijas, que no hace nada si la operación ya no existe. Verificación: test de integración "Transferencia incoherente", que inserta OMC inválidas con el service role y espera que falle el commit.
- [x] 4.5 API: quitar `arregloId` de `POST /api/gastos` y de su validación. Verificación: test de la ruta de gastos actualizado; `npx tsc --noEmit` sin errores.

## 5. Backfill financiero y baja de `operaciones_pagos`

- [x] 5.1 Migración B: backfill de los pasos 1 a 3 de la decisión 15 de `design.md`:
  - `id` y `fecha` de OMC;
  - vínculo de los asientos con su OMC;
  - `MOVIMIENTO_CUENTA` → tipo real con su hija;
  - transferencias partidas en 2 OMC y cada asiento vinculado con la OMC de su cuenta;
  - `GASTO` sin hija.
  Verificación: sobre la base del 1.4 con `migration up`, el diagnóstico no informa operaciones `MOVIMIENTO_CUENTA` ni operaciones sin hija.
- [x] 5.2 Migración B: backfill de los pasos 4 a 6:
  - `operaciones_pagos` → OMC, sin duplicar los gastos históricos;
  - emparejamiento de asientos con `row_number()`;
  - `RAISE NOTICE` con los asientos sin emparejar;
  - recálculo de `total_pagado` con `RAISE EXCEPTION` si algo difiere.
  Verificación: sobre la base del 1.4, la migración termina y el diagnóstico de saldo y `total_pagado` no devuelve filas.
- [x] 5.3 Migración B: `DROP` de `operaciones_pagos` con su trigger y sus funciones, y de las columnas `subtipo`, `cuenta_origen_id`, `cuenta_destino_id` y `categoria_gasto` de OMC con sus `CHECK`. Verificación: `grep` sin apariciones de `operaciones_pagos` en las funciones vigentes ni en `src/`, salvo migraciones viejas.
- [x] 5.4 Ajustar `supabase/seed.sql`: OMC sin `subtipo`, movimientos de cuenta con tipo real e hija, y pagos de documentos como OMC. Verificación: `npx supabase db reset` termina y el diagnóstico financiero no devuelve filas.
- [x] 5.5 Ajustar los tests de integración que asumen `operaciones_pagos`: `finanzasMultiplesCuentas`, `clienteCuentaCorriente`, `proveedorCuentaCorriente` y los demás de `finanzas/*`, junto con `operacionRepository.test.ts` y `operacionesService.test.ts`. Verificación: `npm run test:integration` pasa en esas suites.

## 6. Lectores financieros y listado

- [x] 6.1 Migración B: reescribir `rpc_listar_operaciones_con_gastos` con `tipo = o.tipo`, `LEFT JOIN` 1:1 a las hijas sin OMC, y cuentas de transferencia e ingreso en la salida. Verificación: tests de integración "Compra con varios pagos", "Filtrar transferencias" e "Ingresos en el listado".
- [x] 6.2 Migración B: reescribir `rpc_operaciones_stats`, `dashboard_gastos_por_periodo` y `dashboard_gastos_por_dia` (decisión 14 de `design.md`). Verificación: tests de integración "Transferencia en las estadísticas", "Gasto pagado al crearlo" y "Pago de una compra", más que pasen las suites `dashboard/*`.
- [x] 6.3 Migración B: reescribir `rpc_listar_movimientos_cuenta` (unión por `omc_id`), `rpc_cliente_cuenta_corriente` y la cuenta corriente de proveedores sobre OMC. Verificación: test de integración "Venta cobrada en dos partes", más que pasen las suites de cuenta corriente y `cuentaFinancieraMovimientos`.
- [x] 6.4 Frontend: en `src/model/types.ts` y `src/model/finanzas.ts`, quitar `MOVIMIENTO_CUENTA` y `subtipo` donde corresponda y agregar `TRANSFERENCIA`, `INGRESO` y `APERTURA_CUENTA` a los filtros del listado de operaciones. Verificación: test de la página de operaciones de que cada tipo es filtrable; `npx tsc --noEmit` sin errores.

## 7. Stock: OMS, kardex y derivados

- [x] 7.1 Migración C: esquema de stock:
  - `operaciones_lineas.sentido`, `cantidad_cancelada` y sus `CHECK`;
  - índice de líneas abiertas;
  - tabla `operaciones_movimiento_stock` con RLS solo de SELECT, grants e índices;
  - `movimientos_stock.oms_id` y `DROP` de sus FK a operaciones y detalle de arreglo.
  Verificación: `db reset` sin errores.
- [x] 7.2 Migración C: triggers `_stock_aplicar_movimiento`, `_stocks_proteger_saldos`, `_oms_validar`, `_oms_after_insert`, `_oms_after_delete`, OMS `BEFORE UPDATE` y `_lineas_recalcular_stock`, y acotar `trigger_recalcular_precio_operaciones_lineas`. Verificación: tests de integración de los requirements "Kardex encadenado y sin saldos negativos", "Sentido y cantidad cumplida de cada línea", "Cantidades reservada y pendiente derivadas" e "Impactos de stock no editables".
- [x] 7.3 Migración C: reescribir `rpc_crear_operacion_con_stock`, `rpc_confirmar_stock_operacion` y `rpc_revertir_movimiento_stock_operacion` sobre líneas + OMS, insertando ordenado por `stock_id`, y hacer `DROP` de `rpc_revertir_operacion_linea` y `_stock_ledger_insertar`. Verificación: tests de integración "Compra recibida en dos partes", "Venta diferida reserva stock", "Revertir una entrega parcial" y "Revertir un movimiento histórico", más que pase `operacionesParciales`.
- [x] 7.4 Migración C: reescribir `rpc_set_asignacion_arreglo_linea` y `rpc_delete_asignacion_arreglo_linea` (OMS por diferencia; al bajar la cantidad, primero la devolución). Revisar `rpc_asignar_repuesto_existente_con_compra` y `rpc_crear_producto_inline_para_arreglo`. Verificación: test de integración "Asignar y luego reducir", más que pasen las suites `arreglos/*`.
- [x] 7.5 Migración C:
  - nuevas `rpc_crear_stock` y `rpc_ajustar_stock`;
  - `_crear_producto_y_stock` crea el stock en 0 más un AJUSTE `INICIAL`;
  - `eliminar_tenant` borra las OMS antes que las líneas.
  Verificación: tests de integración "Corregir la cantidad de un stock" y "Alta de stock con cantidad".
- [x] 7.6 Migración C: `delta_cantidad` como columna generada `sentido * cantidad` (decisión 10 de `design.md`). Las RPCs dejan de escribirla y el backfill informa con `RAISE NOTICE` cuántas líneas cambian. Verificación: tests de integración "Facturar una venta no entregada" y "Facturar una venta entregada en parte".
- [x] 7.7 Migración C: backfill de stock según la decisión 15 de `design.md`: `sentido`, `operaciones_ajuste`, OMS por lo cumplido con vínculo de las filas del kardex, conciliación y recálculo de reservada y pendiente. Verificación: sobre la base del 1.4 con `migration up`, el diagnóstico de stock no devuelve filas.
- [x] 7.8 Ajustar `supabase/seed.sql`: stocks en 0 más AJUSTE `INICIAL`, `sentido` en cada línea y OMS por lo cumplido. Verificación: `npx supabase db reset` termina y el diagnóstico completo no devuelve filas.
- [x] 7.9 Backend: `POST /api/stocks` usa `rpc_crear_stock`; `PUT /api/stocks/[id]` con `cantidad` usa `rpc_ajustar_stock` (mínimo y máximo siguen con UPDATE); revisar `productosService.updateWithStocksById`; `operacionRepository.ts` consulta `movimientos_stock` aparte en lugar del embed por FK. Verificación: tests de las rutas de stock y del repositorio actualizados y pasando, más el test de integración "Editar el stock mínimo".
- [x] 7.10 Frontend: ocultar "revertir" en los movimientos con `oms_id` nulo (`useRevertirMovimientoStock`, `OperacionExpandedDetail`) y avisar en la pantalla de stock que editar la cantidad registra un ajuste. Verificación: tests de los componentes actualizados.

## 8. Nota de crédito

- [x] 8.1 Migración C: reescribir `rpc_facturacion_finalizar_nc` según la decisión 9 de `design.md`:
  - primero cancela lo no entregado (`cantidad_cancelada`);
  - valida que la devolución física no supere lo entregado neto de devoluciones anteriores;
  - crea el AJUSTE `DEVOLUCION_NC` con sus líneas y OMS antes de vincular `operacion_ajuste_id`.
  Verificación: tests de integración "NC total sobre una venta entregada en parte" y "Devolver más de lo entregado", más que pasen los tests de NC existentes.

## 9. Edición y borrado de operaciones

- [x] 9.1 Migración C: reemplazar `rpc_actualizar_operacion_con_stock` por `rpc_actualizar_operacion(p_operacion_id, p_fecha, p_observaciones)`. En los tipos instantáneos actualiza también la fecha de las OMC. Verificación: tests de integración "Cambiar la fecha de una compra diferida" y "Editar una venta facturada".
- [x] 9.2 Backend: `PUT /api/operaciones/[id]` acepta solo `fecha` y `observaciones` (otra clave da 400), `operacionesService.update` usa la RPC nueva y se elimina `findCuentaFinancieraByOperacionId`. También se ajusta `UpdateOperacionInput`. Verificación: tests de la ruta y del servicio, incluido "Intentar editar las líneas".
- [x] 9.3 Migración C: simplificar `rpc_borrar_operacion_con_stock` a un `DELETE` de la operación con bloqueo previo, sin bucles ni flags de cleanup. Verificación: tests de integración "Borrar una compra pagada y recibida", "Borrar una operación con pagos", "Borrar una compra recibida", "Borrar una compra ya consumida" y "Borrar una venta facturada".

## 10. Cierre de esquema y permisos

- [x] 10.1 Migración D: extender el constraint trigger diferido para exigir la tabla hija en todo tipo y la ausencia de líneas en los tipos sin mercadería, y agregar el `CHECK (tipo::text <> 'MOVIMIENTO_CUENTA')`. Verificación: tests de integración "Venta sin cliente", "Transferencia a la misma cuenta" y "Gasto con líneas de mercadería".
- [x] 10.2 Migración D: corregir las funciones que no son `SECURITY DEFINER` según el 1.3 y revocar `INSERT`, `UPDATE` y `DELETE` de `anon` y `authenticated` sobre `operaciones`, las hijas, `operaciones_lineas`, OMC, OMS y los dos ledgers. Verificación: tests de integración "Escritura directa del ledger", "Escritura directa del kardex" y "Escritura directa de la cantidad", más que pase la suite completa.

## 11. Integración y entrega

- [x] 11.1 Correr el diagnóstico sobre una copia de producción con la cadena completa aplicada: las 23 migraciones pendientes más las de este change. Verificación: ninguna invariante devuelve filas; los `NOTICE` del backfill quedan anotados en `IMPLEMENTATION_NOTES.md`.
- [x] 11.2 Chequeos estáticos:
  - `_ledger_insertar` solo aparece en los triggers de OMC;
  - ninguna función vigente contiene `UPDATE public.stocks` salvo `_stock_aplicar_movimiento` y `_lineas_recalcular_stock`;
  - nada en `src/` escribe `cantidad` de `stocks`.
  Verificación: resultado de los `grep` anotado en `IMPLEMENTATION_NOTES.md`.
- [x] 11.3 Validación completa: `npx supabase db reset`, `npm run test:integration`, `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build`. Los `.test.tsx` se validan con el config local de vitest por el problema de Vite 8, y se reporta el baseline de fallas ajenas. Verificación: todos pasan, salvo el baseline documentado.
- [x] 11.4 Escenarios manuales en la app:
  - registrar y anular pagos de una compra y de una venta;
  - entrega parcial y su reversión;
  - transferencia e ingreso en el listado de operaciones;
  - editar la cantidad de un stock y verlo en el kardex;
  - repuesto en un arreglo (auto-compra, quitarlo);
  - NC con devolución.
  Verificación: resultado anotado en `IMPLEMENTATION_NOTES.md`.
- [x] 11.5 Validar el change con `openspec validate rediseno-operaciones-ledgers --strict`. Verificación: el comando informa que el change es válido.

## 12. Correcciones de la revisión con producción

- [x] 12.1 Incorporar las decisiones acordadas: cliente/proveedor opcionales, RPCs de escritura SECURITY DEFINER y regularización histórica con una OMC por documento más un AJUSTE_FINANCIERO neto por tenant, sin marca de migración persistente.
- [x] 12.2 Corregir el backfill y las reversas financieras, el emparejamiento de pagos repetidos y la edición de gastos con un pago parcial. Verificación: regresiones con asientos históricos editados y correcciones/anulaciones sucesivas.
- [x] 12.3 Implementar la regularización de documentos históricos pagados sin asiento, seleccionando cuenta favorita activa o primera activa por created_at/id, y comprobar que el saldo de cada cuenta se conserva.
- [x] 12.4 Restaurar SECURITY DEFINER y los grants de solo lectura para documentos/OMC/OMS, corregir el DROP de la firma de 14 argumentos del helper de kardex y sanear/validar las asociaciones históricas. Verificación: RPCs autorizadas funcionan, escritura directa y referencias entre tenants se rechazan.
- [x] 12.5 Corregir las cancelaciones y devoluciones de NC, y bloquear stock antes de recalcular reservas concurrentes. El caso de kardex histórico con entregas parciales no bloquea la producción actual, que aún no tiene kardex. Verificación: NC con y sin devolución y reservas simultáneas.
- [x] 12.6 Actualizar tipos, presentación y pruebas del ajuste financiero; ejecutar regresiones SQL/integración, comprobaciones estáticas y ensayo de toda la cadena desde el esquema de producción. Registrar resultados y límites de la verificación.

## Workflow follow-up

- Regenerar `supabase/schemas/` con el flujo del equipo después de aplicar las migraciones.
- Marcar `.codex-work/rediseno-operaciones-ledgers/PLAN.md` como reemplazado por este change.
- Archivar el change con `/opsx:archive` cuando esté mergeado a main, para crear las specs principales `operaciones`, `operaciones-impacto-financiero` y `operaciones-impacto-stock`.
