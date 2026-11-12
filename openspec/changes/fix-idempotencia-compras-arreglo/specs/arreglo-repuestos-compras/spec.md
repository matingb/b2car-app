# Spec Delta

## Purpose

Permitir crear un arreglo con compras automáticas de los repuestos faltantes, conservando la coherencia del stock, de sus pagos y del eventual cobro inicial.

## ADDED Requirements

### Requirement: Reposición independiente de cada faltante

El sistema SHALL comprar únicamente las unidades faltantes de cada repuesto existente y asignar al arreglo la cantidad solicitada. Una compra previa del mismo alta MUST NOT impedir la reposición de otro repuesto.

#### Scenario: Dos repuestos requieren compra
- **GIVEN** un repuesto A con stock 1 y cantidad solicitada 3, y otro B con stock 0 y cantidad solicitada 2
- **WHEN** se crea un arreglo activo con precios de compra positivos, cuenta válida y clave de idempotencia
- **THEN** se compran 2 unidades de A y 2 de B, con sus respectivos pagos
- **AND** se asignan 3 unidades de A y 2 de B, y ambos stocks terminan en cero
- **AND** el saldo de la cuenta disminuye por la suma de las dos compras

#### Scenario: Una compra pagada precede a una compra sin costo
- **GIVEN** dos repuestos sin stock y un costo positivo para el primero y cero para el segundo
- **WHEN** se crea el arreglo con cuenta y clave de idempotencia
- **THEN** ambas compras reponen sus faltantes y ambas asignaciones se concretan
- **AND** solo la compra con costo genera un débito financiero

#### Scenario: Solo un repuesto requiere compra
- **WHEN** se crea un arreglo combinando un repuesto con stock suficiente y otro con faltante
- **THEN** únicamente el faltante genera una compra y todos los repuestos se asignan correctamente

### Requirement: Claves independientes y reproducibles por compra

Cuando se recibe una clave de idempotencia, el sistema SHALL usar una clave derivada propia para cada compra automática, distinta de la clave del cobro y de las otras compras. Para la misma clave de entrada y la misma línea en la misma posición, la clave derivada MUST ser estable.

#### Scenario: Separación de compras y cobro
- **WHEN** se crea un arreglo con dos compras pagadas y clave de entrada K
- **THEN** los dos pagos tienen claves derivadas diferentes entre sí y diferentes de K

#### Scenario: Derivación estable
- **WHEN** se deriva nuevamente la clave de la misma línea en la misma posición usando la misma clave de entrada
- **THEN** se obtiene la misma clave derivada
- **AND** cambiar la clave de entrada, el stock o la posición produce una clave distinta en los casos de prueba

### Requirement: Cobro inicial independiente de las compras

Al crear un arreglo como pagado, el sistema SHALL registrar el cobro por el total persistido del arreglo usando la clave original, aunque ya haya registrado pagos de compras automáticas.

#### Scenario: Dos compras y cobro inicial
- **WHEN** se crea un arreglo como pagado con dos compras automáticas con costo
- **THEN** existen dos pagos de compra y un cobro del arreglo
- **AND** el cobro conserva la clave original y los pagos usan sus claves derivadas
- **AND** total_cobrado coincide con precio_final, esta_pago es verdadero y el saldo refleja el cobro menos las compras

### Requirement: Compatibilidad de llamadas sin clave

Las llamadas directas que actualmente admiten no enviar clave SHALL conservar ese comportamiento. Las compras a costo cero MUST NOT generar movimientos de cuenta.

#### Scenario: Compra sin clave por llamada directa
- **WHEN** se crea mediante RPC un arreglo con dos faltantes y cuenta válida, omitiendo la clave y sin solicitar cobro inicial
- **THEN** ambas compras y asignaciones se concretan y sus pagos conservan clave nula

### Requirement: Creación atómica con múltiples repuestos

Si falla una compra o asignación posterior, el sistema MUST revertir el arreglo y todos los documentos, pagos, movimientos de stock y asientos generados por ese alta.

#### Scenario: Error después de la primera compra
- **GIVEN** un primer repuesto con compra válida y un segundo con faltante pero sin precio de compra
- **WHEN** se intenta crear el arreglo
- **THEN** la creación falla y no persiste el arreglo ni ninguna de las operaciones o movimientos del intento
- **AND** los stocks y el saldo financiero mantienen sus valores previos
