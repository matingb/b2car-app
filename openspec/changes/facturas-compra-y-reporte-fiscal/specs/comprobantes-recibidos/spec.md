# Spec Delta

## Purpose

Permitir gestionar facturas y retenciones documentales de compras y gastos, con identidad fiscal histórica editable, líneas manuales de conceptos/percepciones y asociaciones íntegras, sin modificar pagos, saldos o inventario.

## ADDED Requirements

### Requirement: Varios documentos y una sola operación por documento
El sistema SHALL admitir cero o más documentos por operación COMPRA/GASTO del tenant. Cada documento MUST pertenecer a exactamente una operación existente del mismo tenant. MUST permitir factura opcional durante la creación de la operación y carga posterior, y MUST rechazar documentos sin operación o asociados a varias.

#### Scenario: Compra sin documentos
- **WHEN** un usuario registra una compra sin cargar documentos
- **THEN** la operación queda válida y puede recibir documentos posteriormente
- **AND** no se crea una factura ficticia

#### Scenario: Varias facturas de una compra
- **GIVEN** una compra de 121000 con una factura por 60500
- **WHEN** se agrega una segunda factura por 60500
- **THEN** ambas quedan relacionadas con la misma compra y se consultan por separado
- **AND** no se crea otra operación

#### Scenario: Documento sin operación o con varias
- **WHEN** se intenta guardar un documento sin operación o relacionarlo con más de una
- **THEN** se rechaza la solicitud sin guardar una asociación inválida

### Requirement: Compras y gastos comparten el circuito documental
El sistema SHALL permitir facturas y documentos de retención en compras y gastos, con las mismas reglas de gestión e independencia financiera. MUST permitir identificar al emisor en el documento aunque la operación no tenga un proveedor comercial asociado.

#### Scenario: Retención de gasto sin proveedor comercial
- **GIVEN** un gasto sin proveedor comercial asociado
- **WHEN** un usuario autorizado registra un documento de retención con los datos requeridos
- **THEN** puede consultarlo desde el gasto
- **AND** el gasto conserva sus pagos y saldo previos

### Requirement: Gestión integrada en Documentos
El sistema SHALL presentar facturas de compra/gasto y retenciones en Documentos y desde la operación asociada, distinguiendo tipo y procedencia. MUST NOT exigir emisión, certificados o autorización ante ARCA ni presentar la carga manual como autorización fiscal.

#### Scenario: Consultar factura y retención
- **GIVEN** una operación con factura y documento de retención
- **WHEN** el usuario consulta sus documentos
- **THEN** identifica y abre cada uno por su tipo y procedencia
- **AND** no necesita configurar certificados de emisión

### Requirement: Datos fiscales configurables y precarga editable
El sistema SHALL permitir configurar datos fiscales del proveedor, incluida su posición de IVA, y precargarlos cuando la operación tenga proveedor. MUST permitir modificarlos en el formulario y al editar el documento. Guardar cambios locales MUST NOT actualizar automáticamente la ficha del proveedor.

#### Scenario: Corregir la precarga
- **GIVEN** un proveedor con datos fiscales configurados y asociado a la operación
- **WHEN** el usuario corrige los datos precargados al guardar una factura
- **THEN** la factura conserva la corrección
- **AND** la ficha del proveedor mantiene sus datos anteriores

### Requirement: Identidad histórica y campos obligatorios de factura
La factura SHALL conservar número, clase A/B/C, fecha e identidad fiscal de emisor y receptor, con CUIT emisor y posición de IVA del proveedor registrados. Número de factura y posición de IVA del proveedor MUST ser obligatorios. MUST distinguir la posición de IVA del emisor de la del receptor y conservar la copia histórica ante cambios de ficha.

#### Scenario: Número o posición de IVA faltante
- **WHEN** se intenta guardar una factura sin número o sin posición de IVA del proveedor
- **THEN** se informa el campo faltante y no se guarda la factura

#### Scenario: Cambio de ficha y corrección explícita
- **GIVEN** una factura registrada con los datos fiscales del proveedor
- **WHEN** se modifica la ficha del proveedor
- **THEN** la factura mantiene su copia histórica
- **WHEN** se edita explícitamente la factura
- **THEN** sus consultas y reportes posteriores reflejan los nuevos datos guardados

### Requirement: Facturas normales A B y C
El registro inicial de facturas SHALL admitir las clases normales A, B y C. MUST NOT ofrecer NC/ND de compra ni comprobantes especiales en esta versión. Los datos de autorización informados SHALL conservarse como carga manual sin afirmar verificación ante ARCA.

#### Scenario: Guardar una factura admitida
- **WHEN** se registra una factura A, B o C con los datos requeridos
- **THEN** conserva su clase e identificación sin exigir autorización de B2Car ante ARCA

### Requirement: Dos tipos de líneas libres y manuales
El sistema SHALL permitir líneas de tipo CONCEPTO o PERCEPCION con descripción/etiqueta e importe manuales. MUST permitir agregar y editar varias líneas de cada tipo. MUST NOT calcular sus montos desde porcentajes, determinar impuestos aplicables ni inferir clasificación fiscal a partir del texto o posición de IVA del proveedor.

#### Scenario: Dos conceptos y una percepción
- **WHEN** el usuario carga dos conceptos de descripción propia y una percepción con importes manuales
- **THEN** el documento conserva las tres líneas con sus tipos, textos y montos
- **AND** no se reemplaza un monto por el resultado de aplicar un porcentaje

### Requirement: Selector abierto de percepciones
El ingreso de PERCEPCION SHALL ofrecer selección rápida de Ganancias, IVA, IIBB Buenos Aires e IIBB CABA y permitir escribir otras percepciones. MUST conservar el importe manual y la identidad seleccionada o ingresada sin imponer un catálogo cerrado.

#### Scenario: Percepción sugerida
- **WHEN** el usuario elige IIBB Buenos Aires y carga un monto
- **THEN** se conserva esa percepción con el importe informado

#### Scenario: Percepción personalizada
- **WHEN** el usuario ingresa una percepción fuera de las sugerencias con descripción e importe
- **THEN** puede guardar la línea sin crear previamente una opción del catálogo
- **AND** su identificación queda disponible para el reporte

### Requirement: Diferencias de importes permitidas e informadas
El sistema SHALL permitir guardar documentos aunque sus importes difieran del monto operativo y mostrar un label informativo de la diferencia. MUST NOT bloquear por esa diferencia ni ajustar automáticamente documentos u operación. SHALL distinguir importes de una factura y suma de facturas asociadas, sin sumar retenciones a ese total facturado.

#### Scenario: Diferencia al guardar
- **GIVEN** una operación por 120000
- **WHEN** se guarda su única factura por 121000
- **THEN** se guarda la factura y aparece información de la diferencia de 1000
- **AND** la operación conserva 120000 y la factura 121000

### Requirement: Facturas sin duplicados por emisor y número
El sistema MUST rechazar una factura cuyo CUIT emisor y número de factura ya estén registrados en otra factura vigente del mismo tenant, incluso en otra operación. SHALL mostrar error de duplicado y aplicar la misma validación en edición, con garantía frente a altas concurrentes.

#### Scenario: Duplicado en otra compra
- **GIVEN** una factura vigente con un CUIT emisor y número determinados
- **WHEN** se intenta crear otra con el mismo CUIT y número para otra operación del tenant
- **THEN** se rechaza la creación y se muestra un error de factura duplicada

#### Scenario: Duplicado por edición
- **WHEN** se edita una factura para repetir CUIT emisor y número de otra factura vigente del tenant
- **THEN** se rechaza la modificación sin sobrescribir ninguna de las dos

### Requirement: Operaciones documentadas protegidas contra eliminación
El sistema MUST impedir eliminar una operación mientras tenga cualquier documento asociado y explicar que primero deben eliminarse sus documentos. La restricción SHALL aplicarse en todos los puntos de borrado y ante concurrencia, sin producir borrados parciales ni revertir pagos o stock en la solicitud rechazada.

#### Scenario: Borrar compra con retención
- **GIVEN** una compra con un documento de retención asociado
- **WHEN** se intenta eliminar la compra
- **THEN** se rechaza el borrado por documentos asociados
- **AND** la operación, documento, pagos y stock permanecen intactos

#### Scenario: Borrar operación después de eliminar documentos
- **GIVEN** una operación con documentos y sin otras restricciones que impidan su borrado
- **WHEN** se eliminan sus documentos y se solicita borrar la operación
- **THEN** la solicitud puede continuar por el circuito de borrado operativo vigente

### Requirement: Guardado directo y documentos editables y eliminables
El sistema SHALL guardar el formulario validado sin borradores y permitir a usuarios autorizados editar y eliminar documentos. Eliminar un documento MUST NOT eliminar su operación ni modificar sus efectos financieros o de inventario. MUST mantener las validaciones de identidad, pertenencia y duplicados al editar.

#### Scenario: Guardar corregir y eliminar
- **WHEN** el usuario guarda un documento, corrige un importe y después lo elimina
- **THEN** cada acción se refleja en la consulta y el reporte vigentes
- **AND** no requiere emisión ni transición desde un borrador

### Requirement: Retenciones como documentos informativos
El sistema SHALL permitir registrar RETENCION como documento separado, relacionado con su operación y con líneas, descripciones e importes manuales para consulta y reporte. MUST NOT exigir registrar un pago ni generar retenciones desde IVA, otros conceptos o movimientos financieros.

#### Scenario: Carga documental independiente del pago
- **GIVEN** una operación existente
- **WHEN** el usuario agrega un documento de retención con líneas e importes
- **THEN** queda asociado a esa única operación y disponible para el reporte
- **AND** no se crea ni se requiere un pago como parte de la carga

### Requirement: Invariancia financiera y de inventario de todos los documentos
Crear, asociar, editar o eliminar facturas o retenciones SHALL conservar pagos, saldos pendientes, estados de pago, cuenta corriente, saldos de cuentas y stock de la operación. MUST NOT crear imputaciones a deuda ni nuevos movimientos financieros o de inventario. Esta regla SHALL aplicarse igual a compras y gastos.

#### Scenario: Retención no cancela saldo en B2Car
- **GIVEN** una compra por 121000 con pago efectivo de 115000 y saldo pendiente de 6000
- **WHEN** se carga una retención documental de 6000
- **THEN** el saldo sigue siendo 6000 y el estado de pago no cambia
- **AND** la retención queda registrada para el reporte sin modificar el pago ni las cuentas

#### Scenario: Editar o eliminar retención
- **GIVEN** la compra anterior con saldo de 6000 y retención documental de 6000
- **WHEN** se corrige la retención a 5000 o se la elimina
- **THEN** el saldo permanece en 6000 y no cambian pagos, estado de pago o stock
- **AND** solo cambian los datos documentales consultados y exportados

### Requirement: Reintentos sin duplicación operativa o documental
El sistema SHALL permitir reintentar cargas/asociaciones sin duplicar el documento de la misma solicitud, recrear la operación ni repetir pagos o stock. Un fallo MUST NOT presentarse como guardado exitoso ni dejar una asociación inválida.

#### Scenario: Fallo posterior a crear la compra
- **GIVEN** una compra creada cuyo documento falló al guardarse
- **WHEN** se reintenta la misma carga del documento
- **THEN** la compra no se crea de nuevo y el documento se registra una sola vez
- **AND** los pagos e inventario no se repiten

### Requirement: Permisos y pertenencia al tenant
El circuito SHALL tener permisos de consulta/gestión con acceso inicial equivalente a facturación de ventas. MUST exigir sesión, derivar tenant de ella y validar pertenencia de operación, proveedor y documento. MUST impedir acciones sin permiso y asociaciones entre tenants.

#### Scenario: Consulta sin gestión
- **GIVEN** un usuario con consulta y sin permiso de gestión
- **WHEN** consulta un documento e intenta editarlo o eliminarlo
- **THEN** la consulta está permitida y las acciones de gestión se rechazan

#### Scenario: Operación de otro tenant
- **WHEN** un usuario intenta asociar un documento a una operación de otro tenant
- **THEN** se rechaza la solicitud sin crear el documento ni divulgar información ajena

### Requirement: Sin subida de archivos
El circuito inicial MUST NOT ofrecer subida de archivos, fotos o adjuntos ni exigirlos para guardar documentos. SHALL usar los registros y líneas estructurados cargados manualmente como fuente de consulta y reporte.

#### Scenario: Asociar retención sin archivo
- **WHEN** el usuario registra un documento de retención con los datos requeridos
- **THEN** lo vincula a la operación sin adjuntar PDF o fotografía
- **AND** el formulario no ofrece carga de archivos
