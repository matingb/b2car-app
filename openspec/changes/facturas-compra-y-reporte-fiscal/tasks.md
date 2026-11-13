# Tasks

Plan revisado el 12/11/2026 con las definiciones del usuario. Las tareas siguen pendientes de implementación. No reabrir los acuerdos de design.md; resolver únicamente los aspectos que permanecen en D8 y verificar cada bloque con sus propios tests y documentación.

**Dependencias:** cerrar el pendiente aplicable de la sección 1 antes del bloque que depende de él. Persistencia precede a API e imputaciones; los documentos de retención y su efecto financiero deben quedar coherentes antes de habilitarlos en UI. El reporte usa el contrato aprobado. No hay tareas de adjuntos ni borradores. GASTO conserva su alcance previo y requiere cerrar las particularidades de integración en P-ALC.

## 1. Cerrar los detalles que siguen abiertos

- [ ] 1.1 Resolver P-REL y P-ALC: relación de un documento con varias compras o sin operación, conciliación de sumas y particularidades de gastos, incluida la aplicación o no de retenciones a GASTO. Verificar con ejemplos aprobados, conservando varios documentos por compra y la carga de facturas en gastos del alcance previo.
- [ ] 1.2 Resolver P-ID: campos fiscales configurables/obligatorios, receptor, compras y gastos sin proveedor y alcance por taller. Verificar una matriz de datos y precargas, sin reabrir la edición local e independencia histórica confirmadas.
- [ ] 1.3 Resolver P-CAT: alícuotas admitidas, identificación/autorización informada, categorías/jurisdicciones y validaciones entre componentes y total. Verificar muestras A/B/C y conceptos fuera de las sugerencias, manteniendo IVA por alícuota y carga abierta.
- [ ] 1.4 Resolver P-CICLO: duplicados, historial/estrategia de eliminación y efecto del borrado de la compra sobre documentos e imputaciones. Verificar escenarios aprobados de duplicación y borrado, manteniendo guardado directo, edición y eliminación sin borradores.
- [ ] 1.5 Resolver el detalle de P-RET: carga independiente o junto al pago, factura previa, vínculos/distribución, parcialidades, límites, sobrecancelaciones, anulación de pagos y representación de pago efectivo frente a total cancelado. Verificar ejemplos de saldo y una matriz de transiciones; pago 115000 más retención 6000 ya está confirmado como cancelación de una compra de 121000.
- [ ] 1.6 Resolver P-UX: permisos concretos y asignación inicial equivalente a ventas, secuencia de guardado/reintento y acceso en compras automáticas desde arreglos. Verificar matriz por rol/plan y secuencias de éxito/fallo para compra, documento e imputación, sin adjuntos.
- [ ] 1.7 Resolver P-REP con una muestra basada en columnas de ventas: identificación del proveedor, IVA por alícuota, conceptos abiertos, presentación de retenciones, formatos, fechas y moneda. Verificar conciliación de la muestra y elegir extracción consistente frente a altas, cambios y bajas.
- [ ] 1.8 Actualizar los artefactos con los cierres de 1.1 a 1.7 y coordinar la ampliación del estado/saldo de compras con el contrato vigente de ledgers, sin reescribir su historia. Verificar coherencia de ejemplos, pendientes y dependencias con validación estricta de OpenSpec.

## 2. Persistencia, datos fiscales y acceso

- [ ] 2.1 Crear migraciones aditivas de datos fiscales de proveedores y documentos separados de facturas_electronicas, con tipos FACTURA/RETENCION y detalle según el tipo. Verificar en DB local desechable autorizada A/B/C, IVA por alícuota, conceptos abiertos y ausencia de campos obligatorios de factura en retenciones; no editar el esquema declarativo manualmente.
- [ ] 2.2 Implementar la relación elegida que admita varios documentos por compra y la política de identidad/duplicados/ciclo. Verificar dos facturas de 60500 para una compra de 121000 y los casos de P-REL/P-CICLO; documentar el modelo en docs/comprobantes-recibidos.md.
- [ ] 2.3 Incorporar RLS, grants mínimos, validaciones de pertenencia e índices para cabeceras, detalles, vínculos e imputaciones. Verificar aislamiento entre tenants y acceso por permisos con pruebas SQL/integración.
- [ ] 2.4 Crear la persistencia de imputaciones de retención conforme a P-RET, con trazabilidad y garantías de integridad/concurrencia. Verificar alta, modificación, eliminación y reintento sin doble cancelación; documentar las invariantes financieras.

## 3. API de proveedores y documentos

- [ ] 3.1 Ampliar el contrato de configuración fiscal del proveedor y su edición con las capas existentes. Verificar tests de validación, campos opcionales/requeridos y permisos, y documentar los campos que precarga el formulario.
- [ ] 3.2 Implementar repositorio y servicio de documentos con copias históricas editables, A/B/C, IVA por alícuota y conceptos abiertos. Verificar que modificar la precarga no cambia al proveedor y cambiar su ficha no reescribe documentos; cubrir importes y conceptos no sugeridos.
- [ ] 3.3 Implementar rutas de alta, consulta, edición y eliminación, con guardado directo y permisos. Verificar sesión, validaciones, duplicados, acceso de solo consulta y tenant; documentar contratos y errores sin ciclo de borradores ni adjuntos.
- [ ] 3.4 Integrar la asociación inicial/posterior sin recrear operaciones y con recuperación de fallos según P-UX. Verificar una compra de 121000 con pago 60000 y stock recibido, un gasto sin proveedor y un reintento después de fallar el documento sin duplicar operación, pagos ni inventario.

## 4. Retenciones y cancelación de deuda

- [ ] 4.1 Implementar el registro manual de RETENCION y su imputación conforme al flujo aprobado, reutilizando la cabecera documental y detalle propio. Verificar que no requiere completar una factura A/B/C ni se genera automáticamente desde IVA o conceptos libres; documentar su vínculo con compra/pago/factura.
- [ ] 4.2 Ampliar saldo y estado de pago de compras para contemplar pagos efectivos más retenciones vigentes imputadas, sin alterar el monto pactado ni el total de factura. Verificar compra 121000, pago 115000 y retención 6000 con saldo 0 y estado saldado, sin otro movimiento de caja, cuenta o stock.
- [ ] 4.3 Implementar corrección y eliminación atómicas de retención e imputación. Verificar que corregir 6000 a 5000 deja saldo 1000 y eliminar la retención original deja saldo 6000, conservando pago 115000; cubrir fallos intermedios y reintentos.
- [ ] 4.4 Adaptar cuenta corriente del proveedor, resúmenes, consultas y validación de pagos posteriores a la regla de cancelación. Verificar compra 121000 con pago 100000 y retención 6000 con saldo utilizable de 15000 en todos los consumidores, diferenciando efectivo de cancelado según el contrato acordado.
- [ ] 4.5 Aplicar políticas aprobadas de límites, parcialidades, concurrencia y anulación de pagos/retenciones. Verificar solicitudes repetidas y competidoras sin duplicar documentos o cancelaciones ni producir una salida de caja ficticia; documentar cómo se recuperan errores.

## 5. Gestión en Documentos y compras

- [ ] 5.1 Ampliar la ficha de proveedor y el formulario manual de documentos con precarga editable, A/B/C, IVA por alícuota y conceptos agregables. Verificar interacciones con proveedor presente/ausente y descripción libre, y guardado directo sin adjuntos ni borradores.
- [ ] 5.2 Permitir factura opcional durante la creación de compra, alta posterior y edición/eliminación desde el detalle; adaptar los puntos de alta de gastos. Verificar varios documentos independientes, gasto sin proveedor y recuperación de fallos; cubrir compras automáticas según P-UX y documentar el flujo.
- [ ] 5.3 Integrar documentos de compra y retenciones en listado, filtros, detalle y documentos asociados existentes. Verificar distinción entre emitidos/recibidos y tipos, sin exponer tablas ni exigir ambiente/certificados de emisión para recibidos; mantener facturas emitidas y remitos.
- [ ] 5.4 Aplicar permisos de consulta/gestión con asignación inicial equivalente a ventas y mostrar saldo/estado correctos tras gestionar retenciones. Verificar usuarios con/sin permiso y correcciones que reabren saldo, y actualizar docs/comprobantes-recibidos.md.

## 6. Reporte de compras

- [ ] 6.1 Implementar selección por tenant, período/criterio acordado y documentos vigentes, con lectura consistente y paginación completa. Verificar 1205 facturas, fechas distintas de compra/carga/pago y correcciones/eliminaciones concurrentes sin archivos parciales; documentar el criterio final.
- [ ] 6.2 Implementar filas por factura y totales desde los documentos, adaptando las columnas de ventas para proveedor, IVA por alícuota y conceptos abiertos. Verificar dos facturas de la misma compra, múltiples pagos/componentes y el ejemplo neto 300000 + IVA 63000 = total 363000, sin multiplicación por relaciones.
- [ ] 6.3 Implementar la representación de retenciones aprobada en P-REP/P-RET y los formatos confirmados, reutilizando utilidades compatibles. Verificar compra saldada con retención que conserva total facturado 121000, retenciones contadas una sola vez, identificación de conceptos libres, moneda y valores desconocidos; si se confirman CSV/XLSX, conciliar ambos.
- [ ] 6.4 Incorporar endpoint y entrada UI de exportación con el permiso acordado. Verificar autorización, caché privada, filtros inválidos, período vacío, identificadores como texto y protección de fórmulas; documentar columnas y comprobar la regresión del reporte de ventas de 24 columnas.

## 7. Verificación transversal

- [ ] 7.1 Ejecutar el flujo completo local autorizado con datos ficticios: configurar proveedor, crear compra con/sin factura y gasto con factura, agregar otra factura, registrar pago/retención y editar/eliminar documentos. Verificar saldo en compra y cuenta corriente, conservación de caja/stock y conciliación del reporte, según los contratos de integración acordados.
- [ ] 7.2 Ejecutar tests afectados, typecheck, lint focalizado, git diff --check y validación estricta de OpenSpec tras implementar. Verificar evidencia por escenario y documentar límites, sin marcar como implementados los pendientes que sigan abiertos.

## Workflow follow-up

- Cerrar las definiciones aplicables antes de implementar con openspec-apply-change.
- Las retenciones y su cancelación de deuda ya forman parte del alcance; no tratarlas como un bloque íntegramente diferido.
- La carga de retención independiente del pago sigue sin confirmar; no implementarla por aceptación implícita.
- No implementar adjuntos, borradores, NC/ND de compra ni comprobantes especiales dentro de este cambio.
- Archivar únicamente el alcance implementado y verificado.
