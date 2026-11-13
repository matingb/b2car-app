# Spec Delta

## Purpose

Permitir gestionar documentos de compras y gastos con identidad fiscal histórica, facturas A/B/C e importes manuales, e imputar retenciones de compras que cancelan deuda junto con los pagos sin duplicar movimientos de caja o inventario.

Se conserva COMPRA/GASTO del alcance anterior. Las particularidades de integración de gastos y los detalles restantes se mantienen en design.md, sección D8.

## ADDED Requirements

### Requirement: Registro opcional de varios documentos por compra
El sistema SHALL admitir cero o más documentos asociados a una compra del tenant. SHALL permitir cargar una factura opcionalmente durante la creación y agregar documentos posteriormente desde el detalle. MUST conservar válida una compra sin documentos y MUST NOT exigir que cada factura individual represente el monto completo de la compra.

#### Scenario: Compra sin factura
- **WHEN** un usuario registra una compra sin cargar una factura
- **THEN** la compra queda registrada y puede recibir documentos posteriormente
- **AND** no se genera una factura ficticia

#### Scenario: Varias facturas de una compra
- **GIVEN** una compra por 121000 con una factura asociada por 60500
- **WHEN** el usuario agrega otra factura por 60500
- **THEN** la compra conserva ambos documentos consultables de forma independiente
- **AND** no se exige que cada factura sea por 121000 ni se crea otra compra

### Requirement: Facturas vinculadas a gastos
El sistema SHALL conservar la carga de facturas asociadas a gastos del tenant. MUST permitir identificar fiscalmente al emisor en el documento aunque el gasto no tenga proveedor comercial asociado. La integración SHALL contemplar los puntos de alta de gastos existentes conforme a la adaptación acordada.

#### Scenario: Gasto sin proveedor comercial
- **GIVEN** un gasto del tenant sin proveedor previamente asociado
- **WHEN** un usuario autorizado registra su factura con la identificación fiscal del emisor
- **THEN** el comprobante queda vinculado y consultable desde el gasto
- **AND** la falta de proveedor comercial no se interpreta como ausencia de emisor fiscal

### Requirement: Gestión integrada en Documentos
El sistema SHALL presentar las facturas de compras/gastos y retenciones como documentos, accesibles desde su operación y el circuito de Documentos. MUST distinguir tipo y procedencia sin exponer decisiones de persistencia ni exigir emisión, certificados o autorización ante ARCA.

#### Scenario: Consultar documentos de una compra
- **GIVEN** una compra con una factura A y un documento de retención
- **WHEN** un usuario autorizado consulta sus documentos
- **THEN** identifica y abre cada documento por su tipo y procedencia
- **AND** no necesita configurar una integración de emisión para consultarlos

#### Scenario: Coexistencia con documentos emitidos
- **WHEN** se consulta el listado de Documentos con emitidos y documentos de compra
- **THEN** se distingue su procedencia y se permite acceder al detalle correspondiente
- **AND** los documentos de compra no aparecen como autorizados por ARCA por haber sido cargados manualmente

### Requirement: Datos fiscales configurables y precarga editable
El sistema SHALL permitir configurar datos fiscales del proveedor y precargarlos en el formulario cuando la compra tenga proveedor asociado. MUST permitir modificarlos en cada documento antes de guardar y al editarlo. Guardar cambios locales MUST NOT actualizar automáticamente la ficha del proveedor.

#### Scenario: Modificar la precarga
- **GIVEN** una compra con proveedor y sus datos fiscales configurados
- **WHEN** el usuario carga una factura y corrige la razón social precargada
- **THEN** la factura conserva el dato corregido
- **AND** la ficha del proveedor conserva su valor anterior

### Requirement: Identidad histórica editable del documento
El sistema SHALL conservar la identidad fiscal del emisor y receptor registrada en cada documento, con identificación y fecha según su tipo. Las facturas SHALL conservar tipo/clase, punto de venta y número. Cambiar fichas comerciales MUST NOT reescribir documentos anteriores; sus datos solo cambian mediante edición explícita del documento.

#### Scenario: Cambio de ficha del proveedor
- **GIVEN** una factura guardada con razón social y CUIT del proveedor
- **WHEN** se modifica la ficha fiscal del proveedor
- **THEN** la factura conserva sus datos registrados
- **AND** las nuevas cargas pueden precargar los datos actualizados

#### Scenario: Editar explícitamente la identidad
- **WHEN** un usuario autorizado corrige los datos fiscales de una factura guardada
- **THEN** la consulta y posteriores reportes reflejan la corrección del documento
- **AND** los otros documentos del proveedor no cambian

### Requirement: Facturas normales A B y C
El registro inicial de facturas de compra SHALL admitir las clases normales A, B y C. MUST NOT ofrecer NC/ND de compra ni comprobantes especiales como parte de esta versión. Los datos de autorización informados MUST conservarse como carga manual, sin afirmar que fueron verificados ante ARCA.

#### Scenario: Registrar factura de cada clase admitida
- **WHEN** se registra una factura A, B o C con los campos requeridos para esa clase
- **THEN** el documento conserva la clase seleccionada y su identificación
- **AND** el guardado no requiere una autorización de B2Car ante ARCA

### Requirement: IVA informado por alícuota
El sistema SHALL permitir registrar y conservar base e importe de IVA por cada alícuota admitida, junto con sus totales informados. MUST NOT limitar todo el IVA al 21% ni inferir un desglose desde el total. El tratamiento de datos no aplicables o incompletos SHALL seguir las validaciones acordadas por clase.

#### Scenario: Factura con varias alícuotas
- **WHEN** el usuario carga dos renglones de IVA con alícuotas, bases e importes diferentes
- **THEN** el documento conserva ambos renglones y sus importes
- **AND** la consulta no agrupa todo el IVA como si correspondiera al 21%

### Requirement: Percepciones y otros conceptos de carga abierta
El sistema SHALL permitir agregar conceptos adicionales con descripción e importe manuales, con sugerencias comunes y posibilidad de ingresar otros conceptos. Las sugerencias SHALL contemplar IIBB Buenos Aires, IIBB CABA, Ganancias e impuestos internos. MUST NOT imponer un catálogo cerrado ni determinar qué concepto corresponde aplicar.

#### Scenario: Concepto sugerido
- **WHEN** el usuario agrega IIBB Buenos Aires con un importe informado
- **THEN** el documento conserva el concepto y el monto cargado

#### Scenario: Concepto fuera de las sugerencias
- **WHEN** el usuario agrega un concepto con descripción propia e importe manual
- **THEN** puede guardarlo sin que la descripción deba pertenecer a las sugerencias
- **AND** no se transforma automáticamente en una retención que cancele deuda

### Requirement: Importes informados sin determinación tributaria
El sistema SHALL conservar netos, exentos, no gravados, IVA, conceptos adicionales y total informados, con precisión de centavos. MUST distinguir un importe no informado de cero. MUST NOT determinar crédito fiscal, deducibilidad, regímenes aplicables o retenciones a practicar ni alterar importes para hacer coincidir factura y operación.

#### Scenario: Factura con neto e IVA
- **WHEN** se carga una factura con neto 100000, IVA 21000 y total 121000
- **THEN** se conservan esos importes
- **AND** no se determina cuánto IVA puede computar el contribuyente

#### Scenario: Diferencia con la compra
- **GIVEN** una compra por 120000 con una única factura informada por 121000
- **WHEN** se intenta guardar la asociación
- **THEN** la diferencia se informa conforme a la política de conciliación acordada
- **AND** no se modifica automáticamente la factura ni la compra

### Requirement: Facturas independientes de pagos y stock
Crear, asociar, editar o eliminar una factura de compra MUST NOT crear otra operación, alterar su monto pactado, registrar o revertir pagos ni generar movimientos de stock. El efecto cancelatorio de una retención SHALL pertenecer a su documento e imputación, no a la mera presencia de una factura.

#### Scenario: Asociar factura a compra parcialmente pagada
- **GIVEN** una compra por 121000, un pago de 60000 y stock ya recibido
- **WHEN** se asocia una factura por 121000
- **THEN** la compra conserva su pago de 60000 y su stock
- **AND** la asociación no genera otra deuda ni otro pago

#### Scenario: Eliminar una factura
- **GIVEN** una compra con factura, pagos y movimientos de stock
- **WHEN** el usuario elimina la factura
- **THEN** la factura deja de participar en la consulta y reporte vigentes
- **AND** la compra, sus pagos y su stock no se eliminan ni se revierten

### Requirement: Guardado directo y documentos editables
El sistema SHALL guardar el formulario validado en el momento, sin estados de borrador. MUST permitir a usuarios autorizados editar y eliminar documentos guardados. La ausencia de verificación ante ARCA MUST NOT impedir esas acciones ni omitir las validaciones locales acordadas.

#### Scenario: Guardar y corregir una factura
- **WHEN** un usuario completa y guarda el formulario y después corrige un importe
- **THEN** el documento se consulta con la corrección guardada
- **AND** no requiere una transición de borrador a emisión o autorización

#### Scenario: Formulario inválido
- **WHEN** se intenta guardar un formulario que incumple las validaciones acordadas
- **THEN** se informa el error sin presentar el guardado como exitoso
- **AND** no se crea un borrador persistido como resultado alternativo

### Requirement: Retenciones como tipo de documento separado
El sistema SHALL permitir registrar retenciones que no figuren en la factura como un documento de tipo RETENCION dentro del mismo circuito de documentos de compra. MUST conservar su identificación, fecha, conceptos e importes aplicables al tipo sin exigir que se complete como una factura A/B/C. MUST NOT generarlas automáticamente desde IVA o conceptos libres.

#### Scenario: Factura y retención de una compra
- **WHEN** un usuario registra una factura y un documento de retención conforme al flujo acordado
- **THEN** ambos documentos se identifican y consultan por separado
- **AND** el documento de retención conserva sus propios conceptos e importe

### Requirement: Pago y retención cancelan juntos la deuda
El saldo y estado de pago de una compra SHALL considerar los pagos vigentes más las retenciones vigentes imputadas. MUST reflejar esa cancelación en consultas de compra y cuenta corriente del proveedor. La retención MUST NOT generar otra salida de caja/banco, otra deuda o cambios de stock ni disminuir el total fiscal de la factura.

#### Scenario: Compra saldada con pago y retención
- **GIVEN** una compra y factura por 121000 con un pago efectivo de 115000
- **WHEN** se registra e imputa una retención de 6000
- **THEN** la compra queda saldada, con saldo pendiente 0
- **AND** la cancelación se compone de pago 115000 y retención 6000
- **AND** la cuenta corriente refleja el saldo 0, la factura conserva total 121000 y las cuentas solo reflejan el pago efectivo

#### Scenario: Pago posterior considera retenciones vigentes
- **GIVEN** una compra por 121000 con pago de 100000 y retención imputada de 6000
- **WHEN** se consulta lo pendiente para registrar otro pago
- **THEN** el saldo pendiente utilizado por el circuito de pagos es 15000
- **AND** la retención no vuelve a contarse como un pago adicional

### Requirement: Corrección y eliminación de retenciones coherentes
Editar o eliminar un documento de retención SHALL ajustar su cancelación asociada y recalcular saldo y estado de la compra de manera atómica. MUST conservar los pagos efectivos y los saldos de cuentas que no fueron modificados. Un fallo MUST NOT dejar un documento con una imputación que corresponda a otra versión.

#### Scenario: Reducir una retención
- **GIVEN** una compra por 121000 saldada con pago 115000 y retención 6000
- **WHEN** se corrige la retención a 5000
- **THEN** el saldo pendiente de la compra es 1000
- **AND** el pago de 115000 y el saldo de su cuenta no cambian

#### Scenario: Eliminar una retención
- **GIVEN** una compra por 121000 saldada con pago 115000 y retención 6000
- **WHEN** se elimina el documento de retención
- **THEN** la cancelación por retención deja de estar vigente y el saldo pendiente es 6000
- **AND** no se revierte el pago ni se registra otro movimiento de caja

### Requirement: Reintentos sin duplicar documentos ni cancelaciones
El guardado y la imputación de retenciones SHALL ser consistentes ante reintentos y cambios concurrentes. Una misma retención MUST NOT cancelar dos veces el mismo importe por repetición de solicitud o multiplicación de relaciones. Reintentar una asociación posterior MUST NOT recrear la compra, sus pagos o su stock.

#### Scenario: Reintento de la misma retención
- **GIVEN** una compra por 121000 con pago de 115000
- **WHEN** se repite la misma solicitud de registro e imputación de retención por 6000
- **THEN** hay un único documento e imputación efectiva por 6000 para esa solicitud
- **AND** la compra queda con saldo 0, sin doble cancelación

### Requirement: Permisos y pertenencia al tenant
El circuito SHALL tener permisos asociados de consulta y gestión, con acceso inicial equivalente a facturación de ventas. MUST exigir sesión, derivar tenant de ella y validar la pertenencia de documentos, proveedores, operaciones e imputaciones. MUST impedir acciones sin permiso y vínculos entre tenants.

#### Scenario: Acceso de solo consulta
- **GIVEN** un usuario con permiso de consulta y sin permiso de gestión
- **WHEN** consulta un documento e intenta modificarlo o eliminarlo
- **THEN** puede consultarlo y las acciones de gestión se rechazan

#### Scenario: Asociación entre tenants
- **WHEN** un usuario del tenant A intenta vincular o imputar un documento a una compra del tenant B
- **THEN** se rechaza la solicitud sin alterar documentos ni saldos
- **AND** no se divulgan datos del tenant B

### Requirement: Sin adjuntos en el circuito inicial
El circuito inicial de documentos de compra MUST NOT ofrecer carga de archivos, fotografías o adjuntos ni exigirlos para guardar documentos. SHALL utilizar los datos estructurados cargados manualmente como fuente de consulta y reporte.

#### Scenario: Guardar sin archivo
- **WHEN** el usuario completa los datos requeridos de una factura o retención
- **THEN** puede guardar el documento sin adjuntar un archivo
- **AND** el formulario no ofrece subir fotos o respaldos
