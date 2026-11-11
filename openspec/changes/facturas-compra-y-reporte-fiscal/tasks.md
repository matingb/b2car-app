# Tasks

Primera versión para revisión. Las tareas de implementación son una propuesta condicionada a las decisiones indicadas; no autorizan a elegir una alternativa pendiente por omisión. Completar los artefactos de planificación no marca estas tareas como implementadas.

**Dependencias:** la sección 1 cierra los pendientes aplicables del núcleo y actualiza sus contratos antes de las secciones 2 a 6. Persistencia precede a API; API y adjuntos preceden a sus integraciones UI; el reporte usa los contratos revisados. P-RET permanece diferido, con la idea de registrar retenciones al pagar una operación con factura asociada; no hay tareas de implementación de retenciones en este núcleo.

## 1. Cerrar definiciones del núcleo antes de implementar

- [ ] 1.1 Resolver P-REL con casos de una compra/una factura, varios comprobantes y factura que agrupa operaciones; decidir carga independiente y tratamiento de diferencias. Verificar el cierre mediante ejemplos aprobados y una cardinalidad explícita en diseño y escenarios.
- [ ] 1.2 Resolver P-ID para gastos sin proveedor, compras con proveedor opcional, receptor fiscal y alcance por taller. Verificar una matriz de campos obligatorios/precargas y ejemplos de factura vinculada a gasto sin proveedor comercial.
- [ ] 1.3 Resolver P-CAT con muestras anonimizadas: tipos de documento, datos de autorización, IVA total o por alícuota y conceptos adicionales. Verificar un catálogo de carga explícito que no convierta retenciones pendientes ni crédito fiscal en campos implementados.
- [ ] 1.4 Resolver P-CICLO: estados, duplicados, corrección/anulación y efecto del borrado de una operación con comprobante. Verificar escenarios aprobados de duplicado, corrección y borrado; si cambia el contrato de operaciones, incorporar su delta y coordinar la dependencia con ledgers.
- [ ] 1.5 Resolver P-ARCH y P-UX sobre respaldo obligatorio/opcional, formatos, tamaño, cantidad, reemplazo, puntos de entrada, permisos y secuencia de guardado. Verificar una matriz de acceso y secuencias de éxito/fallo para operación, comprobante y archivo.
- [ ] 1.6 Resolver P-REP con una muestra de reporte: columnas, fecha de emisión propuesta, estados, NC/ND, moneda y consistencia ante cambios concurrentes. Verificar el ejemplo conciliado y un mecanismo de extracción que cubra altas, cambios y bajas sin archivos parciales.
- [ ] 1.7 Actualizar propuesta, specs, diseño y esta lista con las decisiones de 1.1 a 1.6, conservando P-RET como pendiente o definiéndolo en una revisión expresamente acordada. Verificar coherencia entre ejemplos, entidades, escenarios y tareas y ejecutar `openspec.cmd validate facturas-compra-y-reporte-fiscal --strict`.

## 2. Persistencia y acceso del modelo revisado

- [ ] 2.1 Crear las migraciones del modelo elegido para cabecera, vínculos, importes y trazabilidad, sin editar el esquema declarativo manualmente. Verificar en una DB local desechable autorizada las relaciones permitidas, integridad monetaria y los ejemplos de P-REL/P-ID/P-CAT.
- [ ] 2.2 Incorporar grants mínimos, RLS, validación de pertenencia de relaciones e índices para vínculos y selección del reporte. Verificar pruebas SQL/integración de aislamiento entre tenants, acceso sin permiso y acceso autorizado, incluyendo hijos y relaciones.
- [ ] 2.3 Implementar la política acordada de unicidad y ciclo de corrección/borrado. Verificar sus casos de concurrencia y vínculo a operaciones sin pérdida o alteración implícita de evidencia; documentar restricciones y política elegidas en `docs/comprobantes-recibidos.md`.

## 3. API de comprobantes y asociación operativa

- [ ] 3.1 Implementar repositorio y servicio de carga/consulta con contratos tipados, snapshots y conservación de importes informados. Verificar tests de repositorio/servicio para IVA total sin alícuotas, cero frente a ausencia, cambios de ficha y datos inválidos; documentar campos admitidos.
- [ ] 3.2 Implementar rutas de alta, consulta y acciones de ciclo acordadas, con validación y permisos de P-UX. Verificar tests de rutas para sesión, errores de validación, duplicado, tenant y permisos; documentar respuestas y códigos de error.
- [ ] 3.3 Integrar asociación y consulta desde compras y gastos sin reejecutar su creación. Verificar con pruebas de integración que una compra por 121000 con pago 60000 y stock recibido conserva esos valores al asociar su factura, y cubrir discrepancia de montos y gasto sin proveedor.
- [ ] 3.4 Implementar la secuencia de guardado y reintento acordada en P-UX. Verificar fallo después de crear la operación y reintento sin duplicar operación, vínculo, pago ni stock; documentar el resultado recuperable para el consumidor.

## 4. Respaldos documentales

- [ ] 4.1 Implementar almacenamiento privado y metadatos de adjuntos según P-ARCH, con permisos de carga/lectura/reemplazo acordados. Verificar archivos admitidos y rechazados y pruebas de acceso directo a un archivo de otro tenant; documentar límites y comportamiento.
- [ ] 4.2 Implementar la coordinación entre archivo y comprobante y la recuperación de fallos parciales. Verificar fallos de subida y de persistencia sin éxito aparente ni duplicación al reintentar; cubrir reemplazo y conservación según el ciclo elegido.

## 5. Carga y consulta en UI

- [ ] 5.1 Implementar el formulario manual y acceso desde compras y gastos usando los componentes y formatos existentes. Verificar pruebas de interacción de identidad fiscal, importes informados, adjuntos y errores, incluyendo operación sin factura y comprobante sin desglose de alícuotas.
- [ ] 5.2 Incorporar consulta/asociación posterior desde el detalle y revisar los puntos de entrada de gastos manuales y compras automáticas desde arreglos conforme a P-UX. Verificar que los flujos incluidos llegan al mismo comprobante sin volver a pagar ni mover stock y que los flujos excluidos quedan explícitamente documentados.
- [ ] 5.3 Aplicar la matriz de permisos de carga/consulta/corrección y mostrar fallos recuperables del guardado. Verificar pruebas de usuario de solo consulta, usuario autorizado y error de asociación; actualizar `docs/comprobantes-recibidos.md` con el flujo aprobado.

## 6. Reporte fiscal de compras

- [ ] 6.1 Implementar la selección del universo revisado por tenant, período y estados con lectura consistente y paginación completa. Verificar pruebas para fechas distintas de compra/carga/pago, 1205 comprobantes, modificaciones concurrentes y fallo intermedio sin archivo parcial; documentar criterio temporal y de selección.
- [ ] 6.2 Implementar filas y resumen desde datos del comprobante, agregando componentes antes de unir relaciones. Verificar una fila con varios pagos/adjuntos, suma neto 300000 + IVA 63000 = total 363000 en el ejemplo acordado, desconocidos parciales y ausencia de retenciones ficticias; cubrir NC/ND o monedas distintas solo si se aprobaron.
- [ ] 6.3 Implementar CSV/XLSX compartiendo filas y utilidades compatibles. Verificar archivos sintéticos de ambos formatos con los mismos valores, identificadores como texto, protección de fórmulas, detalle filtrable, resumen conciliado y período vacío; documentar el contrato final de columnas.
- [ ] 6.4 Incorporar endpoint y entrada UI de exportación según P-UX/P-REP. Verificar autorización, caché privada, filtros inválidos y flujo de descarga, además de regresiones del reporte de ventas que confirmen su contrato de 24 columnas y exclusión de recibidos.

## 7. Verificación transversal del alcance revisado

- [ ] 7.1 Ejecutar el flujo completo en entorno local autorizado con datos ficticios: compra y gasto, carga de factura/respaldo, pago parcial existente, consulta y descarga. Verificar conciliación del archivo con la fuente y que saldos y stock no cambien por la asociación; registrar evidencias y limitaciones reales.
- [ ] 7.2 Ejecutar los tests afectados, typecheck, lint focalizado, `git diff --check` y validación estricta de OpenSpec tras los cambios. Verificar resultados y revisar que cada escenario del alcance aprobado tenga evidencia, dejando explícito que P-RET continúa diferido.

## Workflow follow-up

- Revisar esta primera versión antes de solicitar implementación con `openspec-apply-change`.
- Retomar P-RET cuando se defina la gestión de retenciones: la idea de cargarlas al pagar una operación con factura asociada sigue siendo una hipótesis. Resolver constancias, pagos parciales, anulación, saldo y período del reporte antes de agregar tareas de implementación.
- Archivar únicamente el alcance implementado y verificado, conservando trazable el pendiente de retenciones si sigue diferido.
