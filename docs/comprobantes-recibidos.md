# Comprobantes recibidos (facturas de compra/gasto y retenciones)

Cambio OpenSpec: `facturas-compra-y-reporte-fiscal`, capability `comprobantes-recibidos`.
El reporte fiscal de compras (`reportes-fiscales-compras`) **no** está implementado: depende de P-MAP y P-REP.

## Qué es

Registro manual de documentos de proveedores asociados a **exactamente una** operación `COMPRA` o `GASTO`
del tenant. Una operación admite cero o más documentos. Tipos:

- `FACTURA` clase A, B o C (sin NC/ND de compra ni comprobantes especiales).
- `RETENCION`: documento informativo con líneas de concepto (descripción e importe).

**Invariancia documental:** crear, editar o eliminar un documento no crea ni modifica pagos, saldo pendiente,
estado de pago, cuenta corriente, cuentas financieras ni stock. No hay tablas de imputación. Ninguna ruta o RPC
de este circuito toca `operaciones`, pagos, movimientos financieros ni movimientos de stock (solo los lee).

Los cargos operativos se gestionan al dar de alta una compra con factura o al editar sus cargos. Adjuntar, editar o
eliminar el comprobante conserva el total y el saldo de la operación. Ver “Percepciones en el total de la compra”.

Fuera de alcance: emisión/verificación ARCA, adjuntos/archivos/fotos, Storage, OCR/importación, borradores,
cálculo de alícuotas, crédito fiscal o regímenes.

## Datos

Migración: `supabase/migrations/20261116110000_comprobantes_recibidos.sql`.

| Tabla / columna | Uso |
| --- | --- |
| `proveedores.condicion_iva` | Posición de IVA de la ficha (`RESPONSABLE_INSCRIPTO`, `MONOTRIBUTISTA`, `IVA_EXENTO`, `IVA_NO_ALCANZADO`). |
| `comprobantes_recibidos` | Cabecera: operación (FK obligatoria `ON DELETE RESTRICT`), tipo, clase, número, fecha, copia histórica de emisor y receptor, fecha de vencimiento de la factura (`fecha_vencimiento`, opcional, no anterior a `fecha`), observaciones, `idempotency_key`. Las columnas `codigo_autorizacion` y `vencimiento_autorizacion` (CAE/CAI) se conservan para documentos existentes, pero los formularios ya no las piden. |
| `comprobantes_recibidos_lineas` | Líneas `CONCEPTO` / `PERCEPCION` con descripción e importe manual (`> 0`, 2 decimales). |

Requeridos de `FACTURA`: clase, número, CUIT emisor (11 dígitos) y posición de IVA del proveedor.
`RETENCION`: fecha, razón social del emisor y al menos una línea; número/identificación opcional
(su identificación específica sigue abierta en P-REP). Todos requieren fecha y al menos una línea.

### Copia histórica y precarga

Al cargar un documento se precargan la ficha del proveedor de la compra (nombre, CUIT, dirección, posición de
IVA) y los datos fiscales del tenant como receptor (`facturacion_configuracion_ambiente` del ambiente actual).
Son una copia editable: guardar el documento no actualiza la ficha y editar la ficha no reescribe documentos.
Los gastos no tienen proveedor comercial: el emisor se completa en el formulario. `proveedor_id` es solo una
referencia (`ON DELETE SET NULL`).

### Duplicados

Índice único parcial `uq_comprobantes_recibidos_factura` sobre
`(tenant_id, emisor_cuit_normalizado, numero_normalizado) WHERE tipo_documento = 'FACTURA'`. Cubre alta,
edición y solicitudes concurrentes, en cualquier operación del tenant. No incluye clase ni proveedor.

- CUIT: solo dígitos. `30-71234567-8` ≡ `30712345678`.
- Número: mayúsculas; segmentos separados por cualquier carácter no alfanumérico; ceros a la izquierda quitados
  en cada segmento numérico. `0001-00001234` ≡ `00001-1234` ≡ `1 - 1234` (→ `1-1234`), pero `12-1234` y
  `1-21234` son distintos: no se confunden puntos de venta. Un número sin separador (`000100001234`) no se
  iguala con uno separado.

La API responde 409 `CONFLICT` con el mensaje de factura duplicada.

### Percepciones

Selector abierto: sugerencias con código estable (`GANANCIAS`, `IVA`, `IIBB_BUENOS_AIRES`, `IIBB_CABA`) o texto
libre (`OTRA` + descripción). Un texto libre igual a una sugerencia (sin distinguir espacios/mayúsculas) usa la
sugerencia. La columna generada `percepcion_clave` agrupa por código, o `OTRA:<DESCRIPCIÓN NORMALIZADA>` para las
libres (espacios colapsados, mayúsculas), sin fusionar jurisdicciones por semejanza. Queda disponible para el
reporte; la formación de columnas del reporte no está implementada.

## Permisos

`comprobantes_recibidos:view` y `comprobantes_recibidos:edit`. La migración copia las asignaciones vigentes de
`facturas:view` / `facturas:edit` en `role_permissions` y `plan_permissions` (acceso inicial equivalente a
facturación de ventas); después pueden divergir.

- RLS de lectura: tenant de la sesión y permiso de consulta. `authenticated` solo tiene `SELECT`.
- Escritura únicamente por RPC `SECURITY DEFINER` que exigen el permiso de gestión, derivan el tenant del JWT y
  validan operación, proveedor y documento del mismo tenant:
  `rpc_comprobante_recibido_guardar(p_comprobante_id, p_operacion_id, p_datos, p_lineas, p_idempotency_key)` y
  `rpc_comprobante_recibido_eliminar(p_comprobante_id)`.

## API

| Método y ruta | Permiso | Uso |
| --- | --- | --- |
| `GET /api/operaciones/{id}/comprobantes-recibidos` | view | Documentos de la operación, resumen informativo (monto operación, total y diferencia de facturas, total de retenciones separado) y precarga. |
| `POST /api/operaciones/{id}/comprobantes-recibidos` | edit | Alta. Requiere `X-Idempotency-Key`. 201. |
| `GET /api/comprobantes-recibidos/{id}` | view | Detalle. |
| `PUT /api/comprobantes-recibidos/{id}` | edit | Edición explícita (cabecera y líneas). No cambia operación ni tipo. |
| `DELETE /api/comprobantes-recibidos/{id}` | edit | Elimina solo el documento. |
| `GET /api/documentos?tipo=RECIBIDO` | facturas:view + view | Listado unificado; `RECIBIDO` aparece también sin filtro de tipo. Los filtros de estado/ambiente (emisión) y de remitos excluyen los recibidos. |

Errores: 400 `VALIDATION` (mensaje de la validación), 404, 403, 409 `CONFLICT` (factura duplicada).

## Diferencias de importes

Se permite guardar documentos cuyo total (suma de líneas) difiera del monto de la operación. La diferencia no se
muestra ni se ajusta automáticamente. Las retenciones no se suman al total facturado. El resumen de la API
(`resumen.diferenciaFacturas`) la sigue calculando por si se necesita más adelante.

## Alta junto con la operación y reintentos

**Modal de operaciones (compra o gasto):** el switch “Cargar con factura”, a la derecha del selector de tipo,
muestra en el mismo formulario los datos de la factura (clase, número, fecha, fecha de vencimiento, emisor) y una tabla de
percepciones. El emisor se precarga con la ficha del proveedor seleccionado (copia editable). Los conceptos de la
factura salen del detalle de la operación: una línea por producto de la compra, o el gasto con su descripción o
categoría. El receptor se toma de la configuración fiscal del tenant al guardar. La factura se valida antes de crear
la operación, así que un dato faltante no deja una compra sin su documento. En las compras, las percepciones suman
al total de la operación (ver “Percepciones en el total de la compra”). El switch recuerda su última posición en el
navegador (`localStorage`, clave `b2car.operaciones.cargarConFactura`).

La operación se crea primero por su circuito existente (pagos y stock incluidos) y después se guarda el documento,
con una clave de idempotencia fija para todos los reintentos. Si el servidor lo rechaza (por ejemplo, porque la
factura está duplicada), la operación se conserva, el error se muestra (nunca como éxito) y se abre el formulario
completo del documento con lo cargado y la misma clave. Reintentar no recrea la operación ni repite pagos o stock, y
si la respuesta se pierde, el reintento devuelve el documento ya creado.

**Alta de gasto desde la cuenta financiera:** sigue con la casilla “Cargar factura o retención…”, que abre el
formulario sobre el gasto ya persistido.

**Detalle de la operación.** El botón “Adjuntar factura o retención” registra un documento sin alterar cargos, total
ni saldo. Los documentos aparecen en “Documentos asociados”.

**Detalle del documento:** `/facturacion/recibidos/{id}` (permiso `comprobantes_recibidos:view`). Se abre desde el
listado de Documentos y desde “Documentos asociados”, con la misma estructura que el detalle de una factura emitida:
resumen (operación de origen, fecha, fecha de vencimiento, número, emisor), detalle de conceptos y percepciones con totales, datos
fiscales de emisor y receptor y datos informados. Con `comprobantes_recibidos:edit` se edita o elimina desde ahí.

Las compras automáticas desde arreglos no ofrecen la carga en el mismo paso: el documento se agrega desde el
detalle de la compra.

## Percepciones en el total de la compra

La migración `20261116120000_operaciones_cargos.sql` crea `operaciones_cargos` con una FK directa a
`operaciones.id` y borrado en cascada. El alta y la edición de cargos comparten la validación y el guardado.

En una COMPRA creada con el switch “Cargar con factura” activo, cada percepción de la factura se guarda dos veces,
en la misma alta:

- como cargo de la operación en `operaciones_cargos` (tipo `PERCEPCION`, código, descripción, importe), dentro de
  `rpc_crear_operacion_con_stock` (parámetro `p_cargos`), en la misma transacción que la compra;
- como línea `PERCEPCION` de la factura recibida (dato fiscal), que se guarda después.

`operaciones.monto_total = Σ (cantidad × unitario de operaciones_lineas) + Σ operaciones_cargos.importe`. Los cargos
no son mercadería: no mueven stock, no tienen alícuota de IVA y no cambian el costo de los productos.

**Pagos:** todo el circuito de pagos ya trabaja contra `monto_total`, así que incluye las percepciones sin cambios:

- En el formulario, el “TOTAL OPERACIÓN”, el pago sugerido y la validación de pagos usan productos + percepciones.
- Pago parcial: el monto inicial debe ser menor que productos + percepciones (validado en el formulario y en la API).
  Ejemplo: productos $2.000 + percepciones $200 con un pago de $1.000 quedan con total $2.200, estado PARCIAL y saldo
  $1.200.
- Pago total por defecto (sin detalle de pagos): se registra por productos + percepciones.
- `estado_pago` lo recalcula el trigger de `operaciones` comparando `total_pagado` con `monto_total`; los pagos
  posteriores (`rpc_registrar_pago_operacion`) se limitan al saldo y las anulaciones lo recalculan igual.
- La cuenta corriente y el saldo del proveedor usan `monto_total`: la deuda incluye las percepciones.

**Edición de una compra.** “Editar cargos” permite ingresar cargos o copiar las percepciones de una factura
asociada. La copia reemplaza la lista del formulario. Al guardar, `PUT /api/operaciones/{id}` invoca la variante
de `rpc_actualizar_operacion` con `p_cargos`. Omitir la lista conserva los cargos y enviar `[]` los quita.

El guardado conserva pagos y stock. El total se ajusta por la diferencia entre cargos nuevos y anteriores y el
estado de pago se recalcula con el trigger existente. Un total menor a lo pagado se rechaza. La edición requiere
`operaciones:edit` y copiar una factura requiere `comprobantes_recibidos:view`. Las percepciones de gastos
quedan en la factura. Si falla el guardado documental luego del alta, reintentar el comprobante conserva los cargos
confirmados en la compra.

El detalle de la operación muestra las percepciones en una tabla debajo de los productos.

## Borrado de operaciones documentadas

El trigger `comprobantes_recibidos_proteger_operacion` (`BEFORE DELETE ON operaciones`) rechaza el borrado con
SQLSTATE `P1801` mientras existan documentos, y la FK `RESTRICT` respalda la regla ante concurrencia. Como todas
las RPC de borrado terminan en `DELETE FROM operaciones`, aplica a todos los puntos de entrada
(`DELETE /api/operaciones/{id}`, `DELETE /api/gastos/{id}`, borrados en lote y cascadas) y la transacción
completa se revierte, sin borrados parciales ni reversas de pagos o stock. La API responde 409 con:
“La operación tiene facturas o retenciones asociadas. Eliminá primero esos documentos para poder borrarla.”

Procedimiento: eliminar los documentos desde su pantalla de detalle y luego borrar la operación, que vuelve
a regirse por su circuito vigente. `eliminar_tenant` borra los documentos antes que las operaciones.

## Pendiente

- Reporte fiscal de compras: bloqueado por P-MAP (fuente de netos/IVA/bases de las 24 columnas base a partir de
  líneas libres) y P-REP (fecha de selección, formatos, moneda/cotización, identificación de retenciones y su
  disposición en el archivo). No se infieren importes fiscales del texto de las líneas.
- Moneda: los importes se guardan sin moneda ni cotización (P-REP).
- Verificación en DB local desechable y pruebas automatizadas de los escenarios de la spec.
