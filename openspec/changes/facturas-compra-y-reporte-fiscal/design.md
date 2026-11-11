# Design

## Context

Ver [proposal.md](proposal.md) para la motivación y las specs de [comprobantes recibidos](specs/comprobantes-recibidos/spec.md) y [reporte de compras](specs/reportes-fiscales-compras/spec.md) para el contrato propuesto.

Esta versión captura lo conversado; **no es un diseño cerrado para implementar sin revisar sus pendientes**. Por pedido del usuario, las decisiones materiales abiertas se conservan identificadas y enlazadas con tareas de definición. La existencia de todos los artefactos no equivale a haber resuelto esas decisiones.

### Evidencia del checkout

Relevamiento estático del 10/11/2026. Se inspeccionaron código, pruebas próximas, configuración y esquema declarativo local; no se contrastó el esquema desplegado ni se operó sobre datos fiscales reales.

| Fuente | Observación relevante |
| --- | --- |
| `supabase/database/schemas/public/tables/facturas_electronicas.sql` | Orígenes restringidos a `ARREGLO` y `VENTA`; estados de emisión; moneda PES; numeración única por emisor y ambiente; una factura por operación/ambiente; snapshots y protección de autorizados. `origen_externo` no habilita un origen de compra. |
| `supabase/database/schemas/public/tables/facturas_electronicas_lineas.sql` | Detalle fiscal unido a líneas de emisión y orígenes comerciales de ventas/arreglos. |
| `supabase/database/schemas/public/tables/operaciones_compra.sql` | Proveedor opcional; no datos del comprobante recibido. |
| `supabase/database/schemas/public/tables/operaciones_gasto.sql` | Categoría y descripción; sin proveedor. |
| `src/app/api/operaciones/operacionesService.ts` | El alta de gasto fuerza `p_proveedor_id` a `null`; no basta con agregar un selector de proveedor en la UI. |
| `src/app/api/gastos/route.ts` | Existe otro punto de alta de gastos por movimientos manuales; comparte el universo de operaciones GASTO. |
| `src/app/api/operaciones/[id]/documentos/route.ts`, `src/lib/documentos/documentosService.ts` | Los documentos asociados actuales se consultan como documentos de una venta o arreglo, con ambiente de emisión. |
| `src/lib/facturacion/reporteFiscal.ts`, `reporteFiscalCalculos.ts` | Contrato de ventas de 24 columnas, desglose limitado al 21%, importes en centavos y tratamiento de desconocidos. |
| `src/app/api/facturas/export/facturasReporteRepository.ts`, `facturasReporteService.ts` y sus tests | Lectura por tenant, autorizadas y ambiente; extracción paginada, servicio inyectable y rechazo de generación parcial. |
| `src/lib/excel/excelExportBuilder.ts`, `package.json` | Ya hay utilidades de exportación y ExcelJS. |
| `openspec/changes/rediseno-operaciones-ledgers/specs/operaciones/spec.md` | Se conserva el borrado físico de operaciones para corregir ítems. Hay que resolver expresamente su interacción con los comprobantes recibidos. |

El inventario principal de specs está vacío. Los cambios de ventas y ledgers se usan como contexto de compatibilidad, sin editar sus artefactos en esta propuesta. Las rutas de esquema de algunos documentos anteriores apuntan a `supabase/schemas/`; el checkout revisado las contiene bajo `supabase/database/schemas/`.

### Estado de los acuerdos

- **Confirmado:** cargar facturas de proveedores en el contexto de compras/gastos y obtener un reporte que muestre y totalice importes informados. Determinar crédito fiscal, deducibilidad y tributos aplicables queda fuera del análisis.
- **Confirmado como pendiente:** gestión de retenciones. Primera idea del usuario: cargarlas al registrar un pago de una operación que tenga factura asociada. No se acordó su modelo ni su efecto en saldos o reporte.
- **Propuesto para revisión:** entidad separada de comprobantes recibidos, carga manual, snapshots de identidad, respaldo documental privado y reporte CSV/XLSX por fecha de emisión.
- **Sin confirmar:** cardinalidad, facturas independientes, catálogo completo, estados, correcciones, adjuntos obligatorios, moneda, NC/ND, columnas y permisos concretos.

## Goals / Non-Goals

**Goals:**

- Separar persistencia del comprobante, vínculo operativo y representación del reporte.
- Reutilizar utilidades compatibles, conservando independientes los contratos de emisión y recepción.
- Mantener consistencia monetaria, procedencia e integridad por tenant sin duplicar impactos.
- Hacer visibles las decisiones pendientes para que una implementación posterior no las resuelva por omisión.

**Non-Goals:**

- Incorporar campos o reglas de crédito fiscal computable.
- Implementar retenciones, modificar cancelaciones o reservar un esquema de retenciones como si estuviera decidido.
- Autorizar/verificar automáticamente comprobantes ante ARCA, ejecutar OCR o importar comprobantes en esta primera propuesta.
- Reconstruir datos fiscales históricos desde precios, stock o pagos.

## Decisions

### D1. Entidad de comprobantes recibidos separada, como recomendación técnica

Proponer tablas propias en `public`, sin requerir otra base. Reutilizar `facturas_electronicas` exigiría cambiar estados, restricciones de origen, permisos, unicidad, protección de snapshots y consumidores orientados a emisión. El ahorro inicial de columnas compartidas no compensa ese acoplamiento.

Agregar todos los datos a `operaciones_compra`/`operaciones_gasto` también se desaconseja: repetiría estructura fiscal y haría difícil representar una factura que cubra más de una operación o varios comprobantes de una compra.

Modelo lógico candidato, sujeto a P-REL/P-CAT/P-ARCH:

```text
COMPRA / GASTO --> vinculo --> comprobante recibido --> reporte de compras
                                      |
                      +---------------+---------------+
                      v               v               v
                 desglose IVA   otros conceptos    adjuntos

pago de operacion --> retenciones: HIPOTESIS P-RET, SIN MODELO CERRADO
```

| Entidad candidata | Contenido y límite |
| --- | --- |
| `comprobantes_recibidos` | Tenant, identidad fiscal, tipo/clase/numeración, fechas, partes históricas, importes, moneda, datos de autorización informados y trazabilidad de carga. |
| Relación con operación | `operacion_id` o tabla de vínculos según P-REL. No crear ambos mecanismos sin resolver la cardinalidad. |
| Detalle de IVA | Solo si se acuerda capturar alícuotas; el IVA total no exige inventar líneas de productos. |
| Detalle de otros conceptos | Categoría e importe efectivamente informados; jurisdicción cuando corresponda. Catálogo sujeto a P-CAT; no contiene retenciones diferidas. |
| Adjuntos | Referencia privada al archivo, comprobante, tenant, nombre y metadatos de carga. Política final en P-ARCH. |

Los nombres son candidatos, no DDL aprobado. No se agrega una tabla de retenciones en esta versión.

### D2. Identidad fiscal conservada en el comprobante

Conservar un snapshot de emisor y receptor, además de referencias comerciales que se acuerden. La ficha del proveedor sirve como precarga; su edición posterior no reescribe comprobantes. Guardar tipo, punto de venta y número de forma que la presentación preserve ceros iniciales.

Para gastos, P-ID debe elegir entre identificar al emisor solo en el comprobante o ampliar la asociación comercial con proveedores. No modificar silenciosamente `operaciones_gasto` ni asumir que el proveedor opcional de compras aporta todos los datos fiscales necesarios. También hay que distinguir al receptor fiscal del taller operativo y contemplar cambios de CUIT del tenant.

Alternativa desaconsejada: construir la identidad en cada exportación desde la ficha actual. Haría variar reportes anteriores al editar un proveedor.

### D3. Importes declarados y conciliación explícita

Usar valores decimales persistidos y sumas en centavos, aprovechando utilidades existentes. Conservar IVA total sin exigir que sea deducible ni que todo sea 21%. La carga por alícuota es una decisión de P-CAT, no una excusa para inferirla desde el total.

El total facturado es un importe informado; sus componentes no se suman otra vez al exportarlo. P-CAT/P-REL deben acordar las validaciones y cómo tratar diferencias entre desglose, total y monto operativo. Diferenciar cero conocido, ausencia e inconsistencia; no rellenar tributos a partir de la condición fiscal.

Ejemplo del núcleo: compra 121000, factura neto 100000 + IVA 21000, pago 60000. El reporte muestra total 121000 e IVA 21000; asociar el comprobante no cambia el pago ni el stock.

### D4. API y acceso propios del circuito de recepción

Se propone un módulo `src/app/api/comprobantes-recibidos/` con rutas de carga, consulta y exportación, servicios inyectables y repositorios. Los nombres y contratos definitivos se revisan con P-UX. La consulta asociada a operaciones debe distinguir documentos emitidos y recibidos en vez de tratar toda operación como `VENTA`.

Derivar tenant de la sesión; validar que toda relación pertenezca al mismo tenant. Mantener RLS, grants mínimos e índices sobre relaciones y filtros de reporte en las futuras migraciones. No copiar indiscriminadamente permisos de emisión ni exigir certificados/configuración de emisor a quien registra una factura de proveedor. La matriz efectiva por rol/plan y el alcance por taller se cierran en P-UX/P-ID.

Los adjuntos se sirven con autorización del comprobante desde almacenamiento privado. P-ARCH define límites, formatos, reemplazo y compensación ante fallos; una URL conocida no habilita acceso a otro tenant.

### D5. Flujo manual sin reejecutar la operación

Proponer acceso durante la carga y desde el detalle de una operación existente. Deben revisarse `OperacionCreateModal`, `OperacionGastoForm`, `OperacionExpandedDetail`, el alta manual de gastos y las compras generadas desde arreglos. No es necesario que todos compartan el mismo formulario, pero sí la misma regla de asociación.

P-UX define si operación y comprobante se confirman juntos o si la factura se asocia después. En el segundo caso, un fallo debe conservar la operación ya creada y permitir reintentar la asociación sin volver a comprar, pagar ni recibir stock. Un archivo cargado y una cabecera persistida requieren coordinación para evitar huérfanos o un éxito aparente.

Los costos del inventario y sus precios no se recalculan al cargar IVA; cambiar ese comportamiento sería otro alcance.

### D6. Reporte propio con reutilización selectiva

Crear selección y normalización propias para comprobantes recibidos. Reutilizar el constructor de Excel, protección de textos y utilidades de centavos donde sean compatibles. `FiscalRow`, sus columnas de receptor, sus reglas de clase C y el desglose al 21% pertenecen a ventas y requieren evaluación, no copia directa.

La versión inicial propone período por fecha de emisión y columnas de fecha, identificación, proveedor/emisor, receptor fiscal, netos, IVA informado, otros conceptos identificados y total. P-REP debe aprobar el contrato; no se afirma que estas sean las columnas exigidas por ARCA ni un formato validado por el contador. El respaldo no sustituye los datos estructurados.

Una factura aporta una fila independientemente de sus relaciones. Agregar componentes por comprobante antes de componer el reporte evita multiplicar importes por joins a pagos, adjuntos o vínculos. CSV y XLSX comparten las mismas filas normalizadas; el resumen se obtiene de ellas.

La consulta no hereda `ARCA_AMBIENTE` ni exige `AUTORIZADA`: esos filtros pertenecen a emisión. P-CICLO/P-REP definen estados locales incluidos y un mecanismo de lectura consistente ante correcciones. Se requiere una instantánea de lectura coherente o detección explícita de cambios que impidan completar el archivo. Un corte por `created_at` y paginación, por sí solos, no garantizan consistencia si los comprobantes son editables. La solución elegida debe cubrir altas, modificaciones y bajas durante la generación, con todas las páginas incluidas y fallo sin archivo parcial.

Mantener el reporte de ventas separado. Sin gestión de retenciones definida, no agregar columnas en cero o subtotales ficticios que indiquen cobertura de ese universo.

### D7. Registro de decisiones pendientes solicitado por el usuario

Estas son decisiones materiales abiertas en un borrador deliberadamente inicial. Las tareas que dependen de ellas comienzan después de resolverlas y reflejar el resultado en los artefactos. No se usan valores por defecto para convertirlas en acuerdos.

| ID | Tema y decisión pendiente | Primera idea o alternativa a evaluar | Qué condiciona |
| --- | --- | --- | --- |
| **P-RET** | Cómo registrar y gestionar retenciones de compras. Definir impuestos, fecha, constancia, relación pago/factura, pagos parciales, distribución, anulaciones y efecto en saldo/reporte. | **Idea del usuario:** al pagar una operación con factura asociada, permitir cargar las retenciones practicadas. Es una hipótesis, sin aprobación del modelo. | Ampliación diferida; no implementar campos, cancelaciones ni exportación de retenciones en el núcleo. |
| **P-REL** | Una o varias facturas por operación; una factura para varias operaciones; carga independiente; discrepancias entre montos. | Evaluar una relación simple para el caso habitual y vínculos con importes solo si hay casos reales que los requieran. | Relaciones, claves, API y validación de asociaciones. |
| **P-ID** | Emisor en gastos y compras sin proveedor; receptor fiscal; obligatoriedad y precarga de CUIT; alcance por taller. | Snapshot fiscal en el comprobante con referencia comercial opcional; decidir si agregar proveedor a gastos aporta valor. | Campos obligatorios, precargas y restricciones de acceso/vínculo. |
| **P-CAT** | Tipos y clases admitidos, CAE/CAI/otros respaldos, IVA total o alícuotas, percepciones y otros tributos. | Empezar por facturas y montos efectivamente informados. Los conceptos investigados son candidatos; validar muestras antes de cerrar catálogo. | Contratos de carga, detalle y validaciones; no incluye crédito fiscal. |
| **P-CICLO** | Borrador/registro/corrección/anulación; duplicados; conservación del comprobante al borrar una operación; historial. | Identidad de deduplicación candidata: tenant + receptor + emisor + código + punto de venta + número. Evaluar desvinculación conservando el comprobante o restricción del borrado. | Unicidad, estados, permisos, lectura consistente y compatibilidad con operaciones. |
| **P-ARCH** | Archivo obligatorio u opcional, cantidad, formatos, tamaño, reemplazos y fallos parciales. | PDF e imagen como candidatos; almacenamiento privado. La carga estructurada es la fuente del reporte. | Políticas de Storage, formulario y coordinación de guardado. |
| **P-REP** | Columnas, criterio temporal, estados incluidos, NC/ND, moneda/cotización, destinatario y consistencia de generación. | CSV/XLSX para contador y fecha de emisión como propuesta. Si se incluyen NC/ND, definir sus propios signos/referencias; si se incluyen monedas múltiples, separar o convertir con criterio trazable. | Aceptación del reporte, lectura, normalización y serialización. |
| **P-UX** | Puntos de entrada, momento de guardado y permisos para cargar/ver/corregir/exportar. | Carga opcional desde compra/gasto y asociación posterior desde detalle; revisar gastos manuales y compras automáticas. | API pública, UI, autorización y tratamiento de fallos. |

P-RET puede mantenerse diferido mientras se revisa el núcleo. Para P-REL/P-ID/P-CAT/P-CICLO/P-ARCH/P-REP/P-UX hay que cerrar las decisiones aplicables antes de implementar su bloque. Los casos todavía no contemplados se resuelven ajustando el alcance, no suponiendo aprobación.

### D8. Resultado de la búsqueda conceptual de impuestos

El cliente mencionó IVA y retención de Ganancias. El relevamiento identificó candidatos adicionales, sin confirmar que correspondan al cliente ni habilitar cálculo:

| Concepto | Diferencia que debe conservar el modelo | Fuente oficial |
| --- | --- | --- |
| IVA facturado | Importe de la factura, distinto de una retención de IVA. | [RG 2408, art. 8](https://biblioteca.afip.gob.ar/search/query/norma.aspx?p=t%3ARAG%7Cn%3A2408%7Co%3A3%7Ca%3A2008) |
| Retención de Ganancias | Normalmente se documenta al pagar; la primera idea de P-RET se refiere a este momento. | [RG 830, art. 10](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-830-2000-62872/actualizacion) |
| Retención de IVA | Según el régimen, se practica al pagar y se documenta con constancia; no equivale al IVA discriminado. | [ARCA, régimen general de facturación](https://www.afip.gob.ar/facturacion/regimen-general/) |
| Percepción de IVA | Puede adicionarse en la factura al precio neto y al IVA. | [RG 2408, art. 8](https://biblioteca.afip.gob.ar/search/query/norma.aspx?p=t%3ARAG%7Cn%3A2408%7Co%3A3%7Ca%3A2008) |
| Percepción/retención de IIBB | Distinguir importes adicionados y detraídos, y conservar jurisdicción. | [ARBA, diferencias entre percepción y retención](https://www.arba.gov.ar/Informacion/Agentes/Recaudacion/diferencias.asp?lugar=P) |

También existen percepciones de Ganancias en determinadas importaciones ([RG 2281](https://www.argentina.gob.ar/normativa/nacional/norma-130808/actualizacion)); importaciones no forman parte del núcleo propuesto. La lista no es un catálogo exhaustivo ni una matriz de aplicabilidad tributaria. No se fijan porcentajes, mínimos ni reglas de crédito fiscal.

## Risks / Trade-offs

- **[Borrador tratado como contrato cerrado]** → Mantener IDs de pendientes y tareas de definición previas; revisar requisitos y escenarios afectados después de cada decisión.
- **[Duplicar deuda, pago o stock]** → Asociar la factura mediante su circuito propio; probar invariancia de operación e impactos.
- **[Retenciones confundidas con componentes facturados]** → Mantener P-RET diferido y no dar por acordado un campo en la factura ni una suma que altere su total.
- **[Borrado operativo destruye evidencia fiscal o cambia el contrato vigente]** → Resolver P-CICLO antes de elegir FK/cascada o restricción; coordinar un cambio de requisitos de operaciones si fuera necesario.
- **[Gasto sin proveedor o compras automáticas fuera del flujo]** → Revisar todos los puntos de entrada; no depender solo del formulario de compras manuales.
- **[Identidad o totales variables al editar fichas]** → Snapshot del comprobante, separación entre ausencia/cero y fuentes históricas.
- **[Adjuntos expuestos o huérfanos]** → Autorización por tenant y comprobante, validación de archivos y flujo de compensación acordado en P-ARCH/P-UX.
- **[Exportación incompleta o mezclada entre versiones]** → Lectura consistente de cabeceras/detalle, paginación completa y cancelación de generación ante fallo.
- **[Copiar supuestos de ventas]** → Pruebas de regresión del contrato actual; selección y filas propias para recibidos.

## Migration Plan

1. Revisar esta versión con el usuario/cliente y resolver los pendientes del núcleo que condicionan cada bloque. Conservar P-RET diferido o definirlo en una revisión explícita; no introducirlo por efecto de implementar el resto.
2. Ajustar specs, diseño y tareas con las decisiones. Si una política cambia el borrado u otro comportamiento de operaciones, añadir el contrato afectado y coordinarlo con el cambio de ledgers, sin reescribir su historia silenciosamente.
3. Crear migraciones incrementales para las entidades finalmente acordadas, índices, validaciones, RLS, grants y Storage. No migrar facturas emitidas como compras ni inventar datos para operaciones históricas. No editar el esquema declarativo a mano.
4. Validar migraciones y aislamiento en una DB local desechable autorizada, con fixtures ficticios. Verificar que pagos, stock, gastos y exportación de ventas conservan sus contratos.
5. Implementar API/UI/exportación del alcance revisado y validar un flujo completo con comprobantes sintéticos. La prueba de la estructura OpenSpec no sustituye estas verificaciones.
6. Desplegar por cambios aditivos compatibles después de las dependencias efectivamente aplicadas. Ante rollback, retirar acceso al nuevo circuito conservando comprobantes y respaldos ya cargados; cualquier retirada de datos requiere una estrategia específica, no un `DROP` automático.

## Open Questions

Detalles diferibles que no cambian la arquitectura ni el núcleo del contrato: nombre visible de la sección, orden visual de campos ya acordados y orden de columnas una vez cerrado su conjunto en P-REP. Las decisiones materiales abiertas están en D7 y deben resolverse antes del bloque dependiente.
