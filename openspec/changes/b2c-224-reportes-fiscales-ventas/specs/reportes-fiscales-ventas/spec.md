# Spec Delta

## Purpose

Permitir que el contador revise y trabaje los comprobantes fiscales de ventas de un período mediante CSV o XLSX, con identificación histórica, bases, IVA, tributos y totales conciliables. El reporte conserva la trazabilidad de arreglos y ventas y hace visibles los datos faltantes.

## ADDED Requirements

### Requirement: Universo de comprobantes fiscales
El reporte SHALL incluir facturas, NC y ND autorizadas del ambiente configurado, originadas en arreglos o ventas del tenant, incluidas las FCE existentes. MUST excluir remitos, presupuestos, ventas sin comprobante, compras, gastos, comprobantes sin autorización y comprobantes del otro ambiente.

#### Scenario: Estados y orígenes incluidos
- **GIVEN** `ARCA_AMBIENTE=PRODUCCION`, facturas autorizadas de un arreglo y una venta, una NC, una ND, una FCE, un borrador y un comprobante de homologación
- **WHEN** se genera el reporte del período
- **THEN** aparecen los cinco documentos autorizados de producción que correspondan al período
- **AND** el borrador y la homologación quedan excluidos

#### Scenario: Comprobante impago o FCE con seguimiento manual
- **GIVEN** una factura autorizada impaga y una FCE autorizada con estado manual cancelada
- **WHEN** ambas pertenecen al período seleccionado
- **THEN** ambas se incluyen por su autorización fiscal, sin depender del pago ni del estado manual de seguimiento

### Requirement: Ambiente según configuración del servidor
El reporte SHALL resolver el ambiente con `getFacturacionAmbiente()` desde `ARCA_AMBIENTE`: `PRODUCCION` únicamente con ese valor explícito y `HOMOLOGACION` en los demás casos. MUST NOT mezclar ambientes ni aceptar su elección por el cliente. El resumen XLSX SHALL identificar el ambiente efectivo.

#### Scenario: Reporte en homologación
- **GIVEN** `ARCA_AMBIENTE=HOMOLOGACION`, dos facturas autorizadas de homologación y una factura autorizada de producción dentro del período
- **WHEN** se genera el reporte
- **THEN** aparecen las dos facturas de homologación y queda excluida la de producción
- **AND** el resumen del XLSX identifica Homologación como ambiente efectivo

#### Scenario: Variable ausente o no válida
- **GIVEN** que `ARCA_AMBIENTE` no está definida o tiene un valor distinto de `PRODUCCION`
- **WHEN** se genera el reporte
- **THEN** se selecciona únicamente homologación, según la resolución de ambiente existente

#### Scenario: El cliente intenta cambiar el ambiente
- **GIVEN** cualquier ambiente configurado en el servidor
- **WHEN** una solicitud fiscal incluye el parámetro `ambiente`
- **THEN** se rechaza como filtro incompatible, sin reemplazar el ambiente configurado

### Requirement: Acceso por tenant y permiso
El sistema SHALL exigir sesión, membresía activa y el permiso efectivo de consulta de facturas. MUST derivar el tenant de la sesión y mantener ese aislamiento para comprobantes, líneas y referencias asociadas.

#### Scenario: Aislamiento de datos
- **GIVEN** un usuario habilitado en el tenant A y comprobantes del tenant B
- **WHEN** solicita un reporte o intenta indicar el tenant B en la solicitud
- **THEN** el archivo solo contiene información accesible del tenant A

#### Scenario: Permiso insuficiente
- **WHEN** un usuario sin membresía activa o sin permiso efectivo solicita el reporte
- **THEN** el sistema rechaza la solicitud y no entrega un archivo fiscal

### Requirement: Período y filtros explícitos
El reporte SHALL requerir fechas desde y hasta inclusivas por fecha del comprobante. SHALL ofrecer filtros opcionales por documento, origen y CUIT emisor, con todos seleccionados por defecto. MUST mostrar que incluye comprobantes autorizados del ambiente configurado para facturación, sin selector de ambiente, e ignorar filtros de búsqueda, estado, ambiente y paginación del listado general.

#### Scenario: Fechas fiscales frente a fechas operativas
- **GIVEN** un comprobante con fecha fiscal 31/10 autorizado el 01/11 y un arreglo de septiembre
- **WHEN** se genera el reporte del 01/10 al 31/10
- **THEN** se incluye según su fecha fiscal, sin desplazarla por zona horaria ni por fecha del arreglo

#### Scenario: Solicitud inválida
- **WHEN** faltan fechas, una fecha es inválida, desde es posterior a hasta o un filtro tiene un valor no admitido
- **THEN** el sistema informa un error de validación y no reemplaza silenciosamente el alcance solicitado

#### Scenario: Listado con filtros ajenos al reporte
- **GIVEN** un listado con búsqueda de un cliente, estado rechazada y página 3
- **WHEN** el usuario abre el formulario de reporte
- **THEN** puede revisar un período y filtros fiscales propios sin heredar silenciosamente esa búsqueda, estado o página

### Requirement: Una fila por comprobante y exportación completa
El reporte SHALL contener exactamente una fila por comprobante seleccionado, en orden estable por fecha y un desempate único. MUST exportar todas las páginas y establecer un instante de corte para excluir autorizaciones posteriores al comienzo de la generación.

#### Scenario: Varias páginas, líneas y pagos
- **GIVEN** 1205 comprobantes seleccionados, algunos con varias líneas y pagos
- **WHEN** se genera el reporte
- **THEN** el detalle contiene 1205 filas sin duplicar cabeceras ni detenerse en el límite de una página

#### Scenario: Autorización durante la exportación
- **GIVEN** un reporte iniciado en un instante de corte
- **WHEN** otro comprobante del mismo período se autoriza después de ese instante
- **THEN** ese comprobante queda para una generación posterior y no altera la paginación del reporte en curso

### Requirement: Identificación fiscal histórica
Cada fila SHALL identificar fecha fiscal, número con punto de venta, tipo y clase de documento, código ARCA, CAE y vencimiento, CUIT emisor, nombre del receptor, tipo y número de documento y condición IVA. MUST conservar los datos registrados al emitir y distinguir la FCE de la factura ordinaria.

#### Scenario: Receptor distinto del cliente de la operación
- **GIVEN** una factura emitida a un receptor alternativo y cambios posteriores en la ficha del cliente asociado
- **WHEN** se exporta
- **THEN** la fila muestra el receptor de esa factura y conserva su identidad histórica

#### Scenario: Consumidor final sin identificar
- **GIVEN** un comprobante emitido a consumidor final con documento 99/0
- **WHEN** se genera el reporte
- **THEN** se conserva esa identificación sin completar datos del cliente del arreglo o venta

### Requirement: Columnas de importes fiscales
El detalle SHALL incluir neto gravado, importe sin IVA de clase C, exento, no gravado, base e IVA al 21%, total base imponible, IVA total, otros tributos, impuestos nacionales informativos y total. Otras alícuotas MUST quedar fuera de las columnas de esta versión. MUST diferenciar cero conocido de desglose desconocido.

#### Scenario: IVA al 21% con conceptos exentos y no gravados
- **GIVEN** un comprobante con neto gravado 300 al 21%, 50 exentos y 30 no gravados
- **WHEN** se exporta
- **THEN** muestra base 21% de 300, IVA 21% de 63, neto gravado 300, exento 50, no gravado 30 y total 443
- **AND** total base imponible vale 300 y no se agregan columnas para otras alícuotas

#### Scenario: Histórico con una alícuota fuera de alcance
- **GIVEN** un comprobante histórico con neto 100 al 10,5%, IVA total 10,50 y total 110,50
- **WHEN** se exporta
- **THEN** conserva el neto gravado, IVA total y total guardados e identifica el desglose como incompleto por alícuota fuera de alcance
- **AND** no atribuye esos importes al 21%, no agrega columnas nuevas ni excluye el comprobante

### Requirement: Desglose desde la información fiscal emitida
El reporte SHALL obtener la base y el IVA al 21% de los conceptos fiscales históricos, incluyendo los originales preservados en un detalle simplificado. MUST evitar sumar simultáneamente la línea simplificada y sus originales o recalcular IVA desde precios actuales o una tasa supuesta.

#### Scenario: Detalle simplificado con tratamientos diferentes
- **GIVEN** una factura simplificada cuya presentación agrupa un neto original de 100 al 21% y 50 exentos
- **WHEN** se exporta
- **THEN** muestra base 21% de 100, IVA 21% de 21, exento 50 y total 171 desde los originales guardados
- **AND** no duplica el importe de la línea de presentación

#### Scenario: Cambio posterior de precios o impuestos
- **GIVEN** un producto cuya alícuota o precio actual difiere del facturado
- **WHEN** se exporta el comprobante histórico
- **THEN** se conservan sus importes y alícuotas de emisión

### Requirement: Presentación de comprobantes clase C
Para documentos clase C el reporte SHALL presentar el importe sin IVA en una columna propia, separar exentos y no gravados y mostrar cero en base 21% e IVA 21%. MUST conservar el IVA total guardado y advertir si resulta incompatible con clase C, sin reclasificar el documento como gravado al 0%.

#### Scenario: Clase C con conceptos separados
- **GIVEN** un documento C con importe interno sin IVA 100, exento 50, no gravado 20 y total 170
- **WHEN** se exporta
- **THEN** muestra importe sin IVA clase C 100, exento 50, no gravado 20 y total 170
- **AND** neto gravado, total base imponible, base 21% e IVA 21% valen cero

#### Scenario: Cabecera C históricamente inconsistente
- **GIVEN** un comprobante C con un IVA total guardado distinto de cero
- **WHEN** se exporta
- **THEN** conserva ese IVA total con una observación de inconsistencia y no lo distribuye a una alícuota supuesta

### Requirement: Signos y referencias de NC y ND
Las NC SHALL tener todos sus importes monetarios negativos; facturas y ND, positivos, sin modificar lo persistido. Las notas SHALL informar el comprobante asociado e incluirse por su propia fecha, aun si la factura pertenece a otro período.

#### Scenario: NC parcial de una factura anterior
- **GIVEN** una factura de septiembre y una NC de octubre por neto 100 e IVA 21
- **WHEN** se exporta octubre
- **THEN** aparece la NC con neto -100, IVA -21, total -121 y referencia a la factura de septiembre
- **AND** la factura de septiembre no se agrega al período por esa referencia

#### Scenario: ND y compensación total
- **GIVEN** una factura por 121, una NC por 121 y una ND por 60,50 dentro del período
- **WHEN** se suman los totales exportados
- **THEN** el resultado neto es 60,50 y se conservan las tres filas

### Requirement: Tributos efectivamente registrados
El reporte SHALL mostrar el importe agregado de otros tributos registrado y mantener los impuestos nacionales informativos separados de la suma del total. MUST evitar inventar categorías de percepción, calcular impuestos nuevos o interpretar la inscripción IIBB del emisor como un importe percibido.

#### Scenario: Sin tributos facturados
- **GIVEN** un comprobante con otros tributos registrados en cero
- **WHEN** se exporta
- **THEN** muestra cero en otros tributos sin generar percepciones de IVA o IIBB ficticias

#### Scenario: Tributos agregados sin detalle
- **GIVEN** un comprobante histórico con otros tributos 15 y sin desglose de categorías
- **WHEN** se exporta
- **THEN** mantiene los 15 en el total agregado e indica que falta su detalle
- **AND** no asigna ese importe a una jurisdicción o percepción supuesta

#### Scenario: Información de impuestos contenidos
- **GIVEN** un comprobante cuyo total guardado ya contiene los impuestos nacionales informados
- **WHEN** se genera el detalle y el resumen
- **THEN** el dato informativo no vuelve a sumarse al total

### Requirement: Información histórica incompleta
El reporte SHALL conservar comprobantes e importes fiscales disponibles e identificar el estado del desglose y sus observaciones. MUST dejar sin valor los componentes desconocidos, señalar inconsistencias y evitar presentarlos como cero, alterar el comprobante o reconstruirlos desde información operativa actual.

#### Scenario: IVA total conocido sin desglose verificable al 21%
- **GIVEN** un comprobante con IVA total guardado pero sin líneas fiscales que permitan verificar su base e IVA al 21%
- **WHEN** se exporta
- **THEN** conserva ese IVA total, deja indeterminado el desglose al 21% y marca la fila como incompleta

#### Scenario: Diferencia entre cabecera y detalle
- **GIVEN** líneas fiscales cuya suma difiere un centavo de la cabecera
- **WHEN** se exporta
- **THEN** conserva ambas fuentes y registra la diferencia, sin ajustar una alícuota para ocultarla

### Requirement: Resumen conciliado
El XLSX SHALL resumir período, moneda, instante de generación, emisor, cantidad y totales de las filas exportadas. MUST calcular importes en centavos, aplicar los mismos signos y separar subtotales por CUIT emisor y clase. SHALL informar cantidades de filas con datos fiscales incompletos.

#### Scenario: Sumas reproducibles
- **WHEN** el contador suma una columna monetaria del detalle
- **THEN** obtiene exactamente el resumen de esa columna para el mismo conjunto de filas
- **AND** el resumen no se recalcula dividiendo el total por 1,21

#### Scenario: Tenant con más de un emisor histórico
- **GIVEN** comprobantes de dos CUIT emisores y clases A y C
- **WHEN** se genera el XLSX
- **THEN** identifica sus emisores y separa sus subtotales por CUIT y clase, sin tratar el importe de clase C como base gravada de clase A

#### Scenario: Columna con valores desconocidos
- **GIVEN** filas cuyo IVA total es conocido pero cuyo desglose al 21% está incompleto o fuera de alcance
- **WHEN** se genera el resumen
- **THEN** el IVA total concilia con las filas y los subtotales del desglose se identifican como parciales con cantidad de datos faltantes
- **AND** un conjunto de valores desconocidos no se presenta como un total cero completo

### Requirement: Formatos y ausencia de resultados
CSV y XLSX SHALL usar las mismas filas, columnas y reglas fiscales de detalle. El XLSX SHALL entregar resumen y una tabla filtrable con encabezado fijo; el CSV, un encabezado estable sin filas de resumen. MUST conservar identificadores como texto e importes numéricos utilizables por el contador.

#### Scenario: Equivalencia de formatos
- **WHEN** se generan CSV y XLSX sobre el mismo conjunto de comprobantes
- **THEN** ambos expresan el mismo detalle fiscal y los mismos signos, aunque difiera el formato de fechas o decimales de presentación

#### Scenario: Período sin movimientos
- **WHEN** ningún comprobante coincide con los filtros
- **THEN** el CSV contiene el encabezado completo sin registros
- **AND** el XLSX contiene la tabla vacía y un resumen con cantidad y totales cero

#### Scenario: Datos que parecen fórmulas
- **GIVEN** un nombre de receptor que comienza con un carácter interpretado como fórmula por una planilla
- **WHEN** se descarga y abre el archivo
- **THEN** ese texto no ejecuta una fórmula y los importes negativos de las NC siguen siendo valores numéricos

### Requirement: Generación íntegra y compatibilidad
La modalidad fiscal SHALL ser explícita y mantener disponible la exportación general existente. MUST informar fallos de lectura o generación sin entregar archivos parciales presentados como completos, y evitar compartir archivos entre tenants mediante caché.

#### Scenario: Exportación general existente
- **WHEN** se usa la descarga general sin seleccionar la modalidad fiscal
- **THEN** conserva su contrato y filtros actuales

#### Scenario: Fallo en una página intermedia
- **GIVEN** un reporte que requiere varias lecturas
- **WHEN** una lectura falla
- **THEN** el usuario recibe un error y no un archivo incompleto con totales aparentando cubrir el período

### Requirement: Omitir provincia sin fuente guardada
El reporte inicial SHALL omitir la columna «Provincia del receptor» en CSV y XLSX porque no existe una fuente guardada verificable. MUST NOT agregar observaciones ni conteos de provincia faltante. Una futura incorporación SHALL requerir resolver su fuente, significado y procedencia temporal antes de ampliar el contrato.

#### Scenario: Fuentes actuales sin provincia
- **GIVEN** que los snapshots actuales no conservan provincia
- **WHEN** se exporta con el contrato inicial
- **THEN** CSV y XLSX omiten esa columna incluso en un período vacío
- **AND** no se deduce provincia desde texto libre ni desde otro receptor ni se consulta al padrón durante la descarga

#### Scenario: Captura o enriquecimiento aún no definidos
- **WHEN** se prepara la implementación de carga en cliente/factura o consultas al padrón durante la generación
- **THEN** se requiere resolver y registrar la utilidad, el tipo de provincia, su procedencia temporal, la persistencia y la política de consultas
- **AND** el contrato inicial no presupone resueltas esas decisiones ni habilita reescribir comprobantes autorizados
