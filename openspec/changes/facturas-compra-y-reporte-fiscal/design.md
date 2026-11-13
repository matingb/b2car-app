# Design

## Context

Ver [proposal.md](proposal.md) para el alcance y las specs de [comprobantes recibidos](specs/comprobantes-recibidos/spec.md) y [reporte de compras](specs/reportes-fiscales-compras/spec.md) para los comportamientos.

Revisión del 12/11/2026: registra las ocho definiciones del usuario, la elección de persistencia separada y la confirmación de que pago más retención cancelan la deuda. La propuesta posterior de cargar retenciones independientemente del pago todavía no tiene respuesta; no se convierte en acuerdo.

### Evidencia del checkout

El relevamiento inicial del 10/11/2026 fue estático, sin consultar el esquema desplegado ni datos fiscales reales. La revisión de código del 12/11 agrega estos puntos relevantes:

| Fuente | Restricción o integración |
| --- | --- |
| supabase/database/schemas/public/tables/facturas_electronicas.sql | Modelo de emisión orientado a VENTA/ARREGLO, con estados, ambiente y autorización; no reutilizarlo para recepción. |
| src/app/api/proveedores/proveedorRepository.ts y ProveedorModal.tsx | Proveedor ya tiene nombre, CUIT y dirección; el conjunto fiscal configurable debe ampliarse y concretarse. |
| src/lib/documentos/types.ts y documentosService.ts | Documentos ya combina facturas emitidas y remitos de fuentes distintas; sus tipos y filtros deben admitir compras y retenciones. |
| src/app/api/operaciones/[id]/documentos/route.ts | La asociación actual trata el origen como VENTA y usa el ambiente de emisión. |
| src/app/api/operaciones/operacionesService.ts y src/app/api/gastos/route.ts | El alta de gasto descarta el proveedor y existe otro punto de creación manual; ambos requieren integración explícita. |
| src/lib/permissions.ts y src/lib/facturacion/serverAuth.ts | Existen permisos de ver/editar facturación y control efectivo por rol/plan. |
| src/lib/facturacion/reporteFiscal.ts | Reporte de ventas de 24 columnas, con base e IVA específicos al 21%; requiere adaptación para compras. |
| src/app/api/proveedores/proveedorRepository.ts | Saldo y cuenta corriente consumen total pagado de operaciones; no basta actualizar solo la pantalla de compra. |
| Cambio rediseno-operaciones-ledgers, spec operaciones-impacto-financiero | Total pagado y estado se derivan de impactos de cuenta. La retención amplía la cancelación de deuda sin ser otro impacto de caja. |
| Cambio rediseno-operaciones-ledgers, spec operaciones | Se permite borrar físicamente operaciones; su interacción con documentos sigue pendiente. |

No hay capacidades publicadas en openspec/specs/. Los artefactos de ventas y ledgers se conservan como contexto histórico; este cambio especifica su ampliación para compras sin reescribirlos.

### Acuerdos confirmados

| Tema | Definición |
| --- | --- |
| Asociación | Una compra admite varios documentos; factura opcional durante la creación o posteriormente. |
| Alcance previo | Se conserva la carga de facturas en compras y gastos; las nuevas definiciones detallan especialmente COMPRA. |
| Proveedor | Datos fiscales configurables, precarga desde el proveedor asociado y modificación en cada documento. |
| Facturas | Facturas normales A/B/C; IVA por alícuota. NC/ND y otros comprobantes especiales quedan fuera de esta versión. |
| Conceptos adicionales | Carga manual abierta con sugerencias comunes de IIBB Buenos Aires/CABA, Ganancias e impuestos internos. |
| Ciclo | Formulario que se guarda directamente, sin borradores; documentos editables y eliminables. |
| Archivos | Sin subida de archivos, fotos ni adjuntos. P-ARCH queda resuelto y fuera del alcance. |
| Presentación y acceso | Gestión transparente como Documentos, con permisos y acceso inicial equivalente a facturación de ventas. |
| Reporte | Primera versión con columnas similares al reporte de ventas; adaptación concreta pendiente. |
| Retenciones | Otro tipo de documento del mismo circuito; pago más retención cancelan deuda. |
| Persistencia | Tablas separadas de facturación electrónica, con estructura común y detalle por tipo. |

## Goals / Non-Goals

**Goals:**

- Separar datos fiscales, asociación operativa y cancelación de deuda, integrándolos en una misma experiencia de Documentos.
- Conservar identidad e importes históricos editables sin depender de la ficha actual del proveedor.
- Incorporar retenciones sin duplicar pagos ni movimientos de cuentas o inventario.
- Mantener visibles las decisiones restantes antes de implementar el bloque dependiente.

**Non-Goals:**

- Determinar crédito fiscal, deducibilidad, regímenes aplicables o montos de impuestos/retenciones.
- Emitir, autorizar o verificar documentos ante ARCA.
- Implementar adjuntos, fotos, borradores, OCR/importaciones o NC/ND de compras.
- Cambiar el contrato de emisión o reporte de ventas ni reconstruir datos fiscales históricos.

## Decisions

### D1. Persistencia propia y experiencia común de Documentos

La separación de facturas_electronicas queda confirmada. Se propone una cabecera de documentos de compra, de nombre técnico candidato comprobantes_recibidos, con tipo FACTURA o RETENCION, identidad, fecha, moneda, procedencia y trazabilidad. El usuario gestiona documentos sin elegir ni conocer su tabla de origen.

Compartir estructura no implica exigir todos los campos a ambos tipos: clase A/B/C, punto de venta, número y detalle de IVA corresponden a la factura; la retención conserva su identificación y conceptos aplicables. El detalle puede separarse en entidades hijas según el contrato final.

~~~text
COMPRA --> documentos --> FACTURA A/B/C --> IVA por alicuota y conceptos
                    |
                    +--> RETENCION --> imputacion a deuda
                    |
                    +--> listado y detalle de Documentos --> reporte
~~~

Una compra tiene cero o más documentos. No elegir todavía entre FK directa y tabla de vínculos: sigue abierto si un documento puede cubrir varias compras o existir sin operación. No exigir que cada factura individual iguale el total de la compra.

Alternativas descartadas: ampliar la tabla de emisión con reglas de recepción o duplicar datos fiscales en cada tabla de operación. Ambas acoplan ciclos distintos o dificultan varios documentos.

### D2. Datos fiscales configurables y copia editable por documento

Ampliar la ficha del proveedor con los datos fiscales necesarios; nombre, CUIT y dirección existentes son el punto de partida. P-ID cierra los campos adicionales, obligatoriedad y receptor fiscal.

La selección del proveedor precarga el formulario. El usuario puede cambiar esos datos antes de guardar y al editar el documento. Guardar la factura no modifica automáticamente al proveedor; editar la ficha no reescribe documentos anteriores. La copia histórica es editable explícitamente, no un bloqueo fiscal ni una consulta dinámica a la ficha.

Una compra sin proveedor no genera una identidad fiscal ficticia. Definir su carga manual y campos requeridos en P-ID. GASTO se conserva en el alcance previo; su identificación de emisor sin proveedor comercial y sus puntos de entrada requieren adaptación en P-ALC.

### D3. IVA por alícuota y conceptos de carga abierta

Modelar el detalle de IVA por alícuota, con base e importe informados, sin limitarlo al 21%. El formulario usa las alícuotas finalmente admitidas y no inventa un desglose desde el total. P-CAT concreta esa lista y el tratamiento de campos incompletos o no aplicables por clase; no reabre la elección de IVA por alícuota.

Los usuarios pueden agregar conceptos con descripción e importe manuales. El desplegable propone opciones comunes como IIBB Buenos Aires, IIBB CABA, Ganancias e impuestos internos y permite ingresar otras. Se recomienda categoría y jurisdicción cuando corresponda para conciliar el reporte; el vocabulario final se cierra en P-CAT. Las sugerencias no confirman la aplicabilidad de un impuesto ni convierten un concepto libre en retención cancelatoria.

Persistir decimales y operar sumas en centavos. Conservar netos, exentos, no gravados, IVA, otros conceptos y total; distinguir cero de no informado. Las validaciones entre componentes, total y suma de facturas asociadas se cierran en P-CAT/P-REL. No alterar el monto de la operación para hacerlo coincidir con la factura.

### D4. Retenciones como documento con cancelación de deuda

El registro manual de retenciones queda dentro del alcance, como tipo distinto de FACTURA en el mismo circuito. Ya no está íntegramente diferido ni es solo informativo. La factura no requiere una retención ni la genera automáticamente.

Regla confirmada: cancelación de deuda = pagos vigentes + retenciones vigentes imputadas; saldo pendiente = monto pactado menos esa cancelación. Ejemplo: compra 121000, pago 115000 y retención imputada 6000 dejan saldo 0 y la compra saldada. La factura conserva total 121000; la retención no modifica su IVA ni sus componentes.

La retención cancela deuda sin mover caja o banco ni stock. No representarla como otro egreso con una cuenta ficticia. Se recomienda persistir una imputación trazable al documento y a la compra, separada de los pagos efectivos; P-RET cierra su relación exacta con pagos/facturas y la cardinalidad de esa imputación.

La creación, edición y eliminación del documento deben mantener coherentes su imputación, saldo y estado de pago. Al eliminar la retención de 6000 del ejemplo, queda pendiente 6000; al corregirla a 5000, queda pendiente 1000. Esos cambios no revierten el pago de 115000. Reintentos o varias relaciones no pueden cancelar dos veces el mismo importe.

El contrato actual de ledgers deriva total_pagado y estado_pago solo de movimientos de cuenta. Hay que ampliar el cálculo de saldo y estado para compras y adaptar cuenta corriente, validación de pagos posteriores, resúmenes y consumidores. P-RET define la representación de pago efectivo frente a total cancelado en campos/API/UI; no se cambia silenciosamente el significado de total_pagado.

Sigue pendiente si una retención se carga únicamente junto al pago o también desde Documentos de forma independiente. Tampoco se confirmaron la obligatoriedad de una factura previa, asignaciones parciales, límites de imputación, sobrecancelaciones ni el vínculo al anular un pago. Resolverlo antes de implementar este bloque.

### D5. Documentos, permisos e integración de operaciones

Extender listado, filtros, detalle y documentos asociados de la compra para distinguir emitidos/recibidos y tipos FACTURA/RETENCION/REMITO según corresponda. Los recibidos no heredan estados ARCA ni el filtro HOMOLOGACION/PRODUCCION de emisión.

Revisar creación/detalle de compras, compras automáticas desde arreglos y los dos puntos de alta de gastos. La carga inicial es opcional y la asociación posterior no recrea la operación. Si falla el guardado del documento después de crear la compra, conservar la compra y permitir reintentar sin repetir pagos ni stock. La frontera transaccional final se define en P-UX.

Agregar permisos asociados a consulta y gestión de estos documentos, con asignación inicial por rol/plan equivalente a la facturación de ventas. Se propone separar ver/exportar de crear/editar/eliminar, siguiendo la estructura actual; los identificadores y matriz exacta se cierran en P-UX. Registrar documentos de proveedor no exige certificados de emisión.

Aplicar servicios/repositories y derivar tenant de sesión; validar pertenencia de operación, proveedor, documentos e imputaciones. Futuras migraciones con RLS, grants mínimos e índices. No agregar Storage ni endpoints de adjuntos.

### D6. Guardado directo, edición y eliminación

No hay ciclo de borradores: validar el formulario y guardar el documento en el momento. La falta de validación ante ARCA no impide validaciones locales de campos, importes o acceso.

Editar o eliminar una factura solo cambia su registro fiscal y su participación en consultas/reportes, sin modificar la compra, pagos o stock. Editar o eliminar una retención también actualiza su cancelación de deuda, de forma atómica.

P-CICLO cierra deduplicación, trazabilidad interna, estrategia de eliminación y el borrado de la operación. No equiparar eliminar un documento de compra con anular una factura electrónica autorizada. No elegir una cascada de borrado antes de resolver la conservación de documentos y sus imputaciones.

### D7. Reporte de compras basado en ventas, con contrato propio

Tomar las columnas de ventas como referencia inicial y reutilizar constructores CSV/XLSX y utilidades monetarias compatibles. El proveedor/emisor es central en compras; agregar su identificación y adaptar el receptor cuando sea necesario.

| Grupo | Base para la primera versión, sujeta a P-REP |
| --- | --- |
| Identificación | Fecha, tipo/clase, punto de venta/número, proveedor/emisor y datos fiscales pertinentes. |
| Importes facturados | Netos, exentos/no gravados, bases e IVA por alícuota, IVA total, otros conceptos y total. |
| Conceptos abiertos | Preservar descripción, importe y jurisdicción informados, con detalle/agrupación que no pierda datos. |
| Retenciones | Presentación y totales separados del total facturado, sin duplicar sus importes por vínculos a pagos/facturas. |
| Trazabilidad | Documento y operación de origen, con datos históricos y observaciones. |

No copiar solamente base/IVA 21%, columnas de emisión o filtros de ambiente. Tampoco cerrar como aprobadas las 24 columnas exactas del reporte de ventas. CSV/XLSX se conservan como propuesta de formatos; falta ratificar el contrato final con una muestra.

Una fila por factura, aunque una compra tenga varias facturas, pagos o conceptos. La forma de presentar documentos de retención, su fecha de selección y sus totales sigue en P-REP/P-RET. El total facturado no disminuye por las retenciones que cancelan deuda; el reporte fiscal y el saldo operativo representan conceptos distintos.

El criterio temporal sigue pendiente: fecha de emisión se mantiene como propuesta para facturas, no como decisión ya aceptada. Resolver la fecha de retenciones y la edición/eliminación de documentos durante una exportación. Se requiere lectura consistente o detección de cambios, paginación completa y fallo sin archivo parcial.

### D8. Pendientes restantes, con alcance de los acuerdos

Las tareas dependientes comienzan después de resolver el pendiente aplicable. Esta revisión no convierte propuestas del asistente sin respuesta en decisiones.

| ID | Ya confirmado | Pendiente |
| --- | --- | --- |
| **P-REL** | Varios documentos por compra. | Un documento para varias compras o sin operación; conciliación de importes y sumas de facturas. |
| **P-ID** | Ficha fiscal configurable, precarga y edición local. | Campos obligatorios, receptor fiscal, compras sin proveedor, alcance por taller y cambios de CUIT. |
| **P-CAT** | A/B/C, IVA por alícuota, conceptos abiertos y sugerencias. | Alícuotas admitidas, identificación/autorización requerida, datos incompletos, categorías/jurisdicciones y validaciones. |
| **P-CICLO** | Sin borradores; edición y eliminación de documentos. | Duplicados, historial/estrategia de borrado y qué ocurre al borrar la compra. |
| **P-RET** | Documento RETENCION; pago más retención cancelan deuda sin otra salida de caja. | Carga independiente del pago, factura previa, vínculos/distribución, parcialidades, límites, anulaciones y representación de pago efectivo/total cancelado. |
| **P-REP** | Reporte inicial similar a ventas. | Columnas/muestra exactas, formatos, fechas por tipo, presentación de retenciones, moneda/cotización y extracción consistente. |
| **P-UX** | Carga opcional inicial/posterior, CRUD y permisos con acceso inicial equivalente a ventas; gestión en Documentos. | Matriz/identificadores concretos, frontera de guardado/reintento y acceso desde compras automáticas. |
| **P-ALC** | Se conserva COMPRA/GASTO del alcance anterior; las nuevas definiciones detallan COMPRA. | Adaptación de emisor/proveedor y puntos de entrada de GASTO; confirmar si las retenciones de esta revisión se aplican también a gastos. |

P-ARCH queda cerrado: adjuntos y fotos excluidos. NC/ND de compras y comprobantes especiales no se mantienen como opciones pendientes dentro de esta versión.

## Risks / Trade-offs

- **[Retención registrada como otro egreso]** → Separar pago efectivo y cancelación; comprobar invariancia de cuentas, ledger de caja y stock.
- **[Saldo correcto solo en una pantalla]** → Revisar estado, cuenta corriente de proveedor, resúmenes y validación de pagos posteriores con una única regla.
- **[Documento editado pero imputación anterior vigente]** → Escritura atómica, concurrencia e idempotencia de alta/corrección/eliminación.
- **[Copia literal del reporte de ventas]** → Contrato propio con identificación de proveedor, varias alícuotas y conceptos abiertos.
- **[Conceptos libres imposibles de conciliar]** → Conservar etiquetas y montos originales; cerrar categorías y presentación sin restringir el ingreso abierto.
- **[Borrado de compra destruye documentos o deja cancelaciones huérfanas]** → Resolver P-CICLO/P-RET antes de elegir cascadas o restricciones.
- **[Pendientes tratados como aprobados]** → D8 y tareas de definición previas; no inferir aceptación de recomendaciones sin respuesta.

## Migration Plan

1. Cerrar los pendientes aplicables de D8 y actualizar contratos/escenarios antes de cada bloque.
2. Coordinar la ampliación financiera con el contrato vigente de ledgers y sus consumidores, conservando pagos y asientos históricos.
3. Crear migraciones aditivas para datos fiscales del proveedor, documentos, detalles, relaciones e imputaciones con RLS/grants; no editar el esquema declarativo manualmente ni inventar documentos históricos.
4. Verificar persistencia, aislamiento y cancelación en DB local desechable autorizada con datos sintéticos; no ejecutar cambios sobre datos fiscales reales.
5. Implementar API, Documentos e integración de compras; validar reintentos y correcciones sin duplicar efectos.
6. Implementar el reporte con la muestra aprobada y probar compatibilidad con ventas, pagos, cuentas y stock.
7. Desplegar por dependencias y conservar documentos e imputaciones ante rollback. Deshabilitar el circuito exige resolver las cancelaciones vigentes; no borrar tablas o retirar sus efectos silenciosamente.

## Open Questions

Detalles diferibles: nombres visibles, orden de campos y orden final de columnas una vez aprobado su conjunto. Las decisiones que condicionan implementación están en D8.
