# Spec Delta

## Purpose

Permitir exportar facturas y retenciones documentales de compras y gastos con 11 columnas fijas de facturas, columnas adicionales para las demás percepciones presentes, IVA totalizado entre alícuotas confirmadas y sumas reproducibles, sin alterar el circuito financiero.

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

### Requirement: Columnas fijas y columnas de percepciones
La hoja «Facturas» SHALL comenzar, en este orden, con «Fecha», «Razón Social», «Número», «CUIT», «Tipo Fac», «Total», «Neto», «IVA», «No Gravado» y «Percep. IVA». «Concepto de gasto» SHALL ser siempre la última columna. CSV y XLSX MUST compartir esos encabezados y orden. Los datos ausentes MUST permanecer sin informar.

#### Scenario: Encabezados y orden de facturas
- **WHEN** se genera el reporte inicial de compras
- **THEN** la hoja «Facturas» contiene las 11 columnas fijas en el orden acordado
- **AND** no agrega columnas de identificadores ni metadatos

#### Scenario: Columnas de otras percepciones presentes
- **GIVEN** las facturas seleccionadas contienen percepciones de Ganancias y «Municipal»
- **WHEN** se genera el reporte
- **THEN** «Percepción: Ganancias» y «Percepción: Municipal» aparecen entre «Percep. IVA» y «Concepto de gasto»
- **AND** cada columna solo aparece si esa percepción está presente en la selección

#### Scenario: Datos de autorización ausentes
- **GIVEN** una factura manual sin CAE informado
- **WHEN** se exporta
- **THEN** se mantienen las columnas fijas acordadas y no se fabrica un CAE
- **AND** no se exige ambiente de emisión o estado AUTORIZADA de B2Car

### Requirement: Columnas adicionales para percepciones
Entre «Percep. IVA» y «Concepto de gasto», el reporte SHALL agregar una columna por cada percepción distinta presente en las facturas seleccionadas. La percepción de IVA SHALL aparecer solo en su columna fija. Cada jurisdicción de IIBB presente SHALL tener su propia columna adicional.

#### Scenario: Percepción de IVA en su columna fija
- **GIVEN** las facturas seleccionadas contienen percepciones de IVA e IIBB Buenos Aires y CABA
- **WHEN** se genera el reporte
- **THEN** el importe de IVA aparece una sola vez, en «Percep. IVA»

#### Scenario: Percepción exclusiva de la última página
- **GIVEN** 1205 facturas seleccionadas y una percepción adicional presente solo en la última
- **WHEN** se genera el reporte
- **THEN** aparece su columna y conserva el importe de esa factura

#### Scenario: Percepción fuera del filtro
- **GIVEN** una percepción presente solo en una factura excluida por período
- **WHEN** se genera el reporte filtrado
- **THEN** esa percepción no agrega una columna

### Requirement: Percepciones en columnas y total de factura
La columna «Percep. IVA» SHALL sumar los importes manuales de percepción de IVA de cada factura. Cada otra percepción distinta presente SHALL tener una columna propia, incluidas las jurisdicciones de IIBB. Todos estos importes permanecen incluidos en «Total» junto con los conceptos.

#### Scenario: IIBB separado por jurisdicción
- **GIVEN** una factura con percepciones de IVA, IIBB Buenos Aires e IIBB CABA
- **WHEN** se exporta
- **THEN** «Percepción: IIBB Buenos Aires» y «Percepción: IIBB CABA» muestran sus respectivos importes
- **AND** las tres percepciones permanecen incluidas en «Total»

#### Scenario: Columnas adicionales solo para percepciones presentes
- **GIVEN** una factura seleccionada con una percepción de Ganancias o de nombre libre
- **WHEN** se genera el reporte
- **THEN** se agrega una columna para cada percepción distinta presente
- **AND** el importe permanece incluido en «Total» y no se crea una columna para percepciones ausentes

### Requirement: Importes manuales y sumas por percepción
Las columnas fijas y adicionales de percepciones SHALL sumar los importes manuales correspondientes por factura. El resumen SHALL totalizar cada percepción sin duplicar importes ya incluidos en «Total». MUST NOT calcular porcentajes, inferir montos desde la condición fiscal o reemplazar valores informados por cálculos tributarios.

#### Scenario: Percepción repetida dentro de una factura
- **GIVEN** una factura con dos líneas de la misma percepción por 1000 y 500
- **WHEN** se exporta
- **THEN** la celda correspondiente muestra 1500 y el resumen cuenta ese importe una sola vez
- **AND** el documento mantiene sus dos líneas originales

### Requirement: Una fila por factura
El detalle SHALL contener una fila por factura seleccionada aunque la operación tenga varios documentos, pagos o líneas. MUST NOT agregar filas por conceptos, percepciones o relaciones ni multiplicar importes.

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
El reporte SHALL usar el desglose confirmado de cada factura A. «Neto» SHALL sumar las bases confirmadas y «IVA» SHALL sumar el IVA confirmado de todas las alícuotas. La pestaña «Resumen» SHALL llamar «Total IVA» a ese total y MUST NOT presentarlo como «IVA 21%».

### Requirement: Resumen limitado a los totales solicitados
La hoja «Resumen» SHALL tener las columnas «Concepto», «Importe», «Cantidad» y «Detalle». Primero SHALL mostrar «Período inclusivo», «Operaciones incluidas» y «Moneda», con cada valor en «Detalle». Luego SHALL mostrar, en este orden, cantidad de facturas, total de facturas, total neto, total no gravado y total IVA, seguidos por una fila con el total para cada percepción distinta presente en las facturas del período. No SHALL agregar otros importes, conteos, metadatos ni explicaciones. La sección de resumen del CSV SHALL presentar las mismas filas y columnas.

#### Scenario: Factura A con dos alícuotas confirmadas
- **GIVEN** una factura con base 10000 e IVA 2100 al 21%, y base 20000 e IVA 2100 al 10,5%
- **WHEN** se exporta
- **THEN** «Neto» muestra 30000 y «IVA» muestra 4200
- **AND** «IVA» incluye el total de todas las alícuotas confirmadas, sin una columna separada por tasa

#### Scenario: Totales únicos del resumen
- **GIVEN** facturas del período con neto, no gravado, IVA confirmado y dos tipos de percepción
- **WHEN** se genera el reporte
- **THEN** el resumen comienza con «Período inclusivo», «Operaciones incluidas» y «Moneda», con sus valores en «Detalle»
- **AND** después presenta, en orden, «Cantidad de facturas», «Total de facturas», «Total neto», «Total no gravado» y «Total IVA»
- **AND** agrega una fila por cada percepción distinta presente en las facturas del período
- **AND** no agrega otros importes, conteos ni filas informativas
- **AND** el total IVA suma todas las alícuotas confirmadas y no se presenta como «IVA 21%»

### Requirement: Datos fiscales ausentes o sin desglose
El reporte MUST dejar vacíos los datos desconocidos y distinguir ceros informados. En el resumen, cada importe fiscal SHALL sumar los valores disponibles y quedar vacío si todos los comprobantes carecen del dato. El resumen MUST NOT incluir conteos de faltantes ni anotaciones de sumas parciales. El reporte MUST NOT reconstruir el desglose a partir del texto, del total, de la operación, de pagos o de fichas actuales. Debe conservar el total documentado original aunque falte el desglose. En facturas B y C MUST NOT extraer IVA del importe final. El IVA contenido informado manualmente en una B se muestra como dato informativo y no aporta base ni IVA discriminado.

#### Scenario: Factura B con IVA contenido y factura C
- **GIVEN** una factura B que muestra IVA contenido y una factura C con su importe final
- **WHEN** se exportan
- **THEN** cada fila conserva el importe final informado
- **AND** el IVA contenido de la B y el importe final de la C no aportan base ni IVA discriminado
- **AND** el IVA contenido informado de la B se identifica en observaciones sin modificar su total documentado

#### Scenario: Factura histórica de una operación con tasa por defecto
- **GIVEN** una factura con importe final sin desglose y una operación asociada con alícuota 21%
- **WHEN** se exporta
- **THEN** se conserva el importe final y los datos fiscales sin fuente quedan vacíos

#### Scenario: Importe informado en parte de los comprobantes
- **GIVEN** una selección en la que algunas facturas informan un importe fiscal y otras lo tienen ausente
- **WHEN** se exporta el resumen
- **THEN** el importe muestra la suma parcial de los valores informados, incluidos los ceros
- **AND** no se agregan al resumen filas ni anotaciones sobre los comprobantes que carecen del dato
- **AND** si el dato está ausente en todas las facturas, el importe queda vacío

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
- **THEN** no se incluye la factura ni se conservan sus importes en las sumas del reporte
- **AND** una columna adicional aportada solo por esa percepción deja de aparecer

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
Los formatos CSV y XLSX SHALL compartir documentos, valores, las 11 columnas fijas y las columnas adicionales de percepciones presentes en una misma selección. MUST conciliar detalle y resumen y conservar importes utilizables. Textos MUST NOT ejecutar fórmulas en la planilla.

#### Scenario: Dos formatos de la misma selección
- **GIVEN** CSV y XLSX habilitados para el mismo conjunto
- **WHEN** se descargan ambos
- **THEN** contienen las mismas 11 columnas fijas y las mismas columnas adicionales de percepciones
- **AND** sus importes concilian, incluido el IVA total de todas las alícuotas confirmadas

#### Scenario: Nombre de percepción con apariencia de fórmula
- **GIVEN** una percepción personalizada cuyo nombre comienza con un carácter interpretable como fórmula
- **WHEN** se serializa el encabezado y el detalle
- **THEN** el texto no ejecuta una fórmula

#### Scenario: Selección vacía
- **WHEN** no hay documentos incluidos
- **THEN** se conservan las 11 columnas fijas acordadas, se indica cantidad cero y no se agregan columnas de percepciones

### Requirement: Generación completa y consistente
El reporte SHALL incluir todas las páginas y entregar el detalle con sus 11 columnas fijas, todas las columnas adicionales de percepciones presentes y sumas consistentes ante altas, ediciones y eliminaciones concurrentes. MUST NOT presentar un archivo parcial como definitivo si falla la lectura o no puede asegurarse consistencia. La exportación MUST NOT modificar documentos, operaciones o finanzas.

#### Scenario: Error al leer documentos
- **WHEN** falla una página al obtener documentos
- **THEN** se informa un error sin entregar un archivo parcial presentado como completo

### Requirement: Acceso autorizado y compatibilidad con ventas
El reporte SHALL exigir sesión, pertenencia al tenant y permiso efectivo de consulta/exportación. MUST impedir acceso cruzado por filtros o caché. La incorporación de documentos recibidos MUST conservar el contrato y universo del reporte de ventas.

#### Scenario: Acceso cruzado
- **WHEN** un usuario del tenant A intenta seleccionar documentos del tenant B
- **THEN** no obtiene datos ni nombres de percepciones del tenant B

#### Scenario: Reporte de ventas intacto
- **WHEN** se usa la exportación de ventas después de incorporar el reporte de compras
- **THEN** conserva sus columnas y universo existentes
- **AND** no recibe documentos de compra ni sus columnas de detalle
