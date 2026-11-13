# Proposal

## Why

Los clientes necesitan registrar documentos de sus proveedores asociados a compras y gastos y obtener un reporte fiscal comparable al de ventas. También necesitan que las retenciones de compras registradas como documentos separados cancelen deuda junto con los pagos.

Revisión del 12/11/2026 con las definiciones confirmadas por el usuario. Los detalles que siguen abiertos se identifican en `design.md`; registrar estos acuerdos no implica haber implementado las tareas.

## What Changes

- Admitir varios documentos por operación de compra. La carga de facturas será opcional al crear la compra y también posterior; los documentos podrán editarse y eliminarse, sin borradores.
- Configurar datos fiscales en proveedores, precargarlos cuando la compra tenga proveedor y permitir modificarlos en cada documento, conservando su identidad histórica.
- Comenzar con facturas normales A, B y C, IVA por alícuota y conceptos adicionales de carga manual abierta. Ofrecer sugerencias de percepciones y tributos comunes, como IIBB Buenos Aires/CABA, Ganancias e impuestos internos, sin cerrar el catálogo ni calcular su aplicabilidad.
- Registrar retenciones que no figuren en la factura como otro tipo de documento del mismo circuito. **Pago y retención cancelan juntos la deuda:** compra 121000, pago 115000 y retención 6000 dejan saldo cero. La retención no representa otra salida de caja.
- Mantener independiente la carga de facturas: no crea otra compra, deuda, pago ni movimiento de stock. El efecto cancelatorio corresponde al documento de retención y debe ajustarse al editarlo o eliminarlo.
- Usar persistencia separada de `facturas_electronicas`, integrada de forma transparente en **Documentos**, con campos comunes y detalle según el tipo. No incluir carga de archivos, fotos ni adjuntos.
- Incorporar un reporte de compras con una primera versión de columnas similares a ventas, adaptadas a proveedor, IVA por alícuota y conceptos registrados. Se mantienen CSV/XLSX como propuesta; el contrato exacto, las fechas y la presentación de retenciones requieren cierre.
- Asociar permisos al circuito, con acceso inicial equivalente al de facturación de ventas. Conservar `GASTO` en el alcance acordado del borrador anterior; sus particularidades de proveedor, puntos de entrada y eventual aplicación de retenciones siguen en P-ALC.

## Capabilities

### New Capabilities

- `comprobantes-recibidos`: gestión de documentos de compras y gastos, datos fiscales de proveedor, facturas A/B/C, IVA por alícuota, conceptos abiertos y retenciones de compras con cancelación de deuda, integrada en Documentos.
- `reportes-fiscales-compras`: selección, detalle y totalización de comprobantes recibidos para control fiscal, preservando procedencia, integridad y separación por concepto.

### Modified Capabilities

Ninguna publicada: el inventario `openspec/specs/` está vacío. Este cambio conserva el contrato de ventas y amplía para compras la cancelación de deuda descrita en `rediseno-operaciones-ledgers`: el saldo y el estado deberán considerar pagos más retenciones vigentes. Esa ampliación se especifica en `comprobantes-recibidos` y debe coordinarse antes de implementar, sin reescribir los artefactos históricos del otro cambio.

## Impact

- **Datos:** tablas propias de documentos y detalle; ampliación fiscal de proveedores, vínculos e imputación de retenciones, con RLS y grants mínimos. Futuras migraciones sin editar manualmente `supabase/database/schemas/`.
- **API/UI:** carga, consulta, edición y eliminación; integración con creación/detalle de compra, gastos y listado unificado de Documentos. Revisar compras automáticas desde arreglos y ambos puntos de alta de gastos.
- **Finanzas:** saldo, estado de pago, cuenta corriente del proveedor y validación de pagos posteriores deben reconocer las retenciones una sola vez, sin alterar saldos de cuentas ni stock.
- **Exportación:** reutilización selectiva de utilidades y columnas de ventas; su desglose limitado al 21%, receptor y ambiente de emisión no se copian sin adaptación.
- **Pendientes:** relación inversa entre documentos y compras, campos obligatorios, conciliación, duplicados/borrado de compra, detalle de imputación de retenciones, particularidades de gastos y contrato final del reporte. La carga de retenciones independiente de un pago fue recomendada, pero todavía no fue confirmada.
- **Fuera del alcance inicial:** adjuntos/fotos, borradores, NC/ND de compras y comprobantes especiales, emisión o verificación ante ARCA, OCR/importación, formatos de presentación y cálculo tributario o de crédito fiscal.
