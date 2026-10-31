# Spec Delta

## Purpose

Define la operación como documento del negocio: qué tipos existen, qué datos propios lleva cada tipo, qué pacta (montos y líneas de mercadería) y cómo se lista, edita y borra. Los impactos en plata y en stock se especifican en `operaciones-impacto-financiero` y `operaciones-impacto-stock`.

## ADDED Requirements

### Requirement: Tipos de operación
El sistema SHALL clasificar cada operación en exactamente uno de estos tipos: `COMPRA`, `VENTA`, `GASTO`, `ASIGNACION_ARREGLO`, `AJUSTE`, `INGRESO`, `TRANSFERENCIA`, `APERTURA_CUENTA` o `COBRO_ARREGLO`. El sistema MUST NOT crear operaciones nuevas de tipo `MOVIMIENTO_CUENTA`.

#### Scenario: Una transferencia entre cuentas es una operación TRANSFERENCIA
- **WHEN** un usuario registra una transferencia entre dos cuentas financieras
- **THEN** se crea una operación de tipo `TRANSFERENCIA`

#### Scenario: Un cobro de arreglo es una operación COBRO_ARREGLO
- **WHEN** un usuario registra un cobro de un arreglo
- **THEN** se crea una operación de tipo `COBRO_ARREGLO` vinculada a ese arreglo

#### Scenario: Las operaciones MOVIMIENTO_CUENTA existentes pasan a su tipo real
- **GIVEN** operaciones históricas de tipo `MOVIMIENTO_CUENTA` que representan un gasto manual, un ingreso, una transferencia, una apertura de cuenta o un cobro de arreglo
- **WHEN** se aplica la migración del rediseño
- **THEN** cada una queda con el tipo `GASTO`, `INGRESO`, `TRANSFERENCIA`, `APERTURA_CUENTA` o `COBRO_ARREGLO` que le corresponde
- **AND** no queda ninguna operación de tipo `MOVIMIENTO_CUENTA`

### Requirement: Datos propios por tipo
Toda operación MUST tener exactamente un registro con los datos propios de su tipo. El sistema SHALL rechazar la creación de una operación a la que le falte un dato propio obligatorio.

#### Scenario: Datos propios obligatorios de cada tipo
- **WHEN** se crea una operación
- **THEN** según su tipo lleva:
  - `VENTA`: el cliente;
  - `COMPRA`: el proveedor;
  - `GASTO`: la categoría de gasto y una descripción opcional;
  - `ASIGNACION_ARREGLO` y `COBRO_ARREGLO`: el arreglo;
  - `AJUSTE`: el motivo;
  - `INGRESO`: la cuenta y el concepto;
  - `TRANSFERENCIA`: la cuenta de origen y la de destino;
  - `APERTURA_CUENTA`: la cuenta.

#### Scenario: Venta sin cliente
- **WHEN** se intenta crear una venta sin cliente
- **THEN** el sistema rechaza la creación con un error de validación

#### Scenario: Transferencia a la misma cuenta
- **WHEN** se intenta crear una transferencia cuya cuenta de origen es igual a la de destino
- **THEN** el sistema rechaza la creación con un error de validación

### Requirement: Lo pactado por la operación
Toda operación SHALL registrar su monto total pactado. Las operaciones `COMPRA`, `VENTA`, `ASIGNACION_ARREGLO` y `AJUSTE` SHALL registrar además sus líneas de mercadería (stock, cantidad y precio unitario). Las operaciones `GASTO`, `INGRESO`, `TRANSFERENCIA`, `APERTURA_CUENTA` y `COBRO_ARREGLO` MUST NOT tener líneas de mercadería.

#### Scenario: Transferencia con monto pactado
- **WHEN** se registra una transferencia de 100 de la cuenta A a la cuenta B
- **THEN** la operación queda con monto total 100 y sin líneas de mercadería

#### Scenario: Gasto con líneas de mercadería
- **WHEN** se intenta crear un gasto con líneas de mercadería
- **THEN** el sistema rechaza la creación con un error de validación

### Requirement: Taller de la operación
Las operaciones que mueven mercadería (`COMPRA`, `VENTA`, `ASIGNACION_ARREGLO` y `AJUSTE`) MUST indicar un taller. Para `GASTO`, `INGRESO`, `TRANSFERENCIA`, `APERTURA_CUENTA` y `COBRO_ARREGLO` el taller SHALL ser opcional.

#### Scenario: Gasto eventual sin taller
- **WHEN** un usuario registra un gasto eventual sin indicar taller
- **THEN** el gasto se registra correctamente

#### Scenario: Compra sin taller
- **WHEN** se intenta crear una compra sin taller
- **THEN** el sistema rechaza la creación con un error de validación

### Requirement: Listado de operaciones
El listado de operaciones SHALL incluir operaciones de todos los tipos, cada una con su tipo real, su monto total y sus datos propios. Cada operación MUST aparecer una sola vez, sin importar cuántos pagos, cobros o entregas tenga. El listado SHALL permitir filtrar por cualquiera de los tipos.

#### Scenario: Compra con varios pagos
- **GIVEN** una compra con tres pagos registrados
- **WHEN** se consulta el listado de operaciones
- **THEN** la compra aparece una sola vez

#### Scenario: Filtrar transferencias
- **WHEN** se filtra el listado por el tipo `TRANSFERENCIA`
- **THEN** se muestran solo las transferencias, cada una con su cuenta de origen, su cuenta de destino y su monto

#### Scenario: Ingresos en el listado
- **WHEN** se filtra el listado por el tipo `INGRESO`
- **THEN** se muestran los ingresos de dinero con su cuenta, su concepto y su monto

### Requirement: Edición de una operación
Editar una operación (`PUT /api/operaciones/[id]`) SHALL modificar solo la fecha y las observaciones. Toda la información derivada y vinculada de la operación MUST conservarse: id, datos propios, líneas, pagos, entregas y estados. Si la solicitud intenta cambiar las líneas, el tipo, el taller o la cuenta, el sistema MUST rechazarla con un error de validación.

#### Scenario: Cambiar la fecha de una compra diferida
- **GIVEN** una compra diferida con un pago parcial y una recepción parcial
- **WHEN** se edita su fecha
- **THEN** la compra conserva su id, su proveedor, sus líneas, su pago, su recepción y sus estados de pago y de stock

#### Scenario: Intentar editar las líneas
- **WHEN** se envía una edición que modifica las líneas de una operación
- **THEN** el sistema la rechaza con un error de validación
- **AND** la operación no cambia

#### Scenario: Editar una venta facturada
- **GIVEN** una venta con comprobante fiscal autorizado
- **WHEN** se intenta cambiar su fecha o sus observaciones
- **THEN** el sistema rechaza la edición con el error de operación facturada

### Requirement: Borrado de una operación
Borrar una operación SHALL eliminar el documento junto con sus datos propios, sus líneas y sus impactos en plata y en stock. Los ledgers financiero y de stock MUST registrar las reversas correspondientes, de modo que los saldos de las cuentas y del stock vuelvan a su valor anterior. Para corregir los ítems de una operación, se la borra y se carga de nuevo.

#### Scenario: Borrar una compra pagada y recibida
- **GIVEN** una compra con pagos en dos cuentas y la mercadería recibida
- **WHEN** se borra la compra
- **THEN** la compra deja de existir
- **AND** el saldo de cada cuenta y la cantidad de cada stock vuelven al valor que tenían antes de la compra

#### Scenario: Borrar una venta facturada
- **GIVEN** una venta con comprobante fiscal autorizado
- **WHEN** se intenta borrarla
- **THEN** el sistema rechaza el borrado con el error de operación facturada
