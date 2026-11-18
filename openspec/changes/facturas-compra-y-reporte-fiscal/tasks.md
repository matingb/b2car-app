# Tasks

La gestión documental conserva los cargos y el saldo. La edición de cargos de compras ajusta el saldo respetando los pagos registrados. Las retenciones se registran para consulta y reporte.

**Dependencias:** resolver P-MAP antes de implementar la fuente de importes fiscales y los detalles aplicables de P-REP antes de su bloque de carga/exportación. Las reglas de relación, borrado, duplicados, diferencias, líneas manuales y columnas dinámicas ya están definidas. Persistencia y acceso preceden a API/UI; todos los bloques deben respetar la invariancia financiera y de stock.

## 1. Completar el contrato y las decisiones técnicas

- [ ] 1.1 Resolver P-MAP con la respuesta del usuario: importes fiscales resumen manuales o mapeo explícito de líneas a columnas base. Verificar un ejemplo que complete las columnas de ventas sin inferir impuestos desde texto ni calcular porcentajes, manteniendo solo CONCEPTO/PERCEPCION como tipos de línea.
- [ ] 1.2 Cerrar P-REP: fecha por tipo, formatos, moneda/cotización, identificación propia de retenciones y disposición de su detalle/resumen. Verificar una muestra con las mismas 24 columnas base de ventas, percepciones sugeridas/libres y total de retenciones; no reabrir su inclusión ni las columnas dinámicas.
- [ ] 1.3 Concretar técnicamente normalización de CUIT/número y etiquetas de percepciones, permisos equivalentes inicialmente a ventas, frontera de guardado/reintento e historial interno. Verificar ejemplos de duplicados, agrupación de columnas y secuencias de fallo, documentando decisiones dentro de las reglas acordadas.
- [ ] 1.4 Actualizar los artefactos con los cierres anteriores y coordinar el bloqueo de borrado con el contrato operativo vigente. Verificar coherencia y validación estricta de OpenSpec, sin cambios financieros ni reescritura del cambio histórico de ledgers.

## 2. Persistencia e integridad

- [ ] 2.1 Crear migraciones aditivas de datos fiscales de proveedor, cabecera propia FACTURA/RETENCION, FK obligatoria a una operación y líneas CONCEPTO/PERCEPCION. Verificar en DB local desechable autorizada número/posición de IVA requeridos para factura, varias facturas por operación, rechazo de operación ausente y montos manuales; no editar el esquema declarativo a mano.
- [ ] 2.2 Implementar unicidad de factura vigente por tenant, CUIT emisor y número, con normalización acordada. Verificar alta, edición y solicitudes concurrentes en operaciones distintas sin permitir duplicados; documentar claves y errores.
- [ ] 2.3 Incorporar restricción de borrado operativo mientras existan documentos y preservar eliminación de documentos. Verificar FACTURA y RETENCION, gasto/compra, borrado alternativo y concurrencia con altas, sin borrados parciales ni reversas financieras/stock en solicitudes rechazadas; documentar el procedimiento de eliminar documentos primero.
- [ ] 2.4 Incorporar RLS, grants mínimos, índices y permisos por rol/plan. Verificar aislamiento de cabeceras/líneas y relaciones entre tenants, consulta sin gestión y acceso inicial equivalente a facturación de ventas; no crear tablas de imputación financiera ni Storage.

## 3. API y servicios

- [ ] 3.1 Ampliar configuración fiscal de proveedor, incluida posición de IVA, y precarga de documento con copia editable. Verificar que editar una factura no modifica la ficha y editar la ficha no reescribe documentos históricos; documentar campos y contratos.
- [ ] 3.2 Implementar repositorio/servicio y rutas de creación, consulta, edición y eliminación documental, con líneas libres e importes manuales y la fuente fiscal acordada en P-MAP. Verificar A/B/C, campos requeridos, selector abierto, duplicados y sesión/tenant/permisos; documentar errores.
- [ ] 3.3 Integrar carga inicial/posterior en compras y gastos y recuperación de fallos sin recrear operaciones. Verificar factura con diferencia guardada y datos para label informativo, gasto sin proveedor y reintentos sin duplicar pagos/stock; documentar la secuencia.
- [ ] 3.4 Extender documentos asociados y listado unificado y aplicar el bloqueo en todos los endpoints de borrado operativo. Verificar procedencia/tipos y error por documentos asociados, sin exigir ambiente/certificados ARCA para registros manuales; mantener los contratos de facturas emitidas y remitos.

## 4. Formulario y gestión en Documentos

- [ ] 4.1 Ampliar ficha de proveedor y formulario de documentos con precarga editable, número y posición de IVA requeridos, dos tipos de línea y montos manuales. Verificar líneas de texto libre y percepciones Ganancias/IVA/IIBB Buenos Aires/CABA o personalizadas, sin recálculo por porcentaje al cambiar selecciones.
- [ ] 4.2 Permitir factura opcional al crear operación, carga posterior y edición/eliminación desde detalle y Documentos; adaptar compras automáticas y los dos puntos de gastos. Verificar asociación a exactamente una operación y registro de retención sin pasar por pagos, sin borradores ni subida de archivos.
- [ ] 4.3 Mostrar label informativo por diferencias y error de factura duplicada, y explicar bloqueo de borrado de operación. Verificar guardado permitido de factura 121000 en compra 120000 y eliminación de documentos antes del borrado operativo; documentar el flujo.
- [ ] 4.4 Aplicar permisos de consulta/gestión y presentar documentos recibidos en el listado existente. Verificar usuarios con/sin permisos y edición/eliminación de retenciones con invariancia de pagos/saldos/stock; actualizar docs/comprobantes-recibidos.md.

## 5. Reporte con percepciones dinámicas

- [ ] 5.1 Implementar selección por tenant/período y lectura consistente de todos los documentos y percepciones. Verificar 1205 facturas, una percepción exclusiva de la última página, filtros y cambios concurrentes, sin columnas o archivos parciales; documentar fecha/moneda acordadas.
- [ ] 5.2 Implementar las mismas 24 columnas base de ventas y la fuente manual explícita de P-MAP. Verificar identidad de encabezados/orden, significado emisor/receptor, desconocidos y una fila por factura, incluidas dos facturas de una operación y diferencias con el monto operativo.
- [ ] 5.3 Agregar una columna por cada percepción distinta del conjunto completo de facturas seleccionadas, con agrupación normalizada y sumas de importes manuales. Verificar percepciones sugeridas y libres, líneas repetidas por factura, categorías fuera del filtro y selección vacía; documentar la formación de columnas.
- [ ] 5.4 Incorporar detalle y total de documentos RETENCION separados de los totales facturados según P-REP. Verificar retenciones 6000 + 4000 = 10000, corrección/eliminación reflejadas y ausencia de cambios financieros, sin inferir retenciones desde pagos.
- [ ] 5.5 Implementar formatos y descarga con permisos, filtros y caché privada. Verificar conciliación de columnas dinámicas entre formatos habilitados, nombres personalizados con apariencia de fórmula, identificadores como texto y regresión del reporte de ventas con sus columnas/universo intactos; documentar el contrato de exportación.

## 6. Verificación transversal

- [ ] 6.1 Ejecutar el flujo completo con datos sintéticos: proveedor, compra/gasto, varias facturas y retenciones, diferencia permitida, duplicado rechazado, edición/eliminación y borrado operativo bloqueado. Verificar compra 121000 con pago 115000 que conserva saldo 6000 al cargar/editar/eliminar retención 6000 y conciliar el reporte, cuentas y stock.
- [ ] 6.2 Ejecutar tests afectados, typecheck, lint focalizado, git diff --check y validación estricta de OpenSpec tras implementar. Registrar evidencia por escenario, incluidos todos los puntos de borrado y percepciones de última página, sin marcar como resueltos los pendientes de negocio abiertos.

## 7. Cargos de operación

- [x] 7.1 Vincular los cargos con una FK a la operación base, conservar el borrado en cascada y verificar la consulta directa desde el detalle de operaciones.
- [x] 7.2 Editar cargos de una compra desde el detalle. Permitir copiar las percepciones de una factura asociada y ajustar el total y el saldo al confirmar, conservando pagos, stock y factura. Verificar reemplazo y validación del importe ya pagado.
- [x] 7.3 Validar alta con cargos y carga posterior de una factura con percepciones, además de permisos de edición y concurrencia con pagos. Verificar que adjuntar o editar solo la factura conserva el saldo.

## Workflow follow-up

- Cerrar P-MAP y los detalles aplicables de P-REP antes de implementar el reporte fiscal de compras.
- Mantener las retenciones como documentos informativos y el recálculo del saldo limitado al guardado operativo de cargos.
- Conservar sin borradores ni archivos/fotos; “adjuntar documento” significa asociar el registro estructurado.
- No agregar NC/ND de compra ni comprobantes especiales dentro de esta versión.
- Archivar solo el alcance implementado y verificado.
