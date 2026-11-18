# Proposal

## Why

Los clientes necesitan registrar documentos de proveedores asociados a compras y gastos y obtener un reporte fiscal de compras comparable al de ventas. Las retenciones se registran y totalizan como documentos informativos, sin modificar el circuito financiero de B2Car.

Revisión con las definiciones del 13/11/2026. Esta versión sustituye el efecto cancelatorio de retenciones planteado anteriormente y concreta relación, duplicados, borrado, líneas manuales y columnas del reporte.

## What Changes

- Admitir varios documentos por operación COMPRA/GASTO; cada documento pertenece obligatoriamente a una sola operación. Carga opcional al crear la operación y también posterior, con edición y eliminación, sin borradores.
- Configurar datos fiscales del proveedor, precargarlos y permitir modificarlos en cada documento conservando su copia histórica. Exigir número de factura y posición de IVA del proveedor; conservar CUIT emisor para identificar y controlar duplicados.
- Registrar facturas normales A/B/C con dos tipos de líneas, CONCEPTO y PERCEPCION. En facturas A, permitir elegir la alícuota por concepto y confirmar la base y el IVA facturado por alícuota. Las percepciones conservan su carga manual.
- Ofrecer un selector de percepciones abierto, con accesos rápidos a Ganancias, IVA, IIBB Buenos Aires e IIBB CABA, y posibilidad de ingresar otras.
- Registrar retenciones como otro tipo de documento relacionado, con líneas, descripciones e importes para consulta y totalización en el reporte. Crear, editar o eliminar estos documentos no modifica pagos, saldos, estados de pago, cuentas ni stock, tanto en compras como en gastos.
- Vincular los cargos a la operación base. Al crear una compra con factura, sus percepciones integran el total como cargos de la compra. Al editar la compra se pueden actualizar sus cargos. Adjuntar, editar o eliminar una factura por su circuito documental conserva los cargos, el importe y el saldo de la operación.
- Permitir guardar documentos cuyos importes difieran de la operación, mostrando un label informativo y sin modificar ninguno de los montos.
- Impedir eliminar una operación mientras tenga documentos asociados; permitir eliminar primero los documentos. Rechazar facturas duplicadas del mismo CUIT emisor y número de factura dentro del tenant, aunque se intenten asociar a otra operación.
- Mantener tablas propias, separadas de facturación electrónica, e integrar su gestión de forma transparente en Documentos, con permisos de acceso inicialmente equivalentes a facturación de ventas.
- Usar las mismas columnas base del reporte de ventas y agregar una columna por cada percepción distinta presente en las facturas seleccionadas. Mostrar también documentos y sumas de retenciones, separados de los totales facturados y sin efectos financieros.
- Mantener fuera del alcance archivos, fotos, adjuntos, NC/ND de compras, emisión/verificación ante ARCA, OCR/importación y determinación de crédito fiscal o regímenes tributarios.

## Capabilities

### New Capabilities

- `comprobantes-recibidos`: registro y gestión de documentos de compras/gastos, identidad del proveedor, líneas libres de conceptos/percepciones, retenciones informativas, validación de duplicados y protección del borrado de operaciones.
- `reportes-fiscales-compras`: detalle y totalización documental con las columnas base de ventas, columnas dinámicas de percepciones y visibilidad de retenciones.

### Modified Capabilities

Ninguna publicada. El bloqueo de borrado de operaciones documentadas y los cargos de compra amplían el comportamiento operativo descrito en rediseno-operaciones-ledgers y se especifican en comprobantes-recibidos.

## Impact

- **Datos.** Tablas propias de documentos y líneas, relación obligatoria a una operación, datos fiscales de proveedores y unicidad de facturas. Incorporar `iva_alicuota_id` por concepto y conservar la base y el IVA confirmados por alícuota en cada factura A. Usar migraciones con RLS y grants.
- **API/UI:** CRUD y asociación inicial/posterior, selector abierto de percepciones, label de diferencias, error de duplicado y bloqueo de eliminación de operaciones documentadas, incluidos todos sus puntos de entrada.
- **Finanzas:** crear o editar cargos de una compra afecta su total y su saldo, respetando los pagos registrados. La gestión documental conserva esos valores. Las retenciones se registran para consulta y reporte.
- **Exportación:** conservar el reporte de ventas y su contrato; usar sus columnas base para compras más la unión de percepciones de las facturas seleccionadas. Retenciones documentales visibles y totalizadas por separado.
- **Detalles restantes.** Fechas, formatos, moneda, identificación específica de retenciones y presentación de su detalle en la exportación. Ver [diseño](design.md#definiciones-restantes).
