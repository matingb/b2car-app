# Design

## Context

La motivación está en `proposal.md` (sección Why). El comportamiento esperado está en las tres specs del change. Este documento cubre cómo implementarlo.

**Estado actual relevante.** Las ubicaciones de esta sección son la última definición de cada función en `supabase/migrations/`. `supabase/schemas/` está desfasado: no tiene `operaciones_gasto`, `movimientos_stock.reversion_de_id` ni las RPCs del 28 al 31/10.

- **Tablas hijas 1:1 que ya existen:**
  - `operaciones_venta(cliente_id)`;
  - `operaciones_compra(proveedor_id)`;
  - `operaciones_gasto(categoria_gasto, descripcion)`;
  - `operaciones_asignacion_arreglo(arreglo_id)`, que no tiene `tenant_id` ni `created_at`;
  - `operaciones_cobro_arreglo(arreglo_id)`.
- **OMC (`operaciones_movimiento_cuenta`):**
  - PK `operacion_id`, o sea 1:1;
  - columnas `subtipo`, `cuenta_id` XOR (`cuenta_origen_id`, `cuenta_destino_id`) y `categoria_gasto`;
  - triggers `_omc_after_insert/update/delete` en `20260824000000_finanzas.sql:233/248/271`, que escriben el ledger con la fecha de la operación;
  - una transferencia es 1 OMC que genera 2 asientos.
- **Pagos de compra, venta y gasto:**
  - son filas de `operaciones_pagos` (`20261029223000`);
  - el RPC escribe el ledger directo con `_ledger_insertar`;
  - `total_pagado` lo recalcula `_sync_operacion_total_pagado`, un trigger sobre `operaciones_pagos` definido en `20261021134500:136`.
- **`MOVIMIENTO_CUENTA` lo crean tres funciones:**
  - `rpc_crear_movimiento_cuenta` (`20261028213000:11`), para gasto manual, ingreso y transferencia;
  - `_crear_apertura_cuenta` (`20260828150112:24`);
  - `rpc_finanzas_cobrar_arreglo` (`20260828220000:7`).
  El listado (`rpc_listar_operaciones_con_gastos`, `20261028110000:320`) y las estadísticas (`rpc_operaciones_stats`, `20261029223000:382`) arman el tipo visible con `COALESCE(omc.subtipo, o.tipo)`.
- **Kardex (`movimientos_stock`):**
  - lo escribe `_stock_ledger_insertar` (`20261027230000:15`), y solo desde crear, confirmar, revertir y borrar operaciones con stock;
  - no lo escriben las asignaciones a arreglos (`20261028120000:661`), la NC (`20261011230000:3`), `_crear_producto_y_stock` (`20260512120000:105`) ni `POST/PUT /api/stocks`;
  - `stocks.cantidad`, `cantidad_reservada` y `cantidad_pendiente` se actualizan a mano.
- **Guards de facturación:** `facturacion_bloquear_mutacion_operacion_facturada` (`20260906150000:6`) bloquea **todo** UPDATE y DELETE sobre una venta facturada y sus líneas. Por eso hoy no se puede cobrar una venta facturada.
- **Fase 0 del plan anterior:** ya está hecha en `20261031111500`. `rpc_borrar_operacion_con_stock` pasa el tenant y devuelve `boolean`.
- **Permisos:**
  - la app solo escribe directo en `stocks` (`stocksService.ts`, `productoRepository.ts:142`);
  - todo lo demás pasa por RPCs;
  - aun así, `authenticated` tiene permisos de escritura sobre `operaciones` y puede insertar en `movimientos_stock`.

**Restricción de despliegue.** `origin/main` llega hasta `20261017100000`. Hay 23 migraciones de dev pendientes, entre ellas:

- `20261021134500`: crea `operaciones_pagos` y las operaciones diferidas;
- `20261021213000`: crea el kardex;
- `20261029110500`: llena `operaciones_pagos` con los pagos históricos;
- `20261029223000`: mueve los pagos posteriores a `operaciones_pagos`.

**Acuerdo de convergencia de pagos:** Con fecha 2026-11-01 se acuerda con matias que los pagos convergen en OMC y que `operaciones_pagos` se elimina, revirtiendo la dirección de `20261029223000`.

Las migraciones de este change corren **después** de todas ellas, sobre datos de producción. El backfill tiene que partir del estado que dejan, aunque en local se use `db reset`.

**Reglas del repo** (`supabase/AGENTS.md`):
- todo cambio de base de datos va en una migración;
- `supabase/schemas/` no se edita a mano, se regenera;
- las tablas nuevas llevan grants explícitos y RLS;
- se usa `logger` en lugar de `console.*`.

## Goals / Non-Goals

**Goals:**
- Que los ledgers (`movimientos_financieros`, `movimientos_stock`) y los derivados los escriban **solo triggers**. Las RPCs escriben documentos, tablas hijas, OMC y OMS.
- Revocar la escritura directa de `authenticated` sobre los ledgers, OMC, OMS, líneas, operaciones y tablas hijas.
- Conservar el contrato de errores que mapea la app (`src/app/api/apiError.ts:113-149`): los SQLSTATE `55001`, `55002`, `55005`, `P0001` y `22023`, y el texto `STOCK_INSUFICIENTE`.
- Conservar los nombres y firmas de las RPCs que usa la app. Las excepciones son las que la proposal marca como **BREAKING**.
- Que `npx supabase db reset` deje la base consistente y que el diagnóstico de invariantes no devuelva filas.

**Non-Goals:**
- Reescribir las 23 migraciones pendientes. Ya corrieron en otras bases; este change agrega migraciones nuevas encima.
- Optimizar más allá de los índices necesarios para los triggers.
- Cambiar el contrato de `rpc_finanzas_cobrar_arreglo`, `rpc_finanzas_anular_cobro_arreglo` y `rpc_get_arreglo_detalle` más allá del tipo de operación.

## Decisions

### 1. Tablas hijas: una por tipo

| tipo | tabla hija | columnas propias |
|---|---|---|
| VENTA | `operaciones_venta` | `cliente_id` (existe) |
| COMPRA | `operaciones_compra` | `proveedor_id` (existe) |
| GASTO | `operaciones_gasto` | `categoria_gasto`, `descripcion` (existe). Se le agrega el `CHECK` de categorías que hoy está en OMC |
| ASIGNACION_ARREGLO | `operaciones_asignacion_arreglo` | `arreglo_id` (existe; se le agregan `tenant_id` y `created_at`) |
| COBRO_ARREGLO | `operaciones_cobro_arreglo` | `arreglo_id` (existe) |
| AJUSTE | **`operaciones_ajuste`** (nueva) | `motivo` (`INICIAL`, `MANUAL` o `DEVOLUCION_NC`) y `descripcion` |
| INGRESO | **`operaciones_ingreso`** (nueva) | `cuenta_id` y `concepto` |
| TRANSFERENCIA | **`operaciones_transferencia`** (nueva) | `cuenta_origen_id` y `cuenta_destino_id`, con `CHECK` de que sean distintas |
| APERTURA_CUENTA | **`operaciones_apertura_cuenta`** (nueva) | `cuenta_id` |

Todas comparten forma: PK `operacion_id` con FK `ON DELETE CASCADE` a `operaciones`, `tenant_id`, `created_at`, RLS con SELECT por `current_tenant_id()` y grants explícitos. La escritura pasa solo por RPCs `SECURITY DEFINER`.

**Cómo se garantiza que exista la hija.** Una FK no puede expresar "si el tipo es X, existe la fila en `operaciones_x`". Lo verifica un constraint trigger `DEFERRABLE INITIALLY DEFERRED` sobre `operaciones`, `_operacion_validar_documento`, que corre al commit. El mismo trigger valida la coherencia de los tipos instantáneos (decisión 5) y que las operaciones sin mercadería no tengan líneas.

- *Alternativa descartada:* confiar en las RPCs. No alcanza mientras queden grants directos, y la verificación diferida es barata.

**Enum `tipo_operacion`.**
- Se agregan `INGRESO`, `APERTURA_CUENTA` y `COBRO_ARREGLO` en una **migración propia y previa**. Postgres no permite usar un valor de enum en la misma transacción en la que se agrega.
- `MOVIMIENTO_CUENTA` queda en el enum, porque Postgres no permite quitar valores. Un `CHECK (tipo::text <> 'MOVIMIENTO_CUENTA')`, agregado después del backfill, impide usarlo.
- La constraint `operaciones_taller_requerido` pasa a exigir taller si y solo si el tipo mueve mercadería: COMPRA, VENTA, ASIGNACION_ARREGLO y AJUSTE.

### 2. OMC solo como impacto

Forma final de `operaciones_movimiento_cuenta`:

- `id` (PK nueva)
- `operacion_id` (FK `CASCADE`, indexada)
- `tenant_id`
- `cuenta_id NOT NULL`
- `importe numeric(14,2) CHECK (importe <> 0)`
- `fecha NOT NULL`
- `descripcion`
- `idempotency_key`, con el índice único parcial `(tenant_id, idempotency_key)` que ya existe
- `created_by`
- `created_at`

Se eliminan `subtipo`, `cuenta_origen_id`, `cuenta_destino_id` y `categoria_gasto`, junto con sus `CHECK` (`omc_cuenta_xor`, `omc_subtipo_check` y `omc_categoria_gasto_check`). Con el tipo real de la operación más el signo, `subtipo` no aporta nada.

El trigger `BEFORE INSERT OR UPDATE` `_omc_validar`:
- completa `fecha := COALESCE(NEW.fecha, operaciones.fecha)`;
- exige que el `tenant_id` coincida con el de la operación;
- aplica la regla de signo de la spec;
- rechaza OMC sobre `ASIGNACION_ARREGLO` y `AJUSTE`.

Todos los rechazos usan el código `22023`.

### 3. Ledger financiero: un asiento por OMC

Cambios en `movimientos_financieros`:
- `ADD omc_id uuid` sin FK, porque es historial;
- `ADD reversion_de_id uuid REFERENCES movimientos_financieros(id)`;
- `DROP CONSTRAINT movimientos_financieros_operacion_id_fkey`, para que `operacion_id` quede como referencia histórica (D4);
- índice sobre `omc_id`.

Cambios en las funciones:
- **`_ledger_insertar`:** pasa a `(p_operacion_id, p_tenant_id, p_cuenta_id, p_importe, p_fecha, p_omc_id, p_reversion_de_id)`. Se hace `DROP` de la firma anterior y se actualizan los grants.
- **`_omc_after_insert`:** genera un asiento con `fecha = NEW.fecha` y `omc_id = NEW.id`.
- **`_omc_after_delete`:** busca el asiento vigente de `OLD.id`, o sea el que no tiene una reversa que lo apunte. Inserta su contraasiento con:
  - `importe` opuesto;
  - `fecha = now()`;
  - `operacion_id = OLD.operacion_id`;
  - `omc_id = OLD.id`;
  - `reversion_de_id` = el asiento original.
- **`_omc_after_update`:** si cambian `cuenta_id`, `importe` o `fecha`, inserta el contraasiento del vigente y un asiento nuevo (D8).

Ya no hace falta `app.finanzas_tenant_cleanup` para borrar operaciones: no hay FK que reescribir. El flag queda solo para `eliminar_tenant`. Se eliminan `_finanzas_insertar_movimiento` y `_finanzas_reversar_movimiento`, que quedan sin llamadores.

- *Alternativa descartada:* que una OMC de transferencia genere dos asientos. Obliga a que `omc_id` no identifique un asiento único y complica las reversas.

### 4. Estado de pago derivado

`_omc_sync_total_pagado` es un trigger `AFTER INSERT OR UPDATE OR DELETE` por fila sobre OMC:
- recalcula `total_pagado = |Σ importe|` de la operación, y de la operación anterior si cambió;
- solo para COMPRA, VENTA y GASTO;
- hace el UPDATE solo si el valor cambia;
- si la operación ya no existe porque se está borrando, no hace nada.

`estado_pago` y `esta_pago` los sigue calculando `_recalcular_estado_pago_operacion` (`20261021134500:74`). Se eliminan `trg_sync_operacion_total_pagado` y `_sync_operacion_total_pagado`.

### 5. Operaciones instantáneas: el RPC escribe la hija y las OMC, y el commit valida

Para INGRESO, APERTURA_CUENTA, COBRO_ARREGLO y TRANSFERENCIA, el RPC inserta en una transacción la operación (con `monto_total`), su hija y sus OMC. `_operacion_validar_documento` (diferido, decisión 1) verifica al commit:
- **INGRESO, APERTURA_CUENTA y COBRO_ARREGLO:** exactamente 1 OMC en la cuenta de la hija (en COBRO_ARREGLO, en cualquier cuenta), con `|importe| = monto_total`.
- **TRANSFERENCIA:** exactamente 2 OMC, `-monto_total` en `cuenta_origen_id` y `+monto_total` en `cuenta_destino_id`.

Para que una corrección se valide aunque solo cambie la OMC o la hija, también se disparan constraint triggers diferidos desde OMC y desde las hijas. Todos llaman a la misma función, que hace `RETURN` si la operación ya no existe.

- *Alternativa descartada:* que la hija genere las OMC por trigger. La descartó el usuario: OMC pasaría a ser derivada en unos tipos y primaria en otros, y quedarían triggers encadenados.

### 6. API de movimientos manuales: se conservan las RPCs, cambia el interior

`rpc_crear_movimiento_cuenta`, `rpc_actualizar_movimiento_cuenta` y `rpc_eliminar_movimiento_cuenta` mantienen su firma, salvo que se quita `p_arreglo_id`. `p_subtipo` queda como selector de API:
- `GASTO` crea una operación `GASTO` + `operaciones_gasto` + 1 OMC por el total. Comparte helper con `rpc_crear_operacion_gasto`.
- `INGRESO` crea `INGRESO` + `operaciones_ingreso` + 1 OMC.
- `TRANSFERENCIA` crea `TRANSFERENCIA` + `operaciones_transferencia` + 2 OMC.

**Actualizar** acepta solo:
- `INGRESO` y `TRANSFERENCIA`;
- `GASTO` de contado, es decir, con 0 o 1 OMC por el total. En un gasto con más pagos o con un pago parcial, solo se pueden cambiar categoría, descripción, fecha, taller y observaciones; cambiar monto o cuenta da `22023`.

Al corregir se actualiza la operación, la hija y la OMC. El ledger hace el contraasiento y el asiento nuevo (decisión 3).

**Eliminar** acepta GASTO, INGRESO y TRANSFERENCIA, y borra la operación completa.

Las dos RPCs rechazan `COBRO_ARREGLO`, que se anula con `rpc_finanzas_anular_cobro_arreglo`. Esto además cierra el bug que desincronizaba `arreglos.total_cobrado`.

Los otros dos creadores:
- `_crear_apertura_cuenta` crea `APERTURA_CUENTA` + hija + 1 OMC.
- `rpc_finanzas_cobrar_arreglo` crea `COBRO_ARREGLO` en lugar de `MOVIMIENTO_CUENTA`; el resto queda igual.

- *Alternativa descartada:* una RPC por tipo y por acción. Son 6 a 9 RPCs nuevas más los cambios de rutas, sin ganancia funcional en una entrega única.

### 7. Pagos de documentos

- **`rpc_registrar_pago_operacion`:**
  - mantiene validaciones, `FOR UPDATE` del documento y rechazo si supera lo pendiente;
  - inserta 1 OMC con `fecha = p_fecha`, importe con el signo del tipo e `idempotency_key`;
  - la idempotencia se busca en OMC;
  - la respuesta conserva sus claves, con `pago_id` = `omc.id`.
- **`rpc_finanzas_anular_pago_operacion(p_operacion_id, p_pago_id)`:** hace `DELETE` de la OMC. El trigger revierte y recalcula.
- **`rpc_crear_operacion_con_stock` y `rpc_crear_operacion_gasto`:** cada pago inicial pasa a ser una OMC. Se quitan `_ledger_insertar`, el INSERT en `operaciones_pagos` y los UPDATE manuales de `total_pagado`, `esta_pago` y `estado_pago`.

### 8. Stock: OMS, kardex y derivados

Esta sección retoma la fase 2 del plan original, con los ajustes de las decisiones 9 y 10.

**Cambios en `operaciones_lineas`:**
- `sentido smallint NOT NULL CHECK (sentido IN (-1, 1))`;
- `cantidad_cancelada integer NOT NULL DEFAULT 0` (decisión 9);
- `CHECK (cantidad_cumplida + cantidad_cancelada <= cantidad)`;
- índice parcial por `stock_id` para las líneas abiertas.

**Tabla nueva `operaciones_movimiento_stock`:**
- `id`, `tenant_id`;
- `operacion_id` y `operacion_linea_id`, los dos con FK `CASCADE`;
- `stock_id` con FK `RESTRICT`, copiado de la línea porque el trigger de DELETE lo necesita aunque la línea ya no exista;
- `cantidad integer CHECK (<> 0)` con signo;
- `fecha`, `motivo`, `idempotency_key` (único parcial), `created_by`, `created_at`;
- RLS solo SELECT.

OMS **no lleva `tipo_movimiento`**. El kardex lo deriva:
- en COMPRA, VENTA y ASIGNACION_ARREGLO, del tipo de operación;
- en AJUSTE, del `motivo` de `operaciones_ajuste`: `INICIAL` → `INICIAL`, `MANUAL` → `AJUSTE`, `DEVOLUCION_NC` → `DEVOLUCION_NC`;
- en las reversas, `REVERSION`.

**Cambios en `movimientos_stock`:**
- `ADD oms_id uuid` sin FK, con índice;
- `DROP` de las FK `movimientos_stock_operacion_id_fkey` y `movimientos_stock_detalle_arreglo_id_fkey`;
- `REVOKE INSERT` a `anon` y `authenticated`.

**Triggers:**
- **`_stock_aplicar_movimiento`** (`BEFORE INSERT` en `movimientos_stock`) es el único escritor de `stocks.cantidad`:
  - bloquea el stock con `FOR UPDATE`;
  - completa `saldo_anterior` y `saldo_posterior`;
  - si el saldo queda negativo, levanta `STOCK_INSUFICIENTE` con `55002`, o `55005` si es una reversa;
  - actualiza `stocks.cantidad` con el flag local `app.stock_ledger_write`.
- **`_stocks_proteger_saldos`** (`BEFORE INSERT OR UPDATE` en `stocks`):
  - rechaza cambios en `cantidad`, `cantidad_reservada` y `cantidad_pendiente` sin el flag correspondiente (`app.stock_ledger_write` o `app.stock_derivados_write`);
  - en INSERT fuerza los tres valores en 0;
  - `stock_minimo` y `stock_maximo` siguen libres.
- **`_oms_validar`** (`BEFORE INSERT`):
  - verifica que línea, operación, stock y tenant sean coherentes;
  - completa `fecha`;
  - exige `0 <= sentido × (Σ OMS + NEW.cantidad) <= cantidad - cantidad_cancelada`.
- **`_oms_after_insert` y `_oms_after_delete`:**
  - insertan la fila del kardex o su reversa, con `reversion_de_id`, `oms_id`, `operacion_id`, `fecha = now()` en la reversa y `motivo`;
  - recalculan la línea (`cantidad_cumplida`), el `estado_stock` de la operación y los derivados del stock.
  - Si la línea o la operación ya no existen, no las recalculan.
- **OMS `BEFORE UPDATE`:** `RAISE` (D8).
- **`_lineas_recalcular_stock`** (`AFTER INSERT OR DELETE OR UPDATE OF cantidad, stock_id, cantidad_cancelada` en `operaciones_lineas`):
  - recalcula **desde cero** `cantidad_reservada` y `cantidad_pendiente` del stock afectado, y del anterior si cambió, con la fórmula `cantidad - cantidad_cumplida - cantidad_cancelada` sobre las líneas abiertas de VENTA o COMPRA;
  - en VENTA, rechaza con `55002` si la cantidad disponible queda negativa.

`estado_stock` se calcula solo en COMPRA y VENTA, comparando `Σ (cumplida + cancelada)` contra `Σ cantidad`. Para el resto de los tipos se mantiene el valor actual.

**Lock ordering.** Las RPCs insertan líneas y OMS ordenadas por `stock_id`, como ya hace `rpc_facturacion_finalizar_nc`.

**`trigger_recalcular_precio_operaciones_lineas`** se acota a `UPDATE OF cantidad, monto_unitario, stock_id, iva_alicuota_id`. Así no corre en cada recálculo de `cantidad_cumplida` ni reescribe `arreglos.precio_final`, lo que chocaría con `facturacion_proteger_arreglos`.

**RPCs de stock:**

| RPC | Comportamiento |
|---|---|
| `rpc_crear_operacion_con_stock` | Inserta las líneas con `sentido` y crea OMS por la parte cumplida. Sin UPDATE directo a `stocks` |
| `rpc_confirmar_stock_operacion` | Crea una OMS por `LEAST(pendiente, pedida)`. Mismo contrato |
| `rpc_revertir_movimiento_stock_operacion` | Ubica el `oms_id` del movimiento y hace `DELETE` de esa OMS. Si es NULL, devuelve `22023`. Mantiene los rechazos de hoy |
| `rpc_set_asignacion_arreglo_linea` | Upsert de la línea (`sentido = -1`) y OMS por la diferencia. Si la cantidad baja, primero la OMS de devolución y después baja `cantidad` |
| `rpc_delete_asignacion_arreglo_linea` | `DELETE` de la línea (la cascada revierte) y borra la operación si queda vacía |
| `_crear_producto_y_stock` y la nueva `rpc_crear_stock` | Crean el stock en 0 y, si la cantidad es mayor que 0, un `AJUSTE` de motivo `INICIAL` |
| Nueva `rpc_ajustar_stock(p_stock_id, p_cantidad_nueva, p_motivo, p_idempotency_key)` | `AJUSTE` de motivo `MANUAL` por la diferencia. Si la diferencia es 0, no hace nada |
| `rpc_revertir_operacion_linea`, `_stock_ledger_insertar` | `DROP` |
| `eliminar_tenant` | Borra OMS antes que las líneas, con los flags de cleanup |

### 9. NC: primero se cancela lo no entregado, después se devuelve lo entregado

`rpc_facturacion_finalizar_nc`, por cada línea de venta acreditada:
1. Calcula `cancelar = LEAST(unidades acreditadas, cantidad - cumplida - cancelada)` y suma ese valor a `cantidad_cancelada`. Es una columna no fiscal y está en la lista blanca del guard (decisión 11). El trigger de líneas libera la reserva.
2. Valida que la devolución física pedida no supere `cumplida - Σ devoluciones físicas anteriores de esa línea`. Si la supera, `22023`.
3. Crea la operación `AJUSTE` con `motivo = DEVOLUCION_NC`, sus líneas (`sentido = +1`) y sus OMS **antes** de vincular `operacion_ajuste_id`, porque después el guard de NC la vuelve inmutable.

Hoy la NC reingresa la `cantidad_original` de `facturacion_factura_stock_origenes` sin mirar lo entregado. Ese comportamiento se reemplaza.

- *Alternativa descartada:* reducir la `cantidad` de la línea. Es un dato fiscal de una venta facturada y no se puede tocar.

### 10. `delta_cantidad` pasa a ser una columna generada desde lo pactado (D7)

**Situación en dev.** Desde las operaciones diferidas, `delta_cantidad` sigue **lo cumplido**:
- `rpc_crear_operacion_con_stock` graba `±cantidad_cumplida` en COMPRA y VENTA (`20261028120000`, INSERT de líneas);
- `rpc_confirmar_stock_operacion` y `rpc_revertir_movimiento_stock_operacion` lo actualizan.

Facturación (`facturacionService.ts:798-805` y `rpc_facturacion_preparar_documento`, `20261010160000:141`) saltea las líneas con `delta >= 0` y exige `cantidad = |delta|`. Resultado: una venta no entregada se factura sin sus productos, y una entregada en parte falla con "La cantidad física de origen no es coherente con la salida de stock". Producción no tiene ventas diferidas, así que esto todavía no llegó a los usuarios.

**Decisión.** `delta_cantidad` pasa a ser `GENERATED ALWAYS AS (sentido * cantidad) STORED`, es decir, lo pactado:
- los dos lectores de facturación quedan sin cambios y empiezan a facturar la cantidad pactada;
- las RPCs dejan de escribir la columna;
- el backfill informa con `RAISE NOTICE` cuántas líneas cambian de valor (las diferidas o parciales).

- *Alternativa descartada:* dejar `delta_cantidad` siguiendo lo cumplido, como proponía el plan original. Mantiene el bug y contradice D7.
- *Alternativa descartada:* que facturación lea `sentido` y `cantidad` y borrar `delta_cantidad`. Toca dos lectores y la UI sin ningún beneficio sobre la columna generada.

### 11. Guards de facturación con lista blanca (H3)

`facturacion_bloquear_mutacion_operacion_facturada`, `facturacion_bloquear_mutacion_arreglo` (`20261010070000:179`) y `facturacion_bloquear_mutacion_devolucion_nc` (`20261008100000:125`):
- **UPDATE de `operaciones`:** rechazan solo si cambian `tipo`, `fecha`, `taller_id`, `monto_total` u `observaciones`.
- **UPDATE de `operaciones_lineas`:** rechazan solo si cambian `stock_id`, `cantidad`, `monto_unitario`, `iva_alicuota_id` o `sentido`.
- **INSERT y DELETE:** siguen bloqueados.

Columnas derivadas permitidas: `total_pagado`, `esta_pago`, `estado_pago`, `estado_stock`, `cantidad_cumplida` y `cantidad_cancelada`.

### 12. Edición de operaciones (D6, opción A)

`rpc_actualizar_operacion_con_stock` (`20261015010000:123`) se reemplaza por `rpc_actualizar_operacion(p_operacion_id, p_fecha, p_observaciones)`:
- bloquea la operación y actualiza solo esos campos;
- en los tipos instantáneos actualiza también la `fecha` de sus OMC, y el ledger hace el contraasiento y el asiento nuevo;
- el guard rechaza la edición si la venta está facturada.

`PUT /api/operaciones/[id]` valida que el body traiga solo `fecha` u `observaciones`; cualquier otra clave da 400. Se elimina `findCuentaFinancieraByOperacionId` (`operacionRepository.ts:299`), que además fallaba con más de un asiento.

### 13. Borrado

`rpc_borrar_operacion_con_stock` (`20261031111500:14`) pasa a hacer `DELETE FROM operaciones` con el bloqueo previo, sin bucles manuales ni flags de cleanup:
- la cascada borra hija, líneas, OMS y OMC;
- los triggers generan las reversas en los dos ledgers;
- si el stock quedaría negativo, falla con `55005` desde el kardex;
- si la venta está facturada, falla en el guard.

`rpc_borrar_operacion_completa` no cambia.

### 14. Lectores

- **`rpc_listar_operaciones_con_gastos`:**
  - `tipo = o.tipo`;
  - `LEFT JOIN` 1:1 a cada hija, nunca a OMC, de modo que una operación aparece una sola vez;
  - suma las columnas de origen y destino de la transferencia y la cuenta del ingreso;
  - conserva el resto de la salida.
- **`rpc_operaciones_stats`:**
  - `tipo = o.tipo`;
  - ingresos = VENTA + INGRESO + COBRO_ARREGLO;
  - egresos = COMPRA + GASTO;
  - excluye TRANSFERENCIA y APERTURA_CUENTA.
- **`dashboard_gastos_por_periodo` y `dashboard_gastos_por_dia`:** los gastos eventuales salen de las OMC de operaciones `GASTO`, agrupadas por `omc.fecha`.
- **`rpc_listar_movimientos_cuenta`:**
  - `LEFT JOIN omc ON omc.id = m.omc_id` y después `operaciones`;
  - `tipo = o.tipo`;
  - descripción = `COALESCE(omc.descripcion, descripción de la hija)`.
- **`rpc_cliente_cuenta_corriente` y la cuenta corriente de proveedores:** los cobros y pagos salen de OMC unida a `operaciones_venta` u `operaciones_compra`.
- **`operacionRepository.ts:236`:**
  - el embed `operaciones_pagos` pasa a ser `pagos:operaciones_movimiento_cuenta!operaciones_movimiento_cuenta_operacion_id_fkey(...)`;
  - el embed de `movimientos_stock` por FK pasa a ser una consulta aparte por `operacion_id`, porque la FK desaparece.

### 15. Backfill sobre el estado que dejan las migraciones pendientes

Corre dentro de las migraciones. Durante el bloque se deshabilitan los triggers de OMC, de OMS y de los ledgers, y los de inmutabilidad (`_finanzas_bloquear_mutacion_ledger`, `_stock_bloquear_mutacion_ledger`); al final se rehabilitan. Es la única vez que se reescriben filas de los ledgers, y queda comentado en la migración.

**Finanzas:**
1. **OMC:** se le agregan `id` y `fecha`; `fecha` se toma de `operaciones.fecha`. Se cambia la PK.
2. **Ledger:** se le agregan `omc_id` y `reversion_de_id`. Los asientos existentes se vinculan con su OMC por `operacion_id`, que hasta acá es 1:1.
3. **`MOVIMIENTO_CUENTA` → tipo real**, según `omc.subtipo` y la existencia de una fila en `operaciones_cobro_arreglo`:
   - `GASTO` pasa a `GASTO` y se le crea `operaciones_gasto(categoria_gasto, descripcion)`;
   - `INGRESO` con fila en `operaciones_cobro_arreglo` pasa a `COBRO_ARREGLO`;
   - `INGRESO` sin esa fila pasa a `INGRESO`, con `operaciones_ingreso(cuenta_id, concepto = descripcion)`;
   - `APERTURA_CUENTA` pasa a `APERTURA_CUENTA` y se le crea su hija;
   - `TRANSFERENCIA` pasa a `TRANSFERENCIA` y se le crea su hija. Su OMC se parte en dos (`-importe` en origen, `+importe` en destino) y cada asiento existente se vincula con la OMC de su cuenta.
   En todos los casos, `monto_total = |importe|`. Además, las operaciones `GASTO` que no tengan `operaciones_gasto` la reciben desde su OMC.
4. **`operaciones_pagos` → OMC:**
   - Por cada fila se inserta una OMC con `cuenta_financiera_id`, el monto con el signo del tipo, `fecha`, `descripcion`, `idempotency_key`, `created_by` y `created_at`.
   - Excepción: si ya existe una OMC del mismo documento con igual cuenta e `|importe|` sin emparejar, que es el caso de los gastos históricos, no se crea otra.
   - Después se vinculan los asientos sin `omc_id` del documento por `(operacion_id, cuenta, |importe|, fecha)`, usando `row_number()` a los dos lados para no colapsar duplicados.
5. **Asientos que quedan sin emparejar:** son pagos anulados, la pareja de asiento original y contraasiento. Quedan con `omc_id = NULL` y se informa la cantidad con `RAISE NOTICE`.
6. **Recalcular `total_pagado`** de COMPRA, VENTA y GASTO. Si algún valor difiere del anterior, `RAISE EXCEPTION` con el detalle y la migración aborta.
7. **Limpieza:**
   - `DROP` de `operaciones_pagos`, su trigger y sus funciones;
   - `DROP` de las columnas viejas de OMC;
   - se agrega el `CHECK` contra `MOVIMIENTO_CUENTA`;
   - se crean los constraint triggers diferidos.

**Stock:**
1. **`sentido`:** `sign(delta_cantidad)` si es distinto de 0; si no, por tipo: COMPRA +1; VENTA y ASIGNACION_ARREGLO −1; AJUSTE +1.
2. **`operaciones_ajuste`:** `motivo = DEVOLUCION_NC` si la operación figura en `facturacion_nc_devoluciones.operacion_ajuste_id`; si no, `MANUAL`.
3. **OMS:** una por línea con `cantidad_cumplida > 0`, por `sentido × cumplida`, con `fecha = operaciones.fecha` y motivo `'Migración: estado previo'`. En ASIGNACION_ARREGLO y AJUSTE se usa `|delta_cantidad|` si la cumplida es 0 por datos viejos. Las filas del kardex con la misma operación y el mismo stock se vinculan con esa OMS.
4. **Conciliación:** por cada stock donde `cantidad` no coincide con el último `saldo_posterior`, se inserta una fila `AJUSTE` con motivo `'Conciliación de kardex (rediseño de operaciones)'` y `oms_id` NULL. Es la excepción documentada en la spec. Se informa con `RAISE NOTICE`.
5. **Derivados:** se recalculan `cantidad_reservada` y `cantidad_pendiente` y se informan las diferencias. Las líneas son el documento y mandan.
6. **`delta_cantidad`:** se cambia por la columna generada (decisión 10).

**Permisos:** se revoca `INSERT`, `UPDATE` y `DELETE` de `anon` y `authenticated` sobre `operaciones`, las tablas hijas, `operaciones_lineas`, OMC, OMS, `movimientos_financieros` y `movimientos_stock`. Antes hay que verificar que todas las funciones que escriben esas tablas sean `SECURITY DEFINER`. En `stocks` la escritura se mantiene, protegida por `_stocks_proteger_saldos`.

## Risks / Trade-offs

- **El backfill corre sobre datos de producción que nadie probó**, y además después de 23 migraciones intermedias. → Correr el diagnóstico de invariantes sobre una copia de producción con toda la cadena aplicada antes de mergear. Las diferencias de `total_pagado` abortan la migración.
- **Choque con trabajo en curso.** `20261029223000` y los tests de finanzas del 31/10 son de matias y van en otra dirección. → Coordinarlo antes de implementar. Esos tests se ajustan en este change.
- **Cascadas de triggers difíciles de seguir y costosas.** → Los derivados se recalculan desde cero por stock u operación, el UPDATE se hace solo si el valor cambia, hay índices parciales y cada trigger es idempotente frente a padres ya borrados.
- **Deadlocks entre ventas y compras concurrentes del mismo stock.** → Inserciones ordenadas por `stock_id` y un solo punto de bloqueo por stock en el kardex.
- **Una sola entrega grande.** → `tasks.md` se ordena por bloques que se pueden verificar por separado con `db reset` y tests. El merge a main es uno solo.
- **`MOVIMIENTO_CUENTA` queda en el enum.** → Un `CHECK` impide usarlo y los tipos de TypeScript lo quitan.
- **Movimientos de stock previos al rediseño que no se pudieron vincular con una OMS.** → No se pueden revertir desde la app: la acción se oculta y la RPC devuelve `22023`.
- **Rollback.** Las transformaciones de datos no son reversibles con una migración. → Backup de la base antes del despliegue; el rollback es restaurarlo.

## Migration Plan

1. Migración A: `ALTER TYPE tipo_operacion ADD VALUE` (`INGRESO`, `APERTURA_CUENTA`, `COBRO_ARREGLO`).
2. Migración B (finanzas y documentos):
   - esquema de las hijas nuevas y de OMC;
   - ledger;
   - triggers de OMC;
   - backfill de finanzas;
   - RPCs de pagos y de movimientos manuales;
   - guards de facturación;
   - lectores financieros;
   - `DROP` de `operaciones_pagos`.
3. Migración C (stock):
   - `sentido`, `cantidad_cancelada`, OMS y cambios del kardex;
   - triggers de stock;
   - backfill de stock;
   - RPCs de stock, NC y edición/borrado;
   - `delta_cantidad` generada.
4. Migración D (cierre):
   - constraint triggers diferidos;
   - `CHECK` contra `MOVIMIENTO_CUENTA`;
   - revocación de grants.
5. Reescritura de `supabase/seed.sql`, más `npx supabase db reset` y el diagnóstico en local.
6. Cambios de API y frontend, más los tests.
7. Diagnóstico sobre una copia de producción con la cadena completa aplicada.
8. Merge de dev a main (despliegue), y después regenerar `supabase/schemas/` con el flujo del equipo.

## Open Questions

- **Etiqueta del estado de stock de una venta con unidades canceladas por NC.** Por defecto queda `ENTREGADO`, que significa "sin pendientes". Si después se quiere distinguirla, sería un valor nuevo de `estado_stock_operacion`, sin impacto en las specs.
- **Pedir el motivo al editar la cantidad de un stock en la UI.** Por defecto el motivo es opcional y se guarda un texto genérico.
