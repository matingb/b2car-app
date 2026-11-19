# Proposal

## Why

Los clientes necesitan registrar documentos de proveedores asociados a compras y gastos y obtener un reporte fiscal de compras comparable al de ventas. Las retenciones se registran y totalizan como documentos informativos, sin modificar el circuito financiero de B2Car.

Revisión con las definiciones del 13/11/2026. Esta versión sustituye el efecto cancelatorio de retenciones planteado anteriormente y concreta relación, duplicados, borrado, líneas manuales y columnas del reporte.

## What Changes

- Admitir varios documentos por operación COMPRA/GASTO; cada documento pertenece obligatoriamente a una sola operación. Carga opcional al crear la operación y también posterior, con edición y eliminación, sin borradores.
- Configurar datos fiscales del proveedor, precargarlos y permitir modificarlos en cada documento conservando su copia histórica. Exigir número de factura y posición de IVA del proveedor; conservar CUIT emisor para identificar y controlar duplicados.
- Registrar facturas normales A/B/C con dos tipos de líneas, CONCEPTO y PERCEPCION. En facturas A, permitir elegir la alícuota por concepto y confirmar la base y el IVA facturado por alícuota. En facturas B, permitir informar IVA contenido por separado, solo como dato informativo. Las percepciones conservan su carga manual.
- Ofrecer un selector de percepciones abierto, con accesos rápidos a Ganancias, IVA, IIBB Buenos Aires e IIBB CABA, y posibilidad de ingresar otras.
- Registrar retenciones como otro tipo de documento relacionado, con líneas, descripciones e importes para consulta y totalización en el reporte. Crear, editar o eliminar estos documentos no modifica pagos, saldos, estados de pago, cuentas ni stock, tanto en compras como en gastos.
- Vincular los cargos a la operación base. Al crear una compra con factura, sus percepciones integran el total como cargos de la compra. Al editar la compra se pueden actualizar sus cargos. Adjuntar, editar o eliminar una factura por su circuito documental conserva los cargos, el importe y el saldo de la operación.
- Al crear una compra y una factura A en el mismo formulario, sumar al total operativo el IVA calculado por alícuota sobre las bases de sus líneas y las percepciones ingresadas. Conservar los precios netos en las líneas de la compra y el identificador de tasa por línea. Mantener informativas las diferencias restantes; adjuntar o editar documentos posteriormente no recalcula la operación.
- Impedir eliminar una operación mientras tenga documentos asociados; permitir eliminar primero los documentos. Rechazar facturas duplicadas del mismo CUIT emisor y número de factura dentro del tenant, aunque se intenten asociar a otra operación.
- Mantener tablas propias, separadas de facturación electrónica, e integrar su gestión de forma transparente en Documentos. El listado admite el permiso de ventas o el de documentos recibidos y limita las fuentes que consulta a los permisos efectivos.
- Exportar las facturas con 12 columnas fijas: fecha, razón social, número, CUIT, tipo, neto, IVA, no gravado, percepción de IVA, percepción de IIBB, total y concepto de gasto. La columna IVA suma todas las alícuotas confirmadas; las percepciones de IVA e IIBB usan sus columnas propias. Cada otra percepción agrega su columna solo si aparece y también integra el total. Mostrar retenciones por separado y sin efectos financieros.
- Mantener fuera del alcance archivos, fotos, adjuntos, NC/ND de compras, emisión/verificación ante ARCA, OCR/importación y determinación de crédito fiscal o regímenes tributarios.

## Capabilities

### New Capabilities

- `comprobantes-recibidos`: registro y gestión de documentos de compras/gastos, identidad del proveedor, líneas libres de conceptos/percepciones, retenciones informativas, validación de duplicados y protección del borrado de operaciones.
- `reportes-fiscales-compras`: detalle de facturas con 12 columnas fijas, columnas adicionales solo para otras percepciones presentes, IVA totalizado entre alícuotas confirmadas y retenciones separadas.

### Modified Capabilities

- `operaciones-compra`: en el alta conjunta con factura A, el total operativo incorpora el IVA calculado desde las bases netas y sus alícuotas. El alcance financiero se limita a ese alta; la gestión documental posterior conserva el total y el saldo.

El bloqueo de borrado de operaciones documentadas y los cargos de compra amplían el comportamiento operativo descrito en rediseno-operaciones-ledgers y se especifican en comprobantes-recibidos.

## Impact

- **Datos.** Tablas propias de documentos y líneas, relación obligatoria a una operación, datos fiscales de proveedores y unicidad de facturas. Incorporar `iva_alicuota_id` por concepto y conservar la base y el IVA confirmados por alícuota en cada factura A. Usar migraciones con RLS y grants.
- **API/UI:** CRUD y asociación inicial/posterior, selector abierto de percepciones, label de diferencias, error de duplicado y bloqueo de eliminación de operaciones documentadas, incluidos todos sus puntos de entrada.
- **Finanzas:** crear una compra con factura A suma el IVA calculado a su total operativo antes de aplicar pagos y saldo; crear o editar cargos también afecta su total y saldo, respetando pagos registrados. La gestión documental posterior conserva esos valores. Las retenciones se registran para consulta y reporte.
- **Exportación:** conservar el reporte de ventas y su contrato; compras usa 12 columnas fijas y agrega columnas para otras percepciones presentes. IVA se totaliza entre las alícuotas confirmadas y las retenciones se presentan por separado.
- **Exportación confirmada.** Selección por fecha del documento, CSV y XLSX, pesos argentinos sin conversión, 12 columnas fijas más columnas para otras percepciones presentes, IVA totalizado entre tasas confirmadas y número de retención libre y opcional con detalle y total separados. Ver [diseño](design.md#definiciones-restantes).
