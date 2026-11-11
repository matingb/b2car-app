# Spec Delta

## Purpose

Permitir registrar comprobantes de proveedores vinculados a compras o gastos, conservar sus datos fiscales y respaldos, y consultarlos sin duplicar los efectos de la operación.

## ADDED Requirements

### Requirement: Registro manual vinculado a compras y gastos
El sistema SHALL permitir cargar manualmente una factura recibida y asociarla a una compra o gasto del tenant. MUST permitir conservar operaciones sin comprobante asociado. Registrar un comprobante recibido MUST NOT exigir emitirlo ni autorizarlo mediante la integración de facturación de B2Car.

#### Scenario: Asociar una factura a una compra existente
- **GIVEN** una compra del tenant sin factura asociada
- **WHEN** un usuario autorizado registra los datos de la factura del proveedor y la vincula a esa compra
- **THEN** puede consultar el comprobante recibido desde la compra
- **AND** el registro queda identificado como documento del proveedor

#### Scenario: Asociar una factura a un gasto
- **GIVEN** un gasto del tenant
- **WHEN** un usuario autorizado carga su factura con la identificación fiscal del emisor
- **THEN** el comprobante queda vinculado al gasto
- **AND** la falta de proveedor previamente asociado al gasto no se interpreta como ausencia de emisor en la factura

#### Scenario: Operación sin factura
- **WHEN** se registra o consulta una compra o gasto sin comprobante asociado
- **THEN** la operación continúa siendo válida y no se genera una factura ficticia

### Requirement: Identificación histórica del comprobante
El sistema SHALL conservar fecha de emisión, tipo y clase, punto de venta, número e identidad fiscal del emisor y receptor registrados para el comprobante. Los cambios posteriores en fichas comerciales MUST NOT sustituir esos datos históricos. Los datos de autorización informados MUST conservarse sin presentar la carga manual como una verificación ante ARCA.

#### Scenario: Cambio posterior de razón social
- **GIVEN** una factura cargada con la razón social y CUIT de su emisor
- **WHEN** se modifica la ficha del proveedor
- **THEN** la consulta del comprobante conserva la identidad registrada al cargarlo

#### Scenario: Autorización informada por el usuario
- **WHEN** se guarda un código de autorización copiado del comprobante
- **THEN** se conserva como dato informado
- **AND** el sistema no afirma haber verificado su validez fiscal por haberlo guardado

### Requirement: Importes informados sin determinación tributaria
El sistema SHALL conservar los importes cargados de netos, exentos, no gravados, IVA, otros conceptos admitidos y total. MUST distinguir un importe no informado de cero. MUST NOT determinar crédito fiscal computable, deducibilidad ni impuestos o retenciones a aplicar.

#### Scenario: Factura con IVA informado
- **WHEN** se carga una factura con neto 100000, IVA 21000 y total 121000
- **THEN** se conservan esos importes
- **AND** no se determina cuánto IVA puede computar el contribuyente

#### Scenario: IVA sin desglose por alícuota
- **GIVEN** un importe total de IVA informado sin detalle por alícuota
- **WHEN** se consulta el comprobante
- **THEN** se conserva el IVA total y el desglose faltante continúa sin informar
- **AND** no se atribuye el importe al 21% por defecto

#### Scenario: Otros conceptos sin identificación verificable
- **WHEN** se registra un importe agregado de otros tributos sin su categoría detallada
- **THEN** el sistema conserva el agregado como tal
- **AND** no lo convierte en percepción o retención de un impuesto supuesto

### Requirement: Independencia de pagos e inventario
Asociar un comprobante a una operación existente MUST NOT crear otra operación, registrar pagos, alterar su monto pactado ni producir movimientos de stock. Los importes de factura y operación SHALL conservar su procedencia; una diferencia MUST NOT corregirse automáticamente cambiando uno para igualar al otro.

#### Scenario: Compra pagada parcialmente y recibida
- **GIVEN** una compra por 121000, un pago de 60000 y stock ya recibido
- **WHEN** se asocia una factura por 121000
- **THEN** la compra conserva el pago de 60000 y su stock
- **AND** la asociación no genera otra deuda ni otro pago

#### Scenario: Diferencia con el monto de la operación
- **GIVEN** una operación por 120000 y una factura informada por 121000
- **WHEN** se intenta asociar el comprobante
- **THEN** la diferencia se comunica para su tratamiento conforme a la política de conciliación acordada
- **AND** ningún importe se modifica automáticamente

### Requirement: Respaldo documental protegido
El sistema SHALL permitir asociar un respaldo documental al comprobante recibido y consultarlo con autorización. MUST mantener su pertenencia al tenant y su relación con el comprobante. Adjuntar un archivo MUST NOT sustituir la carga de importes por valores inferidos automáticamente.

#### Scenario: Consultar un respaldo asociado
- **GIVEN** un comprobante con un archivo admitido por la política de adjuntos definida
- **WHEN** un usuario con acceso al comprobante abre su respaldo
- **THEN** obtiene el archivo correspondiente al mismo comprobante

#### Scenario: Archivo sin datos estructurados
- **WHEN** se adjunta un respaldo sin cargar todavía sus importes
- **THEN** el sistema no infiere esos importes desde el archivo ni presenta el comprobante como completo solo por tener un adjunto

### Requirement: Acceso y vínculos dentro del tenant
El sistema SHALL exigir sesión y permisos efectivos para cargar o consultar comprobantes y sus archivos. MUST derivar el tenant de la sesión y rechazar vínculos con operaciones, proveedores o comprobantes de otro tenant.

#### Scenario: Vinculación cruzada entre tenants
- **WHEN** un usuario del tenant A intenta asociar una factura a una operación del tenant B
- **THEN** se rechaza la solicitud sin crear el vínculo ni divulgar datos del tenant B

#### Scenario: Acceso directo a un adjunto ajeno
- **WHEN** un usuario intenta obtener el respaldo de un comprobante de otro tenant
- **THEN** se rechaza el acceso aunque conozca su identificador o ubicación

### Requirement: Retenciones fuera del registro inicial de facturas
El núcleo de carga de facturas MUST NOT exigir retenciones para registrar el comprobante ni implementar cambios en pagos o saldos para gestionarlas. La eventual carga de retenciones al pagar SHALL tratarse como una ampliación pendiente de definición.

#### Scenario: Pago de una operación con factura asociada
- **GIVEN** una operación con comprobante recibido vinculado
- **WHEN** se registra un pago con el circuito existente
- **THEN** la presencia de la factura no activa cálculo ni registro automático de retenciones
- **AND** el pago conserva el comportamiento vigente

