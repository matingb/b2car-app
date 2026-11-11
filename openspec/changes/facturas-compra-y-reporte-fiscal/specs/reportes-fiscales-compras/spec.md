# Spec Delta

## Purpose

Permitir obtener el detalle y las sumas de importes registrados en comprobantes recibidos de compras y gastos, para revisión del contador y control fiscal sin determinar obligaciones tributarias.

## ADDED Requirements

### Requirement: Universo de comprobantes recibidos
El reporte SHALL seleccionar comprobantes recibidos registrados del tenant, vinculados a compras o gastos, conforme al alcance revisado. MUST mantener separado este universo de las facturas emitidas por B2Car y de las operaciones que carezcan de comprobante recibido. La selección MUST NOT depender de que la compra esté pagada o recibida completamente.

#### Scenario: Compra parcialmente pagada
- **GIVEN** una factura de compra por 121000 y un pago de 60000
- **WHEN** el comprobante pertenece al período y alcance seleccionados
- **THEN** el reporte muestra su total facturado de 121000
- **AND** no lo reemplaza por el importe pagado

#### Scenario: Operación sin factura y factura de venta
- **GIVEN** una compra sin comprobante recibido y una factura emitida por B2Car
- **WHEN** se genera el reporte fiscal de compras
- **THEN** ninguno de esos dos elementos se convierte en una fila de compra facturada

### Requirement: Período fiscal explícito
El reporte SHALL exigir un período desde/hasta válido, inclusivo por fecha de emisión del comprobante, y mostrar ese criterio al usuario. MUST NOT usar silenciosamente la fecha de la operación, del pago, de carga ni de autorización de facturas emitidas como reemplazo.

#### Scenario: Fechas operativa y fiscal diferentes
- **GIVEN** una compra de septiembre con factura emitida el 31 de octubre y cargada el 2 de noviembre
- **WHEN** se genera el reporte del 1 al 31 de octubre
- **THEN** se incluye la factura según su fecha de emisión
- **AND** la fecha calendario no se desplaza por conversiones de zona horaria

#### Scenario: Rango inválido
- **WHEN** faltan fechas, alguna fecha es inválida o desde es posterior a hasta
- **THEN** se informa el error de selección sin descargar un archivo con otro período supuesto

### Requirement: Una fila por comprobante
El detalle SHALL contener exactamente una fila por comprobante seleccionado, aunque tenga varios componentes fiscales, pagos, adjuntos o vínculos operativos admitidos. MUST conservar una identificación que permita rastrear la fila al comprobante registrado.

#### Scenario: Factura con relaciones múltiples
- **GIVEN** una factura seleccionada con dos pagos, dos componentes fiscales y dos adjuntos
- **WHEN** se genera el detalle
- **THEN** aparece una sola fila con sus importes fiscales
- **AND** las relaciones no multiplican las sumas

### Requirement: Identidad e importes desde el comprobante
El reporte SHALL usar la identificación histórica y los importes registrados en el comprobante recibido. MUST mostrar su emisor y receptor conforme al contrato de columnas revisado. MUST NOT reconstruirlos desde precios, stock, pagos o datos actuales de fichas comerciales.

#### Scenario: Cambio de ficha y de precio
- **GIVEN** una factura cargada y cambios posteriores en el proveedor y los precios de sus productos
- **WHEN** se exporta el comprobante
- **THEN** la fila conserva la identidad y los importes informados para esa factura

### Requirement: Totalización por concepto informado
El reporte SHALL mostrar y sumar por separado netos, IVA, otros conceptos cargados y total facturado. MUST conservar los importes monetarios con precisión de centavos. MUST NOT determinar crédito fiscal, deducibilidad ni alícuotas o retenciones a aplicar, ni sumar nuevamente al total los componentes ya incluidos en él.

#### Scenario: Suma de dos facturas
- **GIVEN** una factura con neto 100000, IVA 21000 y total 121000, y otra con neto 200000, IVA 42000 y total 242000
- **WHEN** se genera el resumen
- **THEN** muestra neto 300000, IVA 63000 y total facturado 363000
- **AND** no determina el crédito fiscal computable ni adiciona el IVA otra vez al total

#### Scenario: Monedas diferentes
- **GIVEN** comprobantes de monedas distintas si ese alcance se habilita
- **WHEN** se generan totales
- **THEN** se separan por moneda o se aplica una conversión explícitamente definida y trazable
- **AND** no se presenta una suma nominal de monedas diferentes como total homogéneo

### Requirement: Desconocidos y conceptos sin desglose
El reporte SHALL distinguir importes no informados de ceros conocidos y señalar sumas parciales. MUST conservar el IVA total conocido sin atribuirlo a una alícuota supuesta. Un agregado de tributos sin categoría MUST NOT convertirse en retenciones o percepciones específicas.

#### Scenario: IVA total sin alícuotas
- **GIVEN** una factura con IVA total 21000 y sin desglose por alícuota
- **WHEN** se exporta
- **THEN** el IVA total informado permanece en 21000
- **AND** no se fabrica una base al 21% dividiendo importes

#### Scenario: Campo desconocido en una suma
- **GIVEN** una columna con valores conocidos y al menos un importe no informado
- **WHEN** se calcula su resumen
- **THEN** se conserva la suma de los valores conocidos y se identifica como parcial
- **AND** el importe desconocido no se transforma silenciosamente en cero

### Requirement: Retenciones pendientes sin datos ficticios
El núcleo inicial MUST NOT ofrecer cálculo, captura o sumas de retenciones como una funcionalidad resuelta. MUST NOT presentar una columna de retenciones en cero como prueba de que no existieron. Su inclusión efectiva SHALL requerir una definición previa de fuente, relación con pagos y período de imputación.

#### Scenario: Facturas cargadas sin un circuito de retenciones definido
- **WHEN** se genera el reporte inicial de compras
- **THEN** se exportan los conceptos efectivamente soportados y registrados
- **AND** no se inventan importes de retenciones a partir del IVA, del tipo de factura o de los pagos
- **AND** no se presentan totales de retenciones como completos

### Requirement: Formatos y conciliación reproducible
CSV y XLSX SHALL representar el mismo detalle y valores. El XLSX SHALL ofrecer detalle filtrable y resumen conciliado; el CSV SHALL conservar encabezados estables. MUST preservar identificadores como texto e importes como valores utilizables y evitar que contenido textual ejecute fórmulas en la planilla.

#### Scenario: Conciliación entre formatos
- **WHEN** se descargan CSV y XLSX sobre el mismo conjunto de comprobantes
- **THEN** ambos contienen los mismos comprobantes e importes
- **AND** las sumas del detalle coinciden con el resumen del XLSX para ese conjunto

#### Scenario: Período sin comprobantes
- **WHEN** el período seleccionado no tiene comprobantes incluidos
- **THEN** el CSV conserva sus encabezados y el XLSX muestra detalle vacío y cantidad cero

#### Scenario: Nombre con apariencia de fórmula
- **GIVEN** un nombre de proveedor que comienza con un carácter interpretable como fórmula
- **WHEN** se exporta
- **THEN** se conserva como texto sin ejecutar una fórmula

### Requirement: Integridad de la generación
El reporte SHALL incluir el conjunto completo seleccionado con detalle y resumen consistentes. MUST NOT entregar un archivo parcial presentado como completo cuando falla una lectura, una página o la generación. Descargar el reporte MUST NOT modificar comprobantes ni consultar o persistir impuestos nuevos.

#### Scenario: Varias páginas de comprobantes
- **GIVEN** 1205 comprobantes incluidos en el período
- **WHEN** se exporta el reporte
- **THEN** se entregan los 1205 sin detenerse en el límite de una página

#### Scenario: Fallo de lectura intermedia
- **WHEN** falla la lectura de una página o la consistencia del conjunto no puede asegurarse
- **THEN** se informa un error y no se entrega un archivo con sumas incompletas presentadas como definitivas

### Requirement: Acceso y compatibilidad con ventas
El reporte SHALL exigir sesión, pertenencia al tenant y permiso efectivo de consulta/exportación. MUST impedir acceso cruzado por filtros o caché. La incorporación del reporte de compras MUST conservar el universo y contrato de exportación de ventas existente.

#### Scenario: Solicitud de otro tenant
- **WHEN** un usuario intenta obtener el reporte del tenant B desde una sesión del tenant A
- **THEN** se rechaza la selección ajena o se limita al alcance autorizado sin divulgar comprobantes del tenant B

#### Scenario: Exportación fiscal de ventas existente
- **WHEN** se usa la descarga fiscal de ventas después de habilitar la de compras
- **THEN** conserva su contrato y no incorpora comprobantes recibidos

