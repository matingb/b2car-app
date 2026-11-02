# Proposal

## Why

[B2C-224](https://linear.app/b2car/issue/B2C-224/como-usuario-quiero-poder-generar-reportes-fiscales-para-facturas) requiere una planilla CSV/XLSX para el contador y el control fiscal de ventas. La exportación actual informa identificación y total, pero no permite revisar bases, IVA ni tributos; el Excel de referencia de Evolución aporta un formato y casos reales para definir ese contrato.

## What Changes

- Agregar un reporte fiscal de facturas, notas de crédito y notas de débito autorizadas de producción del tenant, originadas en arreglos o ventas, incluyendo las FCE que el sistema ya puede emitir.
- Usar una fila por comprobante, fecha fiscal para el período, receptor y emisor históricos, importes de NC negativos y referencias al origen y al comprobante asociado.
- Exportar neto gravado, importes de clase C sin IVA discriminado, exentos, no gravados, base e IVA al 21%, IVA total, otros tributos y total. Las columnas de otras alícuotas quedan para una ampliación futura; si aparecen en históricos, conservar sus totales y señalar el desglose fuera de alcance. Mantener separados los impuestos nacionales informativos para evitar duplicaciones.
- Generar XLSX con resumen conciliado y detalle filtrable; CSV con el mismo contrato de filas y columnas de detalle. Informar datos fiscales históricos incompletos sin inventar desgloses.
- Incorporar la columna prevista «Provincia del receptor». **Pendiente acordado:** validar su utilidad y significado con el contador e investigar la captura en cliente/factura y el enriquecimiento progresivo mediante padrón ARCA al generar reportes. La consulta progresiva y su persistencia todavía no son decisiones de implementación.
- Conservar la exportación general existente mediante una modalidad fiscal explícita, con período y alcance visibles; mantener autorización por tenant y permiso `facturas:view`.

## Capabilities

### New Capabilities

- `reportes-fiscales-ventas`: selección, reconstrucción histórica, desglose, conciliación y descarga de comprobantes fiscales de ventas para el contador, con tratamiento explícito de información faltante.

### Modified Capabilities

Ninguna: el inventario actual de `openspec/specs/` no contiene capacidades publicadas.

## Impact

- UI de Documentos (`src/app/(user)/facturacion/page.tsx`) y nuevo formulario de reporte con componentes compartidos.
- Modalidad adicional en `GET /api/facturas/export`, con servicio/repositorio propios para lectura por lotes, agregación fiscal y serialización; reutilización de ExcelJS y evaluación del constructor Excel existente.
- Lectura de `facturas_electronicas`, `facturas_electronicas_lineas` y snapshots de líneas originales simplificadas; sin recalcular desde arreglos, pagos, stock ni precios actuales.
- Investigación específica del adaptador `src/lib/arcaPadron/`, datos geográficos y snapshots inmutables. Cualquier persistencia o consulta progresiva se define después de resolver los pendientes de `design.md`.
- Sin nueva dependencia, nuevo cálculo de percepciones, importación a ARCA, cambio de emisión fiscal ni migraciones en el núcleo del reporte. El archivo real de referencia no se incorpora al repositorio ni a fixtures.
