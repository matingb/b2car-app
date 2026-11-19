# Design

## Context

Ver [proposal.md](proposal.md) y las specs de [comprobantes recibidos](specs/comprobantes-recibidos/spec.md) y [reporte de compras](specs/reportes-fiscales-compras/spec.md).

Las facturas y retenciones tienen líneas manuales de conceptos y percepciones y se gestionan en el circuito documental. Al alta o edición de una compra, sus percepciones también se pueden registrar como cargos operativos. Adjuntar una factura a una operación existente conserva su saldo.

### Evidencia relevante del checkout

| Fuente | Restricción o integración |
| --- | --- |
| facturas_electronicas y sus consumidores | Circuito de emisión con estados/ambiente/autorización; no reutilizar su persistencia para recepción. |
| src/app/api/proveedores/proveedorRepository.ts y ProveedorModal.tsx | La ficha tiene nombre, CUIT y dirección; debe incorporar posición de IVA y los datos fiscales acordados. |
| src/lib/documentos/types.ts y documentosService.ts | Documentos combina fuentes distintas; extender para facturas recibidas y retenciones. |
| src/app/api/operaciones/[id]/documentos/route.ts | La asociación actual trata el origen como VENTA y usa ambiente de emisión. |
| src/app/api/operaciones/operacionesService.ts y src/app/api/gastos/route.ts | Hay dos puntos de alta de gastos y el gasto no tiene proveedor comercial asociado en el flujo actual. |
| src/lib/permissions.ts | Hay permisos de ver/editar facturación y asignación efectiva por rol/plan. |
| src/lib/facturacion/reporteFiscal.ts | El reporte de ventas tiene 24 columnas base; conservarlas como referencia exacta y agregar columnas de percepciones en compras. |
| `operaciones_lineas.iva_alicuota_id` y `ALICUOTAS_IVA_ARCA` | La operación ya admite códigos de ARCA. El id `5` (21%) es el valor por defecto y puede estar presente sin que se haya confirmado una tasa facturada. |
| Cambio rediseno-operaciones-ledgers, spec operaciones | Permite borrar operaciones; este cambio agrega bloqueo cuando existen documentos asociados. |

El relevamiento es estático y no consulta datos fiscales reales ni el esquema desplegado. No hay capacidades publicadas en openspec/specs/.

### Estado de las definiciones

| Tema | Decisión vigente |
| --- | --- |
| Relación | Una operación admite varios documentos; cada documento exige exactamente una operación del mismo tenant. |
| Retenciones | Documento relacionado con líneas/descripciones/montos, visible y totalizado en reporte; sin vínculo financiero ni efecto en pagos o saldos. |
| Cargos | Pertenecen a la operación base. El alta y la edición de cargos se habilitan en compras. El circuito documental conserva cargos y saldos. |
| Gastos | Mismo tratamiento documental e informativo de retenciones que compras. |
| Diferencias | Guardado permitido con label informativo; no ajustar factura ni operación. |
| Borrado | Operaciones con documentos no se eliminan. Los documentos sí pueden eliminarse; luego vuelve a aplicar el circuito de borrado operativo existente. |
| Duplicados | Error ante factura con CUIT emisor y número de factura repetidos dentro del tenant. |
| Líneas | CONCEPTO y PERCEPCION con descripción/selección e importe manuales. Para conceptos de facturas A, alícuota editable por línea y desglose confirmado por tasa en el documento. |
| Requeridos | Número de factura y posición de IVA del proveedor; CUIT emisor conservado para identidad y unicidad. |
| Reporte | Mismas columnas base que ventas y columnas extra por cada percepción distinta en las facturas seleccionadas; incluir total de retenciones documentadas. |
| Percepciones | Selector libre con sugerencias Ganancias, IVA, IIBB Buenos Aires e IIBB CABA. |
| Acuerdos conservados | A/B/C, ficha fiscal configurable, precarga editable, CRUD sin borradores, gestión en Documentos y permisos equivalentes inicialmente a ventas. |
| Archivos | Se conserva la exclusión de archivos/fotos. “Adjuntar documento” se interpreta como vincular el registro estructurado a la operación, no como habilitación de subida de archivos. |

## Goals / Non-Goals

**Goals:**

- Separar documentos fiscales e informativos de la operación y sus efectos financieros o de stock.
- Tener una fuente histórica editable para consulta y reporte, con identidad y conceptos manuales.
- Proteger integridad de asociaciones, unicidad y borrado de operaciones documentadas.
- Producir un reporte reproducible con columnas base estables y percepciones dinámicas.

**Non-Goals:**

- Imputar retenciones a pagos, cancelar deuda, modificar estados de pago o crear movimientos de cuentas.
- Determinar impuestos aplicables, porcentajes de percepciones/retenciones, crédito fiscal, deducibilidad o aplicabilidad de regímenes.
- Emitir o verificar ante ARCA, gestionar borradores, adjuntos/fotos, OCR/importaciones o NC/ND de compras.
- Modificar el contrato del reporte de ventas.

## Decisions

### D1. Documentos propios, una sola operación y experiencia unificada

Mantener cabecera propia, de nombre candidato comprobantes_recibidos, separada de facturas_electronicas. Tipos documentales iniciales: FACTURA y RETENCION. Ambas comparten identidad, fecha, operación y detalle manual, con validaciones específicas según tipo.

Una FK operacion_id obligatoria resuelve la cardinalidad confirmada: muchas cabeceras por operación y exactamente una operación por cabecera. No crear vínculos de varias operaciones por documento ni documentos sin operación. Validar tenant y tipos COMPRA/GASTO.

Integrar listado, filtros y detalle en Documentos y desde la operación, diferenciando emitidos/recibidos y tipo documental. No presentar estados ARCA ni ambiente de emisión como requisitos de un documento manual.

Alternativas descartadas: tabla de vínculos de varias operaciones por documento, columnas fiscales repetidas en operaciones y reutilización de la tabla de emisión.

### D2. Datos fiscales precargados y copia histórica editable

Configurar datos fiscales en proveedor, incluida su posición de IVA. Al cargar un documento desde una operación con proveedor, precargar los datos y permitir corrección local. La factura exige número y posición de IVA del proveedor. Conservar el CUIT emisor para deduplicar sin depender de un proveedor_id comercial.

Guardar el documento no actualiza automáticamente la ficha del proveedor. Cambiar la ficha no reescribe documentos anteriores; la copia solo cambia mediante edición explícita del documento.

Compras/gastos sin proveedor comercial permiten identificar al emisor en el formulario. La ausencia de un proveedor_id no reemplaza ni elimina los datos fiscales obligatorios. No confundir posición de IVA del proveedor/emisor con la del receptor.

### D3. Conceptos, percepciones y desglose de IVA en facturas A

Cada línea guarda tipo CONCEPTO o PERCEPCION, descripción/etiqueta e importe informado. Agregar `iva_alicuota_id` nullable a `comprobantes_recibidos_lineas`, con los mismos códigos que usa la operación. El campo se aplica a conceptos gravados de facturas A. Una factura puede mezclar alícuotas y cada factura de una operación conserva su propio detalle.

En una factura A nueva, sugerir 21%. Tanto en el alta con «Cargar con factura» como al adjuntar o editar, permitir aplicar una tasa a todos los conceptos y editarla por línea. Al crear la compra con factura, precargar las alícuotas disponibles de sus líneas, sugerir 21% donde falten y enviar las tasas y el desglose confirmados en el guardado documental. Al adjuntar otra factura o editar una existente, la tasa confirmada para ese documento prevalece sobre cualquier precarga. Conservar sin valor las alícuotas ausentes de documentos históricos hasta que se confirmen en una edición.

Guardar, por factura A y alícuota, la base neta gravada y el IVA discriminado confirmados contra el comprobante. El resumen es editable y permite sugerir IVA a partir de una base identificada como neta y de la tasa elegida. La confirmación conserva los importes del proveedor, incluidos sus redondeos. El desglose fiscal describe importes ya comprendidos en el monto facturado y no suma el IVA una segunda vez al total del documento.

Las facturas B y C conservan sus importes finales sin extraer IVA. Si una B muestra IVA contenido, su eventual registro es informativo y queda fuera de las columnas de IVA discriminado de compras. Las percepciones, incluida la percepción de IVA, siguen registrándose por separado a importe manual. El selector ofrece Ganancias, IVA, IIBB Buenos Aires, IIBB CABA y nombres libres. Las retenciones conservan su carga manual.

Mantener los importes sin cargar como campos vacíos durante la edición. Requerir base e IVA para guardar cada fila confirmada y admitir un cero ingresado explícitamente. Sin filas confirmadas, incluido el caso de quitar la última, guardar el desglose como `null`. Una tasa operativa precargada deja los importes del desglose pendientes de confirmación.

Persistir importes con precisión decimal y sumar en centavos. Validar al guardar que la suma de bases e IVA confirmados sea menor o igual al total de conceptos de la factura. Un desglose parcial puede quedar por debajo de ese total. El total facturado sigue siendo la suma de conceptos y percepciones manuales. Los cambios en los conceptos y el desglose documental no modifican líneas de operación, stock, pagos ni saldo.

#### Ejemplos de conciliación para implementación

- Factura A: base confirmada 10000,00 e IVA 2100,00 al 21%; base 20000,00 e IVA 2100,00 al 10,5%; percepción de IVA manual 500,00. El total facturado es 34700,00. El reporte muestra base e IVA al 21% de 10000,00 y 2100,00, base gravada total 30000,00, IVA total 4200,00 y percepción de IVA 500,00 en su columna separada. El desglose ya está incluido en el total y no se suma otra vez.
- Documento histórico por 12100,00 sin desglose confirmado: conservar su total y dejar base e IVA desconocidos, aun si la operación tiene 21% por defecto. Las sumas fiscales que lo incluyan se identifican como parciales; desconocido no equivale a cero.
- Factura A con base 10000,00, IVA confirmado 2100,00 y percepción de IVA 300,00: el IVA discriminado es 2100,00, la percepción es 300,00 y el total es 12400,00. No sumar la percepción al IVA discriminado ni recalcular el importe manual.
- Factura A con conceptos por 12100,00 y desglose por 34200,00 entre bases e IVA: rechazar el guardado e informar la diferencia dentro del documento.

### D4. Retenciones exclusivamente documentales

Un documento RETENCION registra líneas, descripciones e importes para el reporte y pertenece a su operación, igual que la factura. Su carga no exige pasar por un pago ni crear imputaciones financieras.

Crear, editar o eliminar una retención no altera pagos efectivos, saldo pendiente, estado de pago, cuenta corriente, saldos de cuentas ni stock. Esto aplica a COMPRA y GASTO. No crear tablas de imputación a deuda ni modificar cálculos financieros por estos documentos.

Ejemplo de invariancia: compra 121000, pago efectivo 115000 y saldo previo 6000. Cargar una retención documental de 6000 conserva el saldo 6000; editarla a 5000 o eliminarla tampoco modifica ese saldo. En el reporte se ve el importe documental vigente de la retención.

Se retiran las tareas de cancelación, parcialidades, sobrecancelaciones y anulación de pagos ligados a retenciones. Su identificación y presentación siguen P-REP sin introducir un efecto financiero.

### D5. Diferencias de importes y validaciones

Permitir guardar y editar documentos aunque el total difiera del monto operativo. Mostrar un label informativo con la diferencia, sin convertirla en error ni ajustar automáticamente los importes. La validación del desglose de D3 usa los conceptos de la propia factura.

Una operación puede tener varias facturas; comparar e informar también la suma de sus facturas vigentes frente al monto de operación, distinguiendo factura individual de conjunto. No sumar documentos RETENCION al total de facturas para producir esa comparación.

Rechazar campos requeridos faltantes y duplicados. Sin borradores significa guardar después de las validaciones locales, no aceptar datos requeridos ausentes.

### D6. Unicidad y borrado protegido

Para facturas, la identidad de deduplicación es tenant + CUIT emisor + número de factura, incluso si se intenta cargar en otra operación. No añadir clase o proveedor_id a la clave para permitir el mismo CUIT/número repetido. Validar alta y edición y respaldar la regla con una restricción de unicidad que cubra concurrencia.

Normalizar presentación de CUIT y número sin perder su representación visible. El número es el identificador completo de factura informado; concretar normalización sin confundir numeraciones de puntos de venta diferentes. La retención admite un número propio libre y opcional.

Bloquear eliminación de cualquier operación que conserve documentos vigentes, tanto FACTURA como RETENCION. Aplicarlo en el circuito central y todos sus endpoints, no solo deshabilitando un botón. Garantizar consistencia entre altas de documentos y borrado concurrente mediante FK restrictiva y transacción/bloqueos según el esquema elegido.

Permitir editar/eliminar documentos. Eliminar un documento no elimina la operación ni revierte pagos o stock. Cuando ya no existen documentos, el borrado operativo vuelve a regirse por su contrato vigente. La estrategia interna de historial/eliminación puede definirse técnicamente respetando estos comportamientos.

### D7. Reporte con base de ventas y percepciones dinámicas

La primera versión usa los mismos encabezados y orden de las 24 columnas actuales de ventas, más columnas al final por cada percepción distinta presente en las facturas seleccionadas. Mantener el significado de emisor/receptor y mostrar vacíos o desconocidos cuando un dato no fue informado, sin fabricar CAE o autorización.

Construir el universo de percepciones sobre todas las facturas incluidas, después de aplicar filtros y antes de serializar/paginar la salida. Una percepción presente solo en la última página también genera su columna. Varias líneas de la misma percepción en una factura se suman en su celda; el resumen suma la columna. El encabezado conserva una etiqueta legible.

Las opciones sugeridas deben conservar una identidad estable. Para opciones libres, elegir una normalización técnica predecible de espacios/capitalización; no fusionar categorías o jurisdicciones diferentes por semejanza. No restringir las columnas a las sugerencias ni usar percepciones de facturas fuera de la selección.

Una fila por factura, aunque existan varias en una operación. Los documentos de retención tienen detalle y suma documental identificables, separados del detalle y total facturado, sin inferirlos de pagos.

Obtener las bases y el IVA de compras del desglose confirmado en cada factura A. Las columnas de base e IVA 21% toman solo esa tasa. El neto gravado, la base imponible total y el IVA total incluyen las tasas confirmadas que correspondan, con sumas parciales identificadas cuando falten datos. Mantener las 24 columnas base y su orden. Los datos fiscales sin fuente estructurada se exportan vacíos. CSV y XLSX comparten conjunto y columnas. Período vacío conserva columnas base, sin percepciones inventadas.

El período selecciona la fecha del documento tanto para facturas como para retenciones. La moneda es peso argentino, sin conversión. Se habilitan CSV y XLSX. Las retenciones usan número propio libre y opcional, y se presentan con detalle y total separados de las facturas. Exportación con lectura consistente o detección de cambios, paginación completa y fallo sin archivo parcial. El reporte de ventas conserva sus 24 columnas y no recibe esta ampliación dinámica.

### D8. Permisos, guardado e integración

Permisos propios de consulta/gestión, con acceso inicial equivalente a facturación de ventas y control efectivo por rol/plan. Identificadores y separación de lectura/exportación frente a CRUD son detalles técnicos compatibles con ese acuerdo.

Derivar tenant de sesión; validar pertenencia de operación y documento. RLS, grants mínimos e índices en futuras migraciones, sin editar manualmente el esquema declarativo. No incorporar Storage.

Revisar alta y detalle de compras, compras automáticas desde arreglos y ambos puntos de entrada de gastos. El documento requiere una operación ya persistida; la secuencia de creación conjunta puede ser transaccional o preservar la operación y permitir reintentar el documento, sin repetir pagos ni stock y sin éxito aparente.

La implementación existente normaliza el CUIT a dígitos y el número en segmentos alfanuméricos en mayúsculas, quitando ceros iniciales a cada segmento numérico. Así, `30-71234567-8 / 0001-00001234` y `30712345678 / 1-1234` comparten clave; `12-1234` y `1-21234` no. Las percepciones sugeridas usan códigos estables y las libres agrupan por texto con espacios colapsados y mayúsculas: « Tasa   Municipal » y «tasa municipal» comparten columna, pero no se fusionan jurisdicciones distintas.

Los permisos `comprobantes_recibidos:view` y `comprobantes_recibidos:edit` copian inicialmente las asignaciones de facturación de ventas para roles y planes. Operación y documento se guardan por separado: si falla el documento se conserva la operación y se reintenta con la misma clave; si se perdió la respuesta de un alta exitosa, la clave devuelve el mismo documento. La edición reemplaza cabecera y líneas en una transacción. El historial interno conserva fechas y usuarios de creación y actualización del documento vigente; la eliminación es física y no promete auditoría histórica.

### D9. Cargos de operación y percepciones documentales

`operaciones_cargos.operacion_id` referencia `operaciones.id` con borrado en cascada. La consulta de detalle lee los cargos directamente desde la operación. El alta y la edición de cargos validan `COMPRA` y el permiso `operaciones:edit`; el modelo admite habilitar otros tipos por sus propios circuitos.

Al crear una compra con factura, las percepciones ingresadas se guardan como cargos en la transacción operativa y se copian al documento en el paso documental. Si el guardado documental falla, se reintenta sobre la compra persistida. Los cargos confirmados forman parte de esa compra.

Al editar los cargos de la compra, el usuario puede cargarlos manualmente o tomar las percepciones de una factura asociada. La lista se aplica al guardar la edición. La transacción ajusta el total por la diferencia entre los cargos anteriores y los nuevos, conserva los pagos registrados y rechaza un total inferior a lo ya pagado. Puede cambiar el saldo pendiente y el estado de pago. Omitir los cargos conserva la lista actual; enviar una lista vacía los quita.

Adjuntar, editar o eliminar una factura en su circuito documental conserva los cargos, el total y el saldo. Las retenciones documentales y las percepciones de gastos se registran para consulta y reporte. El reporte fiscal lee las percepciones de la factura, incluso cuando también existen cargos por esos importes en la compra.

## Definiciones restantes

La fuente de bases e IVA está definida en D3 y D7. P-REP fue confirmado: fecha del documento para ambos tipos, CSV y XLSX, pesos argentinos sin conversión, número de retención libre y opcional, y detalle y total de retenciones separados de las facturas.

Muestra de contrato: las primeras 24 columnas son las de `FISCAL_COLUMNS` de ventas, en su orden vigente. Para una factura de 34900,00 con percepción IVA de 500,00 y percepción libre «Municipal» de 200,00 (ambas incluidas en ese total), se agregan ambas columnas dinámicas con sus importes. Las retenciones de 6000,00 y 4000,00 figuran en su sección separada con total 10000,00; no alteran el total facturado. CSV y XLSX representan la misma selección y valores.

La implementación puede resolver normalización de etiquetas, identificadores de permisos, transacciones e historial interno dentro de las reglas anteriores. Esos detalles no requieren reabrir acuerdos de producto.

## Risks / Trade-offs

- **[Reintroducir el efecto financiero descartado]** → Invariancia de pagos, saldo, estado de pago, cuenta corriente, cuentas y stock al gestionar facturas/retenciones.
- **[Alícuota por defecto confundida con IVA facturado]** → Usar el 21% como precarga editable y exportar el desglose confirmado del documento.
- **[Columnas dinámicas incompletas]** → Unión de percepciones de todo el conjunto y pruebas con una percepción solo en la última página.
- **[Duplicados concurrentes]** → Restricción de unicidad y validación de edición además del alta.
- **[Borrado por un endpoint alternativo]** → Restricción central y validación de todos los puntos de borrado de operaciones.
- **[Reporte de ventas alterado accidentalmente]** → Reutilización selectiva con contrato y pruebas de regresión independientes.

## Migration Plan

1. Aplicar los detalles confirmados de P-REP al contrato y a la implementación.
2. Crear las migraciones aditivas de proveedor, cabecera y líneas, incluida la alícuota nullable por concepto y el desglose confirmado de factura. Preservar FK obligatoria/restrictiva, unicidad, permisos y RLS/grants. Mantener los comprobantes sin desglose con los campos fiscales ausentes.
3. Validar integridad y acceso en una DB local desechable autorizada con datos sintéticos, incluidos duplicados y borrado concurrente.
4. Implementar API/UI y puntos de entrada de compras/gastos, con reintentos sin duplicar operaciones o sus efectos.
5. Implementar reporte con las columnas base y la unión de percepciones y las retenciones documentales; verificar todas las páginas y formatos aprobados.
6. Desplegar por dependencias. Ante rollback, conservar documentos y respaldar la regla de operaciones documentadas; no borrar datos o liberar restricciones silenciosamente.

## Open Questions

Detalles diferibles: orden visual de campos, textos de labels y orden determinista de columnas dinámicas.
