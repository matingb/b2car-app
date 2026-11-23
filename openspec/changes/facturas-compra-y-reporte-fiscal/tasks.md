# Tasks

La gestión documental conserva los cargos y el saldo. La edición de cargos de compras ajusta el saldo respetando los pagos registrados. Las retenciones se registran para consulta y reporte.

**Dependencias.** Implementar el desglose fiscal confirmado antes de conectarlo al reporte. Cerrar los detalles aplicables de P-REP antes de su bloque de carga y exportación. La persistencia y el acceso preceden a la API y a los formularios. La gestión documental conserva los pagos, el saldo y el stock.

## 1. Completar el contrato y las decisiones técnicas

- [x] 1.1 Preparar ejemplos de implementación del desglose definido en D3 y D7. Conciliar una factura A con dos alícuotas, un documento histórico sin desglose y una percepción de IVA.
- [x] 1.2 Cerrar P-REP: fecha por tipo, formatos, moneda/cotización, identificación propia de retenciones y disposición de su detalle/resumen. Definir 11 columnas fijas, una de ellas para percepción de IVA y otra con el IVA de todas las alícuotas confirmadas. Las demás percepciones agregan columnas cuando aparecen, con una por jurisdicción de IIBB.
- [x] 1.3 Concretar técnicamente normalización de CUIT/número y etiquetas de percepciones, permisos equivalentes inicialmente a ventas, frontera de guardado/reintento e historial interno. Verificar ejemplos de duplicados, agrupación de columnas y secuencias de fallo, documentando decisiones dentro de las reglas acordadas.
- [x] 1.4 Actualizar los artefactos con los cierres anteriores y coordinar el bloqueo de borrado con el contrato operativo vigente. Verificar coherencia y validación estricta de OpenSpec, sin cambios financieros ni reescritura del cambio histórico de ledgers.

## 2. Persistencia e integridad

- [ ] 2.1 Crear migraciones aditivas de datos fiscales de proveedor, cabecera propia FACTURA/RETENCION, FK obligatoria a una operación y líneas CONCEPTO/PERCEPCION. Verificar en DB local desechable autorizada número/posición de IVA requeridos para factura, varias facturas por operación, rechazo de operación ausente y montos manuales; no editar el esquema declarativo a mano.
- [ ] 2.2 Implementar unicidad de factura vigente por tenant, CUIT emisor y número, con normalización acordada. Verificar alta, edición y solicitudes concurrentes en operaciones distintas sin permitir duplicados; documentar claves y errores.
- [ ] 2.3 Incorporar restricción de borrado operativo mientras existan documentos y preservar eliminación de documentos. Verificar FACTURA y RETENCION, gasto/compra, borrado alternativo y concurrencia con altas, sin borrados parciales ni reversas financieras/stock en solicitudes rechazadas; documentar el procedimiento de eliminar documentos primero.
- [ ] 2.4 Incorporar RLS, grants mínimos, índices y permisos por rol/plan. Verificar aislamiento de cabeceras/líneas y relaciones entre tenants, consulta sin gestión y acceso inicial equivalente a facturación de ventas; no crear tablas de imputación financiera ni Storage.
- [ ] 2.5 Agregar `iva_alicuota_id` nullable a `comprobantes_recibidos_lineas` y persistir la base gravada y el IVA discriminado confirmados por factura A y alícuota. Validar el catálogo de ARCA y la aplicación del campo a conceptos gravados. Verificar que la migración no atribuya tasas ni importes a documentos históricos.
- [ ] 2.6 Agregar `precios_incluyen_iva` a `operaciones_compra` con valor predeterminado `true` para conservar el comportamiento histórico. En el alta conjunta de COMPRA con factura A, guardar `false` y hacer que la RPC sume el IVA calculado por alícuota al total operativo antes de pagos/saldo, manteniendo bases netas en las líneas y sumando percepciones una sola vez. Verificar tasas mixtas, redondeo a centavos, pagos y valores predeterminados para B/C/sin factura.
- [ ] 2.7 Agregar una migración de compatibilidad para instalaciones que ya registraron las versiones anteriores de comprobantes/cargos. Incorporar columnas y helpers faltantes sin reescribir datos fiscales históricos, y dejar disponibles las RPC de edición y guardado fiscal requeridas por la API. Verificar tanto la secuencia completa como el esquema que quedó en `b949a004`.

## 3. API y servicios

- [ ] 3.1 Ampliar configuración fiscal de proveedor, incluida posición de IVA, y precarga de documento con copia editable. Verificar que editar una factura no modifica la ficha y editar la ficha no reescribe documentos históricos; documentar campos y contratos.
- [ ] 3.2 Implementar repositorio, servicio y rutas de creación, consulta, edición y eliminación documental con líneas libres, importes manuales y desglose fiscal confirmado. Verificar persistencia y lectura de alícuotas por concepto, confirmación por factura, A/B/C, campos requeridos, selector abierto, duplicados, sesión, tenant y permisos. Documentar errores.
- [ ] 3.3 Integrar carga inicial/posterior en compras y gastos y recuperación de fallos sin recrear operaciones. Verificar factura con diferencia guardada y datos para label informativo, gasto sin proveedor y una respuesta perdida después del commit con y sin pagos iniciales; confirmar que la misma clave recupera la compra y no repite operación, pagos o stock antes de guardar un documento único.
- [ ] 3.4 Extender documentos asociados y listado unificado y aplicar el bloqueo en todos los endpoints de borrado operativo. Verificar procedencia/tipos, listado con solo permiso de ventas o solo recibidos y rechazo sin ambos; confirmar el filtrado de fuentes del lado servidor, sin exigir ambiente/certificados ARCA para registros manuales; mantener los contratos de facturas emitidas y remitos.
- [x] 3.5 Validar la conciliación del desglose confirmado antes de persistir altas y ediciones. En centavos, rechazar bases más IVA superiores al total de conceptos de la factura, con percepciones separadas. Verificar el rechazo de 34200,00 de desglose para 12100,00 de conceptos, la aceptación de desgloses parciales y la conservación del redondeo y las percepciones informados. Mantener permitida la diferencia respecto del monto operativo.

## 4. Formulario y gestión en Documentos

- [ ] 4.1 Ampliar ficha de proveedor y formulario de documentos con precarga editable, número y posición de IVA requeridos, dos tipos de línea y montos manuales. Verificar líneas de texto libre y que las percepciones sugeridas o personalizadas conserven su importe manual al cambiar la selección.
- [ ] 4.2 Permitir factura opcional al crear operación, carga posterior y edición/eliminación desde detalle y Documentos; adaptar compras automáticas y los dos puntos de gastos. Verificar asociación a exactamente una operación y registro de retención sin pasar por pagos, sin borradores ni subida de archivos.
- [ ] 4.3 Mostrar label informativo por diferencias y error de factura duplicada, y explicar bloqueo de borrado de operación. Verificar guardado permitido de factura 121000 en compra 120000 y eliminación de documentos antes del borrado operativo; documentar el flujo.
- [ ] 4.4 Aplicar permisos de consulta/gestión y presentar documentos recibidos en el listado existente. Verificar usuarios con/sin permisos y edición/eliminación de retenciones con invariancia de pagos/saldos/stock; actualizar docs/comprobantes-recibidos.md.
- [ ] 4.5 Completar el flujo «Cargar con factura» en el alta de compras con alícuotas editables por concepto y desglose automático de factura A, desde el formulario hasta `buildFacturaCompraInput` y la consulta del documento guardado. En compra A, mostrar y enviar el total con IVA calculado además de bases y percepciones. Verificar la precarga operativa de 10,5%, la sugerencia de 21% donde falte la tasa y que el resumen liste «Total IVA [alícuota]: [importe]» por cada tasa y, debajo, conceptos, IVA, percepciones y total de factura. Calcular y guardar base e IVA desde los conceptos sin solicitar confirmación adicional. Permitir aplicar una tasa al conjunto y editar cada concepto tanto en el alta como al adjuntar o editar. Verificar dos facturas con tasas distintas en una compra, tasas mixtas en un documento, redondeo calculado y carga de B/C por total sin alterar su comportamiento; en B, mantener el IVA contenido opcional separado y no discriminado.
- [x] 4.6 Distinguir importes faltantes de ceros explícitos en el formulario y el guardado del desglose. Al agregar una fila o borrar un importe, dejar el campo vacío y pedir que se complete o se quite la fila. Al quitar la última fila, guardar y volver a consultar el desglose como `null`. Verificar el cero ingresado explícitamente y que editar solo la descripción de una factura histórica preserve los datos fiscales ausentes.

## 5. Reporte con percepciones dinámicas

- [ ] 5.1 Implementar selección por tenant/período y lectura consistente de todos los documentos y percepciones. Verificar filtros, cambios concurrentes y sumas completas sin archivos parciales; documentar fecha/moneda acordadas.
- [ ] 5.2 Implementar 11 columnas fijas de facturas en CSV y XLSX. Verificar encabezados y orden, emisor, desglose parcial, Neto e IVA con varias alícuotas, valores ausentes y una fila por factura aunque una operación tenga varias.
- [ ] 5.3 Mapear la percepción de IVA a su columna fija. Agregar una columna por cada otra percepción distinta presente, con una por jurisdicción de IIBB. Verificar que cada importe contribuya una vez a Total.
- [ ] 5.4 Incorporar detalle y total de documentos RETENCION separados de los totales facturados según P-REP. Verificar retenciones 6000 + 4000 = 10000, corrección/eliminación reflejadas y ausencia de cambios financieros, sin inferir retenciones desde pagos.
- [ ] 5.5 Implementar formatos y descarga con permisos, filtros y caché privada. Verificar que las 11 columnas fijas y las adicionales coincidan en CSV/XLSX, el rótulo «IVA» del resumen con todas las alícuotas, textos con apariencia de fórmula y la regresión del reporte de ventas. Documentar el contrato de exportación.

## 6. Verificación transversal

- [ ] 6.1 Ejecutar el flujo completo con datos sintéticos: proveedor, compra/gasto, varias facturas y retenciones, diferencia permitida, duplicado rechazado, edición/eliminación y borrado operativo bloqueado. Verificar alta conjunta de Factura A con tasas mixtas y percepciones, que el total de operación y su pago/saldo incluyan el IVA calculado, y que cargar/editar/eliminar documentos después conserve el saldo. Conciliar el reporte, cuentas y stock.
- [ ] 6.2 Ejecutar tests afectados, typecheck, lint focalizado, git diff --check y validación estricta de OpenSpec tras implementar. Registrar evidencia por escenario, incluidos todos los puntos de borrado y percepciones de última página, sin marcar como resueltos los pendientes de negocio abiertos.

## 7. Cargos de operación

- [x] 7.1 Vincular los cargos con una FK a la operación base, conservar el borrado en cascada y verificar la consulta directa desde el detalle de operaciones.
- [x] 7.2 Editar cargos de una compra desde el detalle. Permitir copiar las percepciones de una factura asociada y ajustar el total y el saldo al confirmar, conservando pagos, stock y factura. Verificar reemplazo y validación del importe ya pagado; el detalle muestra el acceso con permiso de edición incluso sin cargos y abre el modal con base igual al total operativo menos los cargos previos.
- [x] 7.3 Validar alta con cargos y carga posterior de una factura con percepciones, además de permisos de edición y concurrencia con pagos. Verificar que adjuntar o editar solo la factura conserva el saldo.

## Workflow follow-up

- Conectar el desglose confirmado al reporte fiscal de compras y cerrar los detalles aplicables de P-REP.
- Mantener las retenciones como documentos informativos y el recálculo del saldo limitado al guardado operativo de cargos.
- Conservar sin borradores ni archivos/fotos; “adjuntar documento” significa asociar el registro estructurado.
- No agregar NC/ND de compra ni comprobantes especiales dentro de esta versión.
- Archivar solo el alcance implementado y verificado.
