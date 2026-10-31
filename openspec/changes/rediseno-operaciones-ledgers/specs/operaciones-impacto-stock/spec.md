# Spec Delta

## Purpose

Define cómo una operación mueve mercadería. Cada recepción, entrega o ajuste físico es un impacto de stock sobre una línea de una operación. Los impactos son la única vía hacia el kardex inmutable, del que se derivan la cantidad de cada stock, las cantidades reservadas y pendientes y el estado de entrega de los documentos.

## ADDED Requirements

### Requirement: Impactos de stock como única vía al kardex
Toda fila del kardex MUST originarse en un impacto de stock sobre una línea de una operación. La única excepción son las filas de conciliación que genera la migración del rediseño. Ningún otro camino, incluido el acceso directo desde la app, SHALL escribir el kardex.

#### Scenario: Recepción de una compra
- **WHEN** se recibe la mercadería de una línea de compra
- **THEN** el kardex tiene una fila nueva que referencia el impacto de stock, la operación y el stock

#### Scenario: Escritura directa del kardex
- **WHEN** un usuario autenticado intenta insertar una fila en el kardex directamente a través de la API de datos
- **THEN** la escritura es rechazada

### Requirement: Cantidad de stock derivada del kardex
La cantidad de cada stock SHALL ser igual al saldo posterior de su última fila en el kardex. El sistema MUST rechazar cualquier intento de fijar a mano la cantidad, la cantidad reservada o la cantidad pendiente de un stock. Los valores mínimo y máximo de un stock SHALL seguir siendo editables.

#### Scenario: Escritura directa de la cantidad
- **WHEN** un usuario autenticado intenta cambiar la cantidad de un stock directamente a través de la API de datos
- **THEN** la escritura es rechazada

#### Scenario: Editar el stock mínimo
- **WHEN** se cambia solo el stock mínimo de un stock
- **THEN** el cambio se guarda y no se genera ningún movimiento en el kardex

### Requirement: Kardex encadenado y sin saldos negativos
Cada fila del kardex SHALL tener como saldo anterior el saldo posterior de la fila previa del mismo stock. Un movimiento que deje el stock en negativo MUST rechazarse con el error `STOCK_INSUFICIENTE` (código `55002`). Si el movimiento es una reversa, se usa el código `55005`.

#### Scenario: Venta sin stock suficiente
- **GIVEN** un stock con cantidad 2
- **WHEN** se intenta entregar 3 unidades
- **THEN** el sistema lo rechaza con el error `STOCK_INSUFICIENTE` y código `55002`

### Requirement: Sentido y cantidad cumplida de cada línea
Cada línea de mercadería SHALL tener un sentido: entra al taller en `COMPRA`, sale en `VENTA` y `ASIGNACION_ARREGLO`, y en `AJUSTE` entra o sale según el ajuste. La cantidad cumplida de una línea SHALL ser la suma de sus impactos de stock en su sentido, MUST estar entre 0 y la cantidad pactada, y no puede fijarse a mano.

#### Scenario: Recibir más de lo comprado
- **GIVEN** una línea de compra de 5 unidades con 3 recibidas
- **WHEN** se intenta registrar una recepción de 3 unidades más
- **THEN** el sistema la rechaza con un error de validación

### Requirement: Entregas y recepciones diferidas
Las compras y las ventas SHALL poder crearse sin mover stock, o moviendo solo una parte, y confirmarse después en una o más entregas o recepciones, cada una con su fecha. El estado de stock del documento SHALL derivarse de sus líneas: `PENDIENTE` sin nada cumplido, `PARCIAL` con una parte cumplida y `ENTREGADO` con todo cumplido.

#### Scenario: Compra recibida en dos partes
- **GIVEN** una compra de 10 unidades creada sin recibir mercadería, en estado `PENDIENTE`
- **WHEN** se reciben 4 unidades
- **THEN** el stock sube 4 y la compra queda `PARCIAL`
- **WHEN** se reciben las 6 restantes
- **THEN** el stock sube 6 más y la compra queda `ENTREGADO`

### Requirement: Cantidades reservada y pendiente derivadas
La cantidad reservada de un stock SHALL ser la suma de lo que falta entregar en las ventas abiertas de ese stock. La cantidad pendiente SHALL ser la suma de lo que falta recibir en sus compras abiertas. Una venta MUST rechazarse con `STOCK_INSUFICIENTE` (código `55002`) si deja la cantidad disponible (cantidad menos reservada) por debajo de cero.

#### Scenario: Venta diferida reserva stock
- **GIVEN** un stock con cantidad 10 y nada reservado
- **WHEN** se crea una venta de 4 unidades sin entregar
- **THEN** la cantidad reservada es 4 y la disponible es 6

#### Scenario: Venta diferida sin disponible
- **GIVEN** un stock con cantidad 10 y 8 reservadas
- **WHEN** se intenta crear una venta de 3 unidades sin entregar
- **THEN** el sistema la rechaza con el error `STOCK_INSUFICIENTE`

### Requirement: Reversión de una entrega o recepción
Revertir una entrega o recepción SHALL eliminar su impacto de stock y registrar en el kardex una fila de reversión que referencia la fila original. La cantidad cumplida, el estado de stock y las cantidades reservada y pendiente se recalculan. El sistema MUST rechazar revertir una reversión, revertir dos veces el mismo movimiento o revertir un movimiento sin impacto de origen (histórico o de conciliación). En este último caso la app no ofrece la acción.

#### Scenario: Revertir una entrega parcial
- **GIVEN** una venta de 5 unidades con 2 entregadas, que reserva 3
- **WHEN** se revierte esa entrega
- **THEN** el stock vuelve a subir 2, la reservada pasa a 5 y la venta queda `PENDIENTE`

#### Scenario: Revertir un movimiento histórico
- **WHEN** se intenta revertir un movimiento del kardex que no tiene impacto de origen
- **THEN** el sistema lo rechaza con un mensaje que explica que el movimiento es previo al rediseño

### Requirement: Impactos de stock no editables
Un impacto de stock MUST NOT modificarse. Para corregir una entrega o recepción se la revierte y se registra otra.

#### Scenario: Intentar editar una entrega
- **WHEN** se intenta modificar la cantidad de una entrega ya registrada
- **THEN** el sistema rechaza la modificación

### Requirement: Kardex inmutable y trazable
Las filas del kardex MUST NOT modificarse ni borrarse. Cada fila SHALL conservar la referencia a la operación y al impacto que la originaron, aun después de que se borren.

#### Scenario: Borrar una compra recibida
- **GIVEN** una compra de 5 unidades recibidas, sin consumir
- **WHEN** se borra la compra
- **THEN** el kardex conserva la fila de recepción y agrega una reversión de -5 que la referencia
- **AND** las dos filas siguen referenciando el id de la compra borrada

#### Scenario: Borrar una compra ya consumida
- **GIVEN** una compra de 5 unidades recibidas, de las que ya se vendieron 4
- **WHEN** se intenta borrar la compra
- **THEN** el sistema lo rechaza con un error de stock insuficiente para revertir (código `55005`)

### Requirement: Repuestos asignados a arreglos
Asignar un repuesto a un arreglo SHALL sacar las unidades del stock en el momento y dejarlas en el kardex. Aumentar la cantidad asignada saca la diferencia. Reducirla devuelve la diferencia al stock. Quitar el repuesto revierte todo lo asignado. Si no hay stock suficiente, la asignación MUST rechazarse con `STOCK_INSUFICIENTE`.

#### Scenario: Asignar y luego reducir
- **GIVEN** un stock con cantidad 10
- **WHEN** se asignan 3 unidades a un arreglo
- **THEN** el stock queda en 7 y el kardex muestra la salida
- **WHEN** se reduce la asignación a 1
- **THEN** el stock queda en 9 y el kardex muestra la devolución de 2

### Requirement: Ajuste manual de stock
Cambiar la cantidad de un stock desde la app SHALL generar una operación `AJUSTE` con una línea y un impacto por la diferencia entre la cantidad nueva y la actual, con un motivo. Si la diferencia es cero, no se registra nada.

#### Scenario: Corregir la cantidad de un stock
- **GIVEN** un stock con cantidad 10
- **WHEN** un usuario cambia su cantidad a 8
- **THEN** se crea una operación `AJUSTE` con una salida de 2 en el kardex y el stock queda en 8

### Requirement: Stock inicial
Crear un stock con cantidad inicial mayor que cero, incluido el alta de un producto desde un arreglo, SHALL generar una operación `AJUSTE` de motivo inicial con la entrada correspondiente en el kardex. Un stock creado con cantidad cero no genera movimientos.

#### Scenario: Alta de stock con cantidad
- **WHEN** se crea un stock con cantidad inicial 5
- **THEN** existe una operación `AJUSTE` de motivo inicial, el kardex muestra una entrada de 5 y el stock queda en 5

### Requirement: Facturación independiente de la entrega
La cantidad facturable de una línea de venta SHALL ser su cantidad pactada, se haya entregado o no.

#### Scenario: Facturar una venta no entregada
- **GIVEN** una venta de 5 unidades sin entregar
- **WHEN** se prepara su factura
- **THEN** la factura incluye las 5 unidades

#### Scenario: Facturar una venta entregada en parte
- **GIVEN** una venta de 5 unidades con 2 entregadas
- **WHEN** se prepara su factura
- **THEN** la factura incluye las 5 unidades sin error de coherencia de stock

### Requirement: Devolución de stock por nota de crédito
Una nota de crédito sobre una venta facturada SHALL tratar primero las unidades acreditadas no entregadas: dejan de estar pendientes y de reservar stock. Solo puede reingresar físicamente unidades entregadas y todavía no devueltas, mediante una operación `AJUSTE` de motivo devolución por NC. Una devolución física por encima de eso MUST rechazarse.

#### Scenario: NC total sobre una venta entregada en parte
- **GIVEN** una venta facturada de 5 unidades con 2 entregadas y 3 reservadas
- **WHEN** se emite una nota de crédito por las 5 unidades con devolución física de 2
- **THEN** la venta deja de tener unidades pendientes de entrega y la reservada baja 3
- **AND** el stock sube 2 mediante un `AJUSTE` de devolución por NC

#### Scenario: Devolver más de lo entregado
- **GIVEN** una venta facturada de 5 unidades con 2 entregadas
- **WHEN** se intenta una devolución física de 3 unidades por nota de crédito
- **THEN** el sistema la rechaza con un error de validación
