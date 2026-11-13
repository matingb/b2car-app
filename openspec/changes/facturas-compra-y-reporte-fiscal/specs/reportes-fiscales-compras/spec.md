# Spec Delta

## Purpose

Permitir obtener el detalle y las sumas de documentos de compras y gastos para control del contador, con una primera versión de columnas similar al reporte de ventas, adaptada a proveedores, IVA por alícuota y conceptos informados.

Las columnas y formatos definitivos, las fechas por tipo y la presentación de retenciones siguen pendientes en P-REP/P-RET. Que una retención cancele deuda no define por sí solo su inclusión fiscal en un período del reporte.

## ADDED Requirements

### Requirement: Universo de facturas de compras
El reporte SHALL seleccionar facturas A/B/C de compras y gastos registradas del tenant conforme al período y alcance aprobados. MUST mantenerlas separadas de comprobantes emitidos por B2Car y de operaciones sin factura. La selección MUST NOT depender de que la operación esté completamente pagada, cancelada con retenciones o recibida.

#### Scenario: Compra parcialmente pagada
- **GIVEN** una factura de compra por 121000 y un pago de 60000
- **WHEN** el documento pertenece al período y alcance seleccionados
- **THEN** el reporte muestra el total facturado de 121000
- **AND** no lo reemplaza por el importe pagado

#### Scenario: Compra sin factura y factura emitida
- **GIVEN** una compra sin factura y una factura de venta emitida por B2Car
- **WHEN** se genera el reporte de compras
- **THEN** ninguno de esos dos elementos se convierte en una fila de compra facturada

#### Scenario: Factura de gasto
- **GIVEN** una factura de gasto registrada y comprendida en el período seleccionado
- **WHEN** se genera el reporte
- **THEN** se incluye con la identidad fiscal e importes informados en el documento
- **AND** no se reconstruye el emisor desde un proveedor comercial inexistente

### Requirement: Columnas basadas en ventas y adaptadas a compras
La primera versión SHALL tomar el reporte fiscal de ventas como referencia de columnas, adaptando la identificación del proveedor/emisor y los datos del documento. MUST representar netos, exentos/no gravados, IVA por alícuota, conceptos adicionales y total informados conforme al contrato final de columnas, sin copiar restricciones de emisión ajenas a compras.

#### Scenario: Identificación del proveedor
- **GIVEN** una factura de compra con identidad fiscal del proveedor y del receptor registradas
- **WHEN** se genera una fila con el contrato aprobado
- **THEN** se identifica al proveedor/emisor del documento
- **AND** los datos de receptor no se usan como sustituto del proveedor

#### Scenario: Sin ambiente ni autorización de emisión
- **GIVEN** una factura de proveedor cargada manualmente y válida según las reglas locales
- **WHEN** se selecciona para el reporte
- **THEN** no se le exige un ambiente de emisión ni un estado AUTORIZADA de B2Car

### Requirement: Período explícito según el criterio acordado
El reporte SHALL exigir un período desde/hasta válido y aplicar el criterio temporal aprobado para cada tipo incluido, indicando ese criterio al usuario. MUST NOT sustituir silenciosamente la fecha elegida por la de compra, pago o carga. Las fechas calendario MUST conservar su día sin desplazamientos de zona horaria.

#### Scenario: Selección por emisión si se confirma ese criterio
- **GIVEN** un contrato aprobado por fecha de emisión y una factura emitida el 31 de octubre, de una compra de septiembre y cargada el 2 de noviembre
- **WHEN** se exporta del 1 al 31 de octubre
- **THEN** la factura se incluye por su fecha de emisión
- **AND** el día no se desplaza por conversiones de zona horaria

#### Scenario: Rango inválido
- **WHEN** faltan fechas, alguna es inválida o desde es posterior a hasta
- **THEN** se informa el error sin descargar un archivo con otro período supuesto

### Requirement: Una fila por factura
El detalle SHALL contener exactamente una fila por factura seleccionada, aunque la compra tenga varias facturas, pagos, retenciones o componentes fiscales. MUST conservar identificación rastreable al documento y MUST NOT multiplicar filas o importes por sus relaciones.

#### Scenario: Varias facturas de la misma compra
- **GIVEN** una compra con dos facturas seleccionadas por 60500 cada una
- **WHEN** se genera el reporte
- **THEN** aparecen dos filas, una por factura, con total facturado conjunto de 121000
- **AND** no aparece una tercera fila por el monto de la compra

#### Scenario: Factura con múltiples relaciones
- **GIVEN** una factura con varios componentes, dos pagos y un documento de retención asociado al circuito de la compra
- **WHEN** se exporta
- **THEN** aparece una sola fila de esa factura con sus importes fiscales
- **AND** las relaciones no multiplican sus sumas

### Requirement: Identidad e importes desde el documento
El reporte SHALL usar la identidad histórica y los importes vigentes registrados en cada documento. MUST reflejar las correcciones explícitas guardadas y excluir documentos eliminados del universo vigente. MUST NOT reconstruir datos desde precios, stock, pagos o fichas actuales del proveedor.

#### Scenario: Cambio de proveedor y edición explícita
- **GIVEN** una factura guardada y un cambio posterior en la ficha del proveedor
- **WHEN** se exporta sin haber editado el documento
- **THEN** la fila conserva la identidad registrada en la factura
- **WHEN** se corrige explícitamente la factura y se vuelve a exportar
- **THEN** la nueva exportación refleja la corrección guardada

#### Scenario: Factura eliminada
- **WHEN** se genera el reporte después de eliminar una factura
- **THEN** el documento eliminado no forma parte del detalle ni sus sumas vigentes

### Requirement: Desglose de IVA por alícuota
El reporte SHALL conservar las bases e importes de las alícuotas cargadas y el IVA total conforme al contrato aprobado. MUST NOT limitar el detalle al 21%, reasignar importes a una alícuota supuesta o fabricar bases dividiendo totales. La presentación elegida MUST permitir conciliar el desglose registrado.

#### Scenario: Más de una alícuota
- **GIVEN** una factura con dos alícuotas de IVA y sus respectivas bases e importes
- **WHEN** se exporta
- **THEN** el reporte permite reconocer ambos desgloses conforme al formato aprobado
- **AND** el total de IVA concilia con los importes registrados sin atribuir todo al 21%

### Requirement: Conceptos abiertos conservados en la exportación
El reporte SHALL conservar descripción e importe de los conceptos adicionales cargados, incluidos los que no pertenezcan a las sugerencias, y su jurisdicción si fue informada. MUST NOT descartar conceptos libres ni reclasificarlos automáticamente como una percepción o retención determinada.

#### Scenario: Concepto personalizado
- **GIVEN** una factura con un concepto adicional de descripción propia e importe manual
- **WHEN** se genera el reporte con el contrato aprobado
- **THEN** el concepto y su importe quedan representados sin perder su identificación
- **AND** no se les asigna un impuesto o efecto cancelatorio supuesto

### Requirement: Totales fiscales separados de la cancelación de deuda
El reporte SHALL sumar por separado netos, IVA, conceptos adicionales y total facturado, con precisión de centavos. MUST NOT determinar crédito fiscal ni deducibilidad, adicionar otra vez componentes incluidos en el total o reducir el total facturado por pagos o retenciones que cancelen deuda.

#### Scenario: Suma de dos facturas
- **GIVEN** una factura con neto 100000, IVA 21000 y total 121000, y otra con neto 200000, IVA 42000 y total 242000
- **WHEN** se genera el resumen
- **THEN** muestra neto 300000, IVA 63000 y total facturado 363000
- **AND** no adiciona nuevamente el IVA al total

#### Scenario: Compra saldada con retención
- **GIVEN** una factura por 121000, un pago de 115000 y una retención imputada de 6000
- **WHEN** se exporta la factura
- **THEN** su total facturado permanece en 121000 aunque el saldo operativo sea 0
- **AND** la retención no aumenta el total facturado a 127000 ni lo reduce a 115000

#### Scenario: Monedas diferentes si se habilitan
- **GIVEN** documentos de monedas diferentes dentro de un alcance aprobado
- **WHEN** se generan los totales
- **THEN** se separan por moneda o se usa una conversión explícita y trazable
- **AND** no se suman nominalmente monedas distintas como un total homogéneo

### Requirement: Retenciones con fuente y alcance explícitos
Si el contrato del reporte incluye retenciones, SHALL obtenerlas de sus documentos y contemplar el criterio temporal y de imputación aprobado. MUST distinguirlas del IVA y conceptos de factura, contarlas una sola vez y separarlas del total facturado. MUST NOT inferirlas desde pagos ni presentar ceros o sumas como cobertura completa de un universo no definido.

#### Scenario: Retención incluida sin duplicación
- **GIVEN** un contrato aprobado que incluye una retención documentada de 6000 y su criterio temporal
- **WHEN** la retención pertenece al período seleccionado
- **THEN** se representa con fuente rastreable y un único importe de 6000
- **AND** sus vínculos con pagos o facturas no multiplican ese importe

#### Scenario: Cobertura no acordada
- **WHEN** no está definido o no se incluye el universo de retenciones del reporte
- **THEN** el archivo no presenta una suma de retenciones como completa
- **AND** no usa una columna en cero para afirmar que no existieron retenciones

### Requirement: Desconocidos diferenciados de cero
El reporte SHALL distinguir valores no informados de ceros conocidos y señalar las sumas parciales. MUST NOT completar conceptos o desgloses desconocidos con importes supuestos, aun cuando otros componentes o el total sean conocidos.

#### Scenario: Columna con datos faltantes
- **GIVEN** valores conocidos y al menos un importe no informado dentro de una columna
- **WHEN** se calcula su resumen
- **THEN** se conserva la suma de los valores conocidos y se identifica como parcial
- **AND** el importe desconocido no se transforma en cero

### Requirement: Formatos conciliados y seguros
Los formatos habilitados por el contrato final SHALL representar el mismo conjunto e importes. Si se habilitan CSV y XLSX, SHALL compartir detalle normalizado; el XLSX tendrá detalle filtrable y resumen conciliado y el CSV encabezados estables. MUST preservar identificadores como texto e importes utilizables, evitando ejecución de fórmulas desde textos.

#### Scenario: CSV y XLSX si se confirman ambos formatos
- **GIVEN** CSV y XLSX habilitados para el mismo conjunto seleccionado
- **WHEN** se descargan ambos formatos
- **THEN** contienen los mismos documentos e importes
- **AND** las sumas del detalle coinciden con el resumen del XLSX

#### Scenario: Período sin facturas
- **WHEN** el período no tiene documentos incluidos
- **THEN** el formato aprobado conserva su estructura y señala cantidad cero

#### Scenario: Texto con apariencia de fórmula
- **GIVEN** un nombre de proveedor que comienza con un carácter interpretable como fórmula
- **WHEN** se exporta a una planilla
- **THEN** se conserva como texto sin ejecutar una fórmula

### Requirement: Generación completa y consistente
El reporte SHALL entregar el conjunto completo seleccionado con detalle y resumen consistentes ante altas, correcciones y eliminaciones concurrentes. MUST NOT presentar un archivo parcial como completo si falla una lectura o no puede garantizarse consistencia. La exportación MUST NOT modificar documentos, impuestos, imputaciones ni saldos.

#### Scenario: Varias páginas
- **GIVEN** 1205 facturas incluidas en el período
- **WHEN** se genera el reporte
- **THEN** se incluyen las 1205 sin detenerse en el límite de una página

#### Scenario: Fallo o cambio concurrente incompatible
- **WHEN** falla una lectura intermedia o una edición/eliminación impide asegurar consistencia
- **THEN** se informa un error sin entregar un archivo con sumas incompletas o versiones mezcladas presentado como definitivo

### Requirement: Acceso autorizado y compatibilidad con ventas
El reporte SHALL exigir sesión, pertenencia al tenant y permiso efectivo de consulta/exportación del circuito de documentos de compra. MUST impedir acceso cruzado por filtros o caché. MUST conservar el universo y contrato de exportación de ventas existente.

#### Scenario: Solicitud de otro tenant
- **WHEN** un usuario del tenant A intenta seleccionar documentos del tenant B
- **THEN** se rechaza la selección ajena o se limita al alcance autorizado sin divulgar datos del tenant B

#### Scenario: Exportación de ventas existente
- **WHEN** se descarga el reporte fiscal de ventas después de incorporar compras
- **THEN** conserva su contrato y no incorpora documentos de compra ni retenciones recibidas
