# Spec Delta

## Purpose

Permitir exportar facturas y retenciones documentales de compras y gastos con las columnas base del reporte de ventas, columnas dinámicas de percepciones y sumas reproducibles, sin alterar el circuito financiero.

La fuente de bases gravadas e IVA es el desglose confirmado de cada factura recibida. El período usa la fecha del documento, tanto para facturas como para retenciones. Se exporta en CSV y XLSX, en pesos argentinos sin conversión. Las retenciones tienen número propio libre y opcional, con detalle y total separados de las facturas.

## ADDED Requirements

### Requirement: Universo documental separado del circuito financiero
El reporte SHALL seleccionar documentos vigentes de compras/gastos del tenant conforme al período aprobado e incluir facturas A/B/C y retenciones documentadas. MUST mantener separado este universo de documentos emitidos por B2Car y de operaciones sin documento. La selección MUST NOT depender del estado de pago o recepción de stock.

#### Scenario: Compra parcialmente pagada
- **GIVEN** una factura por 121000 y un pago efectivo de 60000
- **WHEN** la factura corresponde al período y alcance seleccionados
- **THEN** el reporte muestra su total documentado de 121000
- **AND** no lo reemplaza por el importe pagado

#### Scenario: Documentos de gasto
- **GIVEN** un gasto con factura y retención documental registradas dentro del período
- **WHEN** se genera el reporte
- **THEN** se incluyen los documentos y sus importes informados
- **AND** no se exige un proveedor comercial si el emisor está identificado en el documento

### Requirement: Mismas columnas base que ventas
La primera versión SHALL conservar los mismos encabezados y orden de las columnas base del reporte fiscal de ventas existente, agregando después las columnas dinámicas de percepciones. MUST respetar el significado de emisor y receptor y representar datos manuales ausentes como no informados, sin inventar autorización, bases o IVA.

#### Scenario: Contrato base de columnas
- **WHEN** se genera el reporte inicial de compras
- **THEN** sus primeras columnas coinciden en encabezados y orden con las 24 columnas base actuales de ventas
- **AND** las columnas de percepciones se agregan después sin reemplazar columnas base

#### Scenario: Datos de autorización ausentes
- **GIVEN** una factura manual sin CAE informado
- **WHEN** se exporta
- **THEN** se conserva la columna correspondiente sin fabricar un CAE
- **AND** no se exige ambiente de emisión o estado AUTORIZADA de B2Car

### Requirement: Una columna por percepción distinta de la selección
El reporte SHALL agregar una columna por cada percepción distinta presente en las facturas seleccionadas, incluidas las de nombre libre. MUST obtener el conjunto de columnas de todas las facturas seleccionadas y MUST NOT limitarlo a sugerencias, a la primera página o a percepciones de documentos fuera del filtro.

#### Scenario: Percepciones sugeridas y personalizadas
- **GIVEN** facturas seleccionadas con percepciones de IVA, IIBB Buenos Aires y otra de nombre personalizado
- **WHEN** se exporta
- **THEN** se agregan columnas identificables para las tres percepciones
- **AND** la percepción personalizada no se descarta por no estar entre las sugerencias

#### Scenario: Percepción solo en la última página
- **GIVEN** 1205 facturas seleccionadas y una percepción presente únicamente en la última
- **WHEN** se genera el reporte
- **THEN** esa percepción tiene su columna y su importe aparece en el detalle y totalización

#### Scenario: Percepción fuera del filtro
- **GIVEN** una percepción presente únicamente en una factura excluida por período
- **WHEN** se exporta la selección
- **THEN** esa factura no aporta una columna dinámica al archivo

### Requirement: Importes manuales y sumas por percepción
Cada fila SHALL mostrar la suma de importes manuales de las líneas de una misma percepción en esa factura y el resumen SHALL sumar cada columna dinámica. MUST NOT calcular porcentajes, inferir montos desde la condición fiscal o reemplazar valores informados por cálculos tributarios.

#### Scenario: Percepción repetida dentro de una factura
- **GIVEN** una factura con dos líneas de la misma percepción por 1000 y 500
- **WHEN** se exporta
- **THEN** la celda de esa percepción muestra 1500 y el resumen cuenta ese importe una sola vez
- **AND** el documento mantiene sus dos líneas originales

### Requirement: Una fila por factura y documentos rastreables
El detalle de facturas SHALL contener una fila por factura seleccionada aunque la operación tenga varios documentos, pagos o líneas. MUST mantener identificadores que permitan rastrear cada fila o detalle de retención al documento y a su única operación. Las relaciones MUST NOT multiplicar importes.

#### Scenario: Dos facturas de la misma operación
- **GIVEN** una compra con dos facturas seleccionadas de 60500
- **WHEN** se genera el reporte
- **THEN** hay dos filas de factura con total conjunto de 121000
- **AND** no se agrega otra fila por el monto de la operación

### Requirement: Retenciones documentales visibles y totalizadas
El reporte SHALL incluir el detalle y total de retenciones desde documentos RETENCION y sus importes registrados. MUST distinguir estos totales del total facturado y de las percepciones de factura, conservar trazabilidad y contar cada documento una sola vez. MUST NOT obtener retenciones desde pagos ni atribuirles cancelación financiera.

#### Scenario: Total de retenciones informadas
- **GIVEN** dos documentos de retención seleccionados por 6000 y 4000
- **WHEN** se genera el reporte
- **THEN** se consultan sus descripciones e importes y el total documental de retenciones es 10000
- **AND** no se suman como otra facturación ni se modifican pagos o saldos

### Requirement: Totales de factura independientes de operación y retención
El reporte SHALL conservar importes de factura aunque difieran del monto de la operación y sumar las columnas base y percepciones sin duplicar componentes ya incluidos en el total. MUST NOT corregir importes por diferencias operativas ni reducir el total facturado por documentos de retención.

#### Scenario: Factura con diferencia permitida
- **GIVEN** una operación por 120000 con factura guardada por 121000
- **WHEN** se exporta
- **THEN** la factura muestra el importe registrado de 121000
- **AND** no se reemplaza por 120000 para coincidir con la operación

#### Scenario: Factura y retención no cambian el saldo
- **GIVEN** factura de 121000, pago efectivo 115000, saldo pendiente 6000 y retención documental 6000
- **WHEN** se genera el reporte
- **THEN** el total facturado permanece 121000 y la retención documental se identifica por 6000
- **AND** el saldo operativo sigue siendo 6000 y el reporte no lo altera

### Requirement: Bases e IVA desde el desglose confirmado de cada factura
El reporte SHALL usar el desglose confirmado de cada factura. Las columnas de base e IVA al 21% SHALL tomar solo esa tasa. Neto gravado, base imponible total e IVA total SHALL incluir todas las tasas confirmadas que correspondan. Percepciones y retenciones conservan sus columnas o totales propios.

#### Scenario: Factura A con dos alícuotas confirmadas
- **GIVEN** una factura con base 10000 e IVA 2100 al 21%, y base 20000 e IVA 2100 al 10,5%
- **WHEN** se exporta
- **THEN** las columnas del 21% muestran base 10000 e IVA 2100
- **AND** la base imponible total es 30000 y el IVA total es 4200
- **AND** el reporte conserva los encabezados base

#### Scenario: Factura A sin operaciones al 21%
- **GIVEN** un desglose completo confirmado al 10,5%
- **WHEN** se exporta
- **THEN** las columnas del 21% muestran cero y la base e IVA del 10,5% se incluyen en los totales

### Requirement: Datos fiscales ausentes o sin desglose
El reporte MUST dejar vacíos los datos desconocidos, distinguir ceros informados e indicar sumas parciales. MUST NOT reconstruir el desglose a partir del texto, del total, de la operación, de pagos o de fichas actuales. En facturas B y C MUST NOT extraer IVA del importe final.

#### Scenario: Factura B con IVA contenido y factura C
- **GIVEN** una factura B que muestra IVA contenido y una factura C con su importe final
- **WHEN** se exportan
- **THEN** cada fila conserva el importe final informado
- **AND** el IVA contenido de la B y el importe final de la C no aportan base ni IVA discriminado

#### Scenario: Factura histórica de una operación con tasa por defecto
- **GIVEN** una factura con importe final sin desglose y una operación asociada con alícuota 21%
- **WHEN** se exporta
- **THEN** se conserva el importe final y los datos fiscales sin fuente quedan vacíos
- **AND** el resumen identifica como parciales las sumas fiscales afectadas por ese faltante

#### Scenario: Línea libre sin clasificación fiscal explícita
- **GIVEN** una línea con una descripción que menciona IVA y un importe manual
- **WHEN** no existe un dato fiscal confirmado para esa línea
- **THEN** el reporte no le atribuye automáticamente una base o alícuota
- **AND** conserva el dato original sin fabricar importes para completar columnas

### Requirement: Correcciones y eliminaciones reflejadas
El reporte SHALL usar la identidad e importes vigentes del documento y excluir documentos eliminados del universo vigente. Cambios en la ficha del proveedor MUST NOT reescribir el reporte de un documento sin edición explícita de este.

#### Scenario: Corregir una retención
- **GIVEN** un documento de retención cargado por 6000
- **WHEN** se corrige a 5000 y luego se vuelve a exportar
- **THEN** se refleja 5000 en el detalle y total documental
- **AND** los pagos y el saldo de la operación no cambian

#### Scenario: Eliminar una factura con percepción exclusiva
- **GIVEN** una factura cuya percepción no aparece en ninguna otra factura seleccionada
- **WHEN** se elimina la factura y se genera un reporte nuevo
- **THEN** no se incluye la factura ni se conserva una columna dinámica aportada solo por ella

### Requirement: Período y moneda explícitos
El reporte SHALL exigir un período desde/hasta válido y seleccionar facturas y retenciones por la fecha del documento, indicándolo al usuario. MUST preservar el día calendario y MUST NOT sustituir fechas silenciosamente. La moneda es peso argentino sin conversión.

#### Scenario: Rango inválido
- **WHEN** faltan fechas, son inválidas o desde es posterior a hasta
- **THEN** se informa el error sin descargar un archivo con otro período supuesto

#### Scenario: Fechas distintas
- **GIVEN** compra, documento, carga y pago en días distintos
- **WHEN** se genera el reporte con el criterio temporal aprobado
- **THEN** se usa la fecha elegida para ese tipo y se informa el criterio
- **AND** no se desplaza su día por conversión de zona horaria

### Requirement: Formatos con el mismo conjunto y columnas
Los formatos CSV y XLSX SHALL compartir documentos, valores y columnas dinámicas de una misma selección. MUST conciliar detalle y resumen y conservar identificadores como texto e importes utilizables. Textos y encabezados personalizados MUST NOT ejecutar fórmulas en la planilla.

#### Scenario: Dos formatos de la misma selección
- **GIVEN** CSV y XLSX habilitados para el mismo conjunto
- **WHEN** se descargan ambos
- **THEN** contienen las mismas columnas de percepciones y sus importes concilian
- **AND** sus encabezados base coinciden con el contrato de ventas

#### Scenario: Nombre de percepción con apariencia de fórmula
- **GIVEN** una percepción personalizada cuyo nombre comienza con un carácter interpretable como fórmula
- **WHEN** se serializa el encabezado y el detalle
- **THEN** el texto no ejecuta una fórmula

#### Scenario: Selección vacía
- **WHEN** no hay documentos incluidos
- **THEN** se conservan las columnas base, se indica cantidad cero y no se inventan columnas de percepciones

### Requirement: Generación completa y consistente
El reporte SHALL incluir todas las páginas y entregar detalle, columnas dinámicas y sumas consistentes ante altas, ediciones y eliminaciones concurrentes. MUST NOT presentar un archivo parcial o con columnas incompletas como definitivo si falla la lectura o no puede asegurarse consistencia. La exportación MUST NOT modificar documentos, operaciones o finanzas.

#### Scenario: Error al descubrir percepciones
- **WHEN** falla una página al obtener documentos o el conjunto de percepciones
- **THEN** se informa un error sin entregar un archivo con columnas o sumas parciales presentado como completo

### Requirement: Acceso autorizado y compatibilidad con ventas
El reporte SHALL exigir sesión, pertenencia al tenant y permiso efectivo de consulta/exportación. MUST impedir acceso cruzado por filtros o caché. La incorporación de documentos recibidos y percepciones dinámicas MUST conservar el contrato y universo del reporte de ventas.

#### Scenario: Acceso cruzado
- **WHEN** un usuario del tenant A intenta seleccionar documentos del tenant B
- **THEN** no obtiene datos ni nombres de percepciones del tenant B

#### Scenario: Reporte de ventas intacto
- **WHEN** se usa la exportación de ventas después de incorporar el reporte de compras
- **THEN** conserva sus columnas y universo existentes
- **AND** no recibe documentos de compra ni sus columnas dinámicas de percepciones
