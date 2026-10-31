# Spec Delta

## Purpose

Define cómo una operación mueve plata. Cada pago, cobro o movimiento de cuenta es un impacto financiero de una operación. Los impactos son la única vía hacia el ledger financiero inmutable, del que se derivan los saldos de las cuentas y el estado de pago de los documentos.

## ADDED Requirements

### Requirement: Impactos financieros como única vía al ledger
Todo asiento del ledger financiero MUST originarse en un impacto financiero de una operación. Un impacto tiene una cuenta, un importe con signo distinto de cero y una fecha propia, y genera exactamente un asiento con esos mismos datos. El asiento referencia al impacto y a la operación. Ningún otro camino, incluido el acceso directo desde la app, SHALL escribir el ledger.

#### Scenario: Registrar un pago genera un asiento
- **WHEN** se registra un pago de 300 desde la cuenta A con fecha 10/11 sobre una compra
- **THEN** el ledger tiene un asiento nuevo de -300 en la cuenta A con fecha 10/11
- **AND** ese asiento referencia el pago y la compra

#### Scenario: Escritura directa del ledger
- **WHEN** un usuario autenticado intenta insertar un asiento directamente a través de la API de datos
- **THEN** la escritura es rechazada

### Requirement: Saldo de cuenta derivado del ledger
El saldo de cada cuenta financiera SHALL ser igual a la suma de los importes de sus asientos en el ledger.

#### Scenario: Saldo después de pagos y reversas
- **GIVEN** una cuenta con saldo 1000
- **WHEN** se registra un pago de 300 desde esa cuenta y después se anula
- **THEN** el saldo de la cuenta vuelve a 1000 y coincide con la suma de sus asientos

### Requirement: Pagos y cobros de documentos en una o varias veces
Las compras, ventas y gastos SHALL admitir cero o más pagos o cobros, cada uno con su cuenta y su fecha. Se pueden registrar al crear el documento (en una o varias cuentas) o después. El detalle del documento SHALL listar cada pago con su fecha, cuenta, monto y descripción.

#### Scenario: Compra pagada en cuatro partes
- **GIVEN** una compra de 1000 creada con pagos iniciales de 200 desde la cuenta A y 100 desde la cuenta B
- **WHEN** se registran después dos pagos de 300 y 400
- **THEN** el detalle de la compra lista cuatro pagos, cada uno con su fecha, cuenta y monto
- **AND** el total pagado de la compra es 1000

### Requirement: Signo del impacto según el tipo de operación
El sistema SHALL validar el signo de cada impacto según el tipo de operación y MUST rechazar los impactos que no cumplan la regla.

#### Scenario: Signo permitido por tipo
- **WHEN** se registra un impacto financiero
- **THEN** su importe debe ser:
  - positivo en `VENTA`, `INGRESO` y `COBRO_ARREGLO`;
  - negativo en `COMPRA` y `GASTO`;
  - distinto de cero, de cualquier signo, en `APERTURA_CUENTA`.

#### Scenario: Cobro de venta con importe negativo
- **WHEN** se intenta registrar sobre una venta un impacto con importe negativo
- **THEN** el sistema lo rechaza con un error de validación

#### Scenario: Asignación a arreglo con impacto financiero
- **WHEN** se intenta registrar un impacto financiero sobre una operación `ASIGNACION_ARREGLO` o `AJUSTE`
- **THEN** el sistema lo rechaza con un error de validación

### Requirement: Estado de pago derivado
En compras, ventas y gastos, el total pagado SHALL ser el valor absoluto de la suma de los importes de sus impactos. El estado de pago SHALL derivarse del total pagado frente al monto total: `PENDIENTE` sin pagos, `PARCIAL` con pagos por debajo del total y `PAGADO` cuando cubren el total. Ninguno de los dos valores MUST poder fijarse a mano.

#### Scenario: Del pago parcial al pago total
- **GIVEN** una venta de 500 sin cobros, en estado `PENDIENTE`
- **WHEN** se registra un cobro de 200
- **THEN** el total pagado es 200 y el estado es `PARCIAL`
- **WHEN** se registra otro cobro de 300
- **THEN** el total pagado es 500 y el estado es `PAGADO`

### Requirement: Pago posterior que supera lo pendiente
Al registrar un pago o cobro sobre un documento ya creado, el sistema MUST rechazarlo si el monto supera lo que falta pagar. Los pagos iniciales informados al crear el documento SHALL aceptarse aunque superen el total, y en ese caso el documento queda `PAGADO`.

#### Scenario: Pago mayor al saldo
- **GIVEN** una compra de 1000 con 800 pagados
- **WHEN** se intenta registrar un pago de 300
- **THEN** el sistema lo rechaza con un error de validación

### Requirement: Idempotencia de pagos
Un pago o cobro registrado con una clave de idempotencia MUST registrarse una sola vez, aunque la solicitud se repita.

#### Scenario: Reintento de un pago
- **WHEN** se envía dos veces el mismo pago con la misma clave de idempotencia
- **THEN** existe un solo pago y un solo asiento

### Requirement: Anulación de un pago
Anular un pago SHALL eliminarlo del documento y registrar en el ledger un contraasiento con el importe opuesto. El contraasiento lleva la fecha de la anulación y referencia al asiento original, al pago anulado y al documento. El total pagado y el estado de pago se recalculan.

#### Scenario: Anular un pago de compra
- **GIVEN** una compra de 1000 con dos pagos de 500, en estado `PAGADO`
- **WHEN** se anula uno de los pagos
- **THEN** el ledger tiene un contraasiento de +500 que referencia el asiento original y la compra
- **AND** el total pagado es 500 y el estado es `PARCIAL`

#### Scenario: Anular el cobro de una venta facturada
- **GIVEN** una venta con comprobante fiscal autorizado y un cobro registrado
- **WHEN** se anula el cobro
- **THEN** la anulación se registra sin modificar los datos fiscales de la venta

### Requirement: Corrección de un impacto financiero
Un impacto financiero SHALL poder corregirse en su importe, su cuenta o su fecha. El ledger MUST registrar la corrección como un contraasiento del asiento vigente más un asiento nuevo con los valores corregidos. Los asientos existentes nunca se modifican.

#### Scenario: Cambiar la fecha de una transferencia
- **GIVEN** una transferencia registrada el 05/11
- **WHEN** se cambia su fecha al 04/11
- **THEN** el ledger conserva los asientos originales, agrega sus contraasientos y agrega asientos nuevos con fecha 04/11

### Requirement: Ledger financiero inmutable y trazable
Los asientos del ledger MUST NOT modificarse ni borrarse. Cada asiento SHALL conservar la referencia a la operación y al impacto que lo originaron, aun después de que se borren. Cada contraasiento SHALL referenciar el asiento que revierte.

#### Scenario: Borrar una operación con pagos
- **GIVEN** una venta con dos cobros
- **WHEN** se borra la venta
- **THEN** el ledger conserva los dos asientos originales y agrega dos contraasientos
- **AND** los cuatro asientos siguen referenciando el id de la venta borrada

### Requirement: Coherencia de las operaciones instantáneas
`INGRESO`, `APERTURA_CUENTA` y `COBRO_ARREGLO` MUST tener exactamente un impacto, en la cuenta de la operación y por su monto total con el signo de su tipo. `TRANSFERENCIA` MUST tener exactamente dos impactos: uno negativo en la cuenta de origen y uno positivo en la de destino, ambos por el monto total. El sistema MUST rechazar cualquier operación que no cumpla esto al confirmarse.

#### Scenario: Transferencia entre cuentas
- **WHEN** se transfieren 100 de la cuenta A a la cuenta B
- **THEN** el saldo de A baja 100, el de B sube 100 y la suma de los dos impactos es cero

#### Scenario: Transferencia incoherente
- **WHEN** se intenta confirmar una transferencia cuyos impactos no suman cero o no coinciden con sus cuentas de origen y destino
- **THEN** el sistema rechaza la operación completa

### Requirement: Transferencias y aperturas neutras en los totales
Las transferencias y las aperturas de cuenta MUST NOT contarse como ingresos ni como egresos en las estadísticas de operaciones, los dashboards ni las cuentas corrientes.

#### Scenario: Transferencia en las estadísticas
- **GIVEN** un período con ventas por 1000 y una transferencia de 500
- **WHEN** se consultan las estadísticas de operaciones del período
- **THEN** los ingresos son 1000 y los egresos no incluyen la transferencia

### Requirement: Gastos eventuales en el dashboard
El dashboard de gastos SHALL contar como gastos eventuales los pagos de operaciones `GASTO`, por la fecha de cada pago y una sola vez. Los pagos de compras MUST NOT contarse como gasto eventual.

#### Scenario: Gasto pagado al crearlo
- **WHEN** se crea un gasto de 200 pagado en el momento
- **THEN** el dashboard de gastos suma 200 una sola vez en la fecha del pago

#### Scenario: Pago de una compra
- **WHEN** se registra un pago de una compra
- **THEN** ese pago no aparece entre los gastos eventuales

### Requirement: Cobro y pago de documentos facturados
El sistema SHALL permitir registrar y anular pagos o cobros de una venta con comprobante fiscal autorizado. Los datos fiscales de la venta MUST seguir protegidos: tipo, fecha, taller, monto total, observaciones y líneas.

#### Scenario: Cobrar una venta facturada
- **GIVEN** una venta con comprobante fiscal autorizado y sin cobros
- **WHEN** se registra un cobro
- **THEN** el cobro se registra y el estado de pago de la venta se actualiza

### Requirement: Movimientos de cuenta manuales
Los gastos eventuales, los ingresos y las transferencias SHALL poder crearse, corregirse y eliminarse desde sus endpoints. Al corregirlos se actualizan juntos los datos del documento y su impacto. Un gasto con más de un pago, o con pagos que no cubren el total, MUST NOT cambiar su monto ni su cuenta desde esos endpoints. Los cobros de arreglo MUST NOT editarse ni eliminarse desde ellos.

#### Scenario: Corregir el monto de un ingreso
- **GIVEN** un ingreso de 100 en la cuenta A
- **WHEN** se corrige su monto a 120
- **THEN** el ingreso queda con monto total 120 y un impacto de +120 en la cuenta A
- **AND** el saldo de A refleja la diferencia mediante un contraasiento y un asiento nuevo

#### Scenario: Corregir un gasto con pagos parciales
- **GIVEN** un gasto de 500 con un pago de 200
- **WHEN** se intenta cambiar su monto desde el endpoint de gastos
- **THEN** el sistema rechaza la corrección con un error de validación

#### Scenario: Editar un cobro de arreglo como movimiento manual
- **WHEN** se intenta editar o eliminar un cobro de arreglo desde los endpoints de movimientos manuales
- **THEN** el sistema rechaza la solicitud y el cobro y el total cobrado del arreglo no cambian

### Requirement: Cuenta corriente de clientes y proveedores
La cuenta corriente de un cliente o de un proveedor SHALL listar cada cobro o pago de sus documentos una sola vez, con su fecha, su cuenta y su monto.

#### Scenario: Venta cobrada en dos partes
- **GIVEN** una venta a un cliente cobrada en dos partes, en dos cuentas
- **WHEN** se consulta la cuenta corriente del cliente
- **THEN** aparecen los dos cobros, cada uno una sola vez, con su fecha y su cuenta
