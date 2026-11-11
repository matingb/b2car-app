# Proposal

## Why

Los clientes necesitan cargar comprobantes de sus proveedores vinculados a compras o gastos y obtener un reporte fiscal de compras comparable en utilidad al de ventas. Hoy B2Car registra esas operaciones, pero su facturación electrónica y su reporte fiscal están orientados a comprobantes emitidos desde arreglos y ventas.

Esta es una **primera versión para revisión**, basada en la exploración con el usuario. Distingue el objetivo acordado de las decisiones técnicas propuestas y de los pendientes que deben resolverse antes de implementar cada bloque.

## What Changes

- Permitir registrar manualmente los datos de una factura de compra y vincularla a una operación `COMPRA` o `GASTO`, contemplando su respaldo documental. La cardinalidad, obligatoriedad del archivo y ubicación definitiva de la carga siguen pendientes.
- Conservar la identificación fiscal del comprobante, las partes y los importes informados: netos, IVA, otros conceptos efectivamente cargados y total. El alcance no incluye determinar crédito fiscal computable, deducibilidad ni calcular qué impuestos corresponde aplicar.
- Incorporar un reporte fiscal de compras por período, con detalle y sumas reproducibles de los importes registrados. Se propone CSV/XLSX para control del contador; columnas, criterio temporal y tipos adicionales de comprobante requieren revisión.
- Proponer una entidad de comprobantes recibidos separada de `facturas_electronicas`, compartiendo utilidades compatibles de exportación y representación monetaria. Es una recomendación técnica de esta versión, no una decisión de negocio confirmada.
- Conservar independientes el comprobante, la operación, sus pagos y su stock: asociar una factura a una operación existente no vuelve a registrar la compra ni genera impactos financieros o de inventario.
- **Retenciones: pendiente de definición.** La primera idea del usuario es permitir registrar retenciones al pagar una operación que tenga una factura asociada. Es una hipótesis; este borrador no define ni habilita su persistencia, imputación, efecto en saldos o incorporación efectiva al reporte. El objetivo de totalizar retenciones cargadas queda sujeto a esa definición.
- Mantener como candidatos por validar las retenciones de Ganancias, IVA e IIBB y las percepciones de IVA e IIBB. El IVA facturado y una retención de IVA son conceptos distintos; la mención del cliente a Ganancias no confirma un catálogo completo ni un régimen aplicable.

## Capabilities

### New Capabilities

- `comprobantes-recibidos`: registro de comprobantes de proveedores, identificación histórica, importes, vinculación con compras/gastos y respaldo documental, con independencia de sus impactos operativos.
- `reportes-fiscales-compras`: selección, detalle y totalización de comprobantes recibidos para control fiscal, preservando procedencia, integridad y separación por concepto.

### Modified Capabilities

Ninguna. No hay capacidades publicadas en `openspec/specs/`. Se toma como contexto el contrato de `b2c-224-reportes-fiscales-ventas` y `rediseno-operaciones-ledgers`, sin modificar sus artefactos ni ampliar silenciosamente sus universos.

## Impact

- **DB:** futuras migraciones para comprobantes recibidos, relaciones, detalle fiscal y adjuntos según las decisiones de `design.md`; RLS, grants y restricciones de pertenencia al tenant. El esquema declarativo observado está en `supabase/database/schemas/` y no se editará manualmente.
- **API:** nuevo módulo por capas; integración de lectura/carga con operaciones y gastos. El gasto actual carece de proveedor en su tabla específica y el servicio lo descarta al crearlo: hay que acordar cómo identificar al emisor sin asumir que esa relación ya existe.
- **UI y clientes:** entrada de carga desde compras y gastos, consulta del comprobante y acceso al reporte; revisar ambos flujos de gasto y las compras automáticas desde arreglos.
- **Exportación:** aprovechar constructores y utilidades de CSV/XLSX, conservando el contrato del reporte de ventas. Sus columnas de receptor, alcance al 21% y filtro por ambiente de emisión no se trasladan automáticamente a compras.
- **Pendientes:** `design.md` identifica decisiones sobre retenciones, cardinalidad, identidad, catálogo, ciclo de corrección/borrado, adjuntos, reporte y permisos. `tasks.md` comienza por resolver las que afectan al bloque que se vaya a implementar.
- **Fuera del núcleo propuesto:** emisión o autorización ante ARCA, OCR/importaciones automáticas, archivos de presentación ante ARCA y cálculo tributario. La gestión de retenciones permanece diferida y requiere revisar los artefactos antes de incorporarse.
