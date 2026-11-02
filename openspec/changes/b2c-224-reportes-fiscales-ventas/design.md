# Design

## Context

Ver [proposal.md](proposal.md) para motivación y [la spec](specs/reportes-fiscales-ventas/spec.md) para el contrato observable.

### Estado de las definiciones

- Confirmado por el usuario: destino contador/control fiscal, uso del Excel aportado como referencia y provincia incluida con investigación pendiente tanto de utilidad como de obtención/persistencia.
- Ajuste de alcance confirmado: esta versión desglosa únicamente IVA al 21%; las columnas para otras alícuotas se reservan para una ampliación futura.
- Base propuesta para revisión a partir de la discusión: autorizados de producción, fecha fiscal, NC negativas, identidad histórica, resumen conciliado y exportación de impuestos efectivamente registrados.
- Decisiones técnicas de esta propuesta: modalidad adicional compatible, formulario propio, filtros fiscales explícitos, columnas extendidas, corte de autorización y representación de datos incompletos. No se presentan como un formato exigido por ARCA ni como una validación del contador.
- Pendientes expresos: P1/P2/P3 en la decisión 8. Su resultado puede originar una ampliación posterior; el núcleo descrito no depende de presuponerlo.

### Evidencia del checkout y de la referencia

Relevamiento estático del 02/11/2026; no se consultaron datos de producción ni se emitieron comprobantes.

| Fuente | Comportamiento observado |
| --- | --- |
| `src/app/api/facturas/export/route.ts` | Ya descarga CSV/XLSX usando ExcelJS y `requireTenantBillingActor`; exporta 11 columnas generales, sin bases ni IVA. |
| `src/lib/facturacion/facturacionService.ts` | `exportFacturasRows` recorre `listFacturas`; el DTO resumido omite importes fiscales. `listFacturas` filtra fecha fiscal y admite todos los estados/ambientes si no se indican. |
| `src/app/(user)/facturacion/page.tsx` | La exportación general hereda filtros y búsqueda del listado; no constituye por sí sola un reporte fiscal de período. |
| `supabase/schemas/public/tables/facturas_electronicas.sql` | Cabecera fiscal, estados, ambiente, origen, snapshots, fecha, moneda PES, totales, relación a la factura original e instante de autorización. Los importes almacenados de NC son positivos. |
| `supabase/schemas/public/tables/facturas_electronicas_lineas.sql` | Importes fiscales por línea, tratamiento IVA, alícuota y snapshot. |
| `createSimplifiedArregloLine` en `facturacionService.ts` | Una línea de presentación puede reunir tasas distintas; los conceptos fiscales se conservan en `snapshot.lineasOriginales`. |
| `src/lib/facturacion/notaCreditoConceptos.ts` | Existe `expandirLineasOriginales`, reutilizable después de validar la estructura fiscal; expandir reemplaza, no agrega, la línea de presentación. |
| `src/lib/facturacion/arcaPayload.ts` | Emisión actual con `tributos: 0` y `otrosImpuestosNacionales: 0`; el catálogo técnico contempla varias tasas, pero el alcance de este reporte se limita al uso actual de 21%. Para C se acumula el importe sin IVA en el campo interno `netoGravado`. |
| `facturacion_bloquear_snapshot_autorizado.sql` | El snapshot autorizado es inmutable, con excepciones específicas ajenas a la provincia. |
| `src/lib/arcaPadron/arcaPadronGateway.ts` y `types.ts` | El adaptador A13 devuelve dirección, pero no expone provincia. |
| `src/lib/excel/excelExportBuilder.ts` | Constructor de tablas, filtros, encabezado fijo y buffer; permite reutilizar serialización sin ampliar su comportamiento por defecto. |

El archivo suministrado `REPORTE VENTAS.xlsx` contiene:

- Hoja `VENTAS`, encabezados en A10:T10 y 359 filas: 115 facturas A, 241 B y tres NC negativas. No hay ND, C ni ejemplos con IVA distinto de 21%.
- Resumen de razón social, período, total, neto, IVA débito, tributos y cantidad.
- Otra hoja, `Worksheet 1`, con columnas Número, Tipo documento, Fecha, Nombre, Documento, Tipo tributo, Alícuota e Importe tributo, sin filas de detalle. Todos los otros tributos de la muestra valen cero.
- Diferencias de redondeo: IVA del encabezado $4.623.621,04 frente a $4.623.621,50 sumando las filas; neto gravado de filas $22.017.244,51 frente a total base imponible $22.017.244,42. El total $26.640.865,46 sí coincide con la suma de totales.

Se usa la referencia para organización y conceptos. Sus diferencias no se convierten en reglas ni se incorporan datos personales reales a pruebas. No hay capacidades publicadas en `openspec/specs/`; el cambio activo de ledgers distingue documento, pagos y stock, sin cambiar la fuente fiscal de este reporte.

## Goals / Non-Goals

**Goals:** separar selección fiscal, agregación histórica y serialización; obtener filas completas sin consultas por factura; asegurar signos, precisión y procedencia; representar desconocidos sin ocultar inconsistencias.

**Non-Goals:** alterar emisión/CAE, implementar percepciones o columnas para otras alícuotas de IVA, cobrar/devolver stock, reproducir un formato de importación, emitir tipos FCE adicionales, modificar snapshots autorizados o implementar todavía el enriquecimiento geográfico.

## Decisions

### 1. Modalidad fiscal explícita y compatible

Agregar `reporte=fiscal` al endpoint existente. Sin ese parámetro continúa el contrato general actual. Un valor de `reporte` desconocido se rechaza; la rama fiscal exige `format=csv|xlsx`, `desde` y `hasta`, acepta `documentoTipo`, `origenTipo` y `cuitEmisor`, y rechaza filtros operativos incompatibles en lugar de ampliar el alcance silenciosamente.

En Documentos, agregar la acción «Reporte fiscal» con formulario propio y selector de formato. Sugerir el mes actual en calendario GMT-3, permitir editar ambos extremos y mostrar «Autorizados · Producción» como alcance fijo. Por defecto incluye todos los documentos y ambos orígenes; no hereda búsqueda, clase, estado, ambiente, factura asociada ni página del listado. El período fiscal siempre se revisa antes de descargar. La exportación general mantiene sus enlaces actuales.

Es una decisión de diseño propuesta para preservar compatibilidad, no un requisito de copiar exactamente la pantalla del Excel. Alternativas: convertir todos los enlaces actuales rompería la exportación de estados de diagnóstico; crear otro endpoint duplicaría el transporte existente.

### 2. Separación de responsabilidades y lectura sin escrituras

La ruta autentica, valida query y delega al servicio fiscal; el servicio consume un repositorio inyectable, transforma datos, verifica consistencia y solicita la serialización. Los módulos nuevos se ubican junto al endpoint, por ejemplo `facturasReporteService.ts` y `facturasReporteRepository.ts`; los serializadores y tipos de columnas pueden vivir en `src/lib/facturacion/`.

Usar el cliente de sesión con RLS y filtro de tenant explícito. `requireTenantBillingActor` conserva membresía activa, rol/plan y `facturas:view`. No introducir service role, nuevas tablas, migraciones ni llamadas a ARCA en el núcleo inicial. Compartir utilidades de Excel existentes si admiten el diseño sin alterar los consumidores actuales; no añadir dependencias.

Alternativa descartada: reutilizar directamente `exportFacturasRows`, porque trabaja con un resumen sin desglose y su selección no impone el universo fiscal.

### 3. Fuente y selección del conjunto

```text
sesion + filtros fiscales + instante de corte
  --> cabeceras AUTORIZADA / PRODUCCION / ARREGLO o VENTA
  --> lotes de lineas y cabeceras asociadas del mismo tenant
  --> expansion de originales fiscales + agregacion por factura
  --> filas normalizadas + resumen de esas filas
  --> CSV o XLSX
```

Leer solo columnas necesarias; incluir `id`, snapshots, referencias, fechas, clase/tipo, moneda, todos los importes y `autorizada_at`. No hacer joins a pagos, movimientos financieros, stock o líneas operativas, ni multiplicar filas por relaciones de uno a muchos.

Recorrer cabeceras con cursor sobre `(fecha_comprobante, id)` ascendente; no depender del tamaño de página del listado, de un `count` mutable ni de una única respuesta sujeta a límites de Supabase. Fijar un corte de autorización al comienzo: `autorizada_at <= corte`; para registros históricos con autorización sin fecha, usar `created_at <= corte` y señalar esa limitación temporal. Los caminos actuales de autorización y reconciliación guardan `autorizada_at`, de modo que nuevas autorizaciones quedan excluidas. Las cabeceras autorizadas y líneas son inmutables.

Cargar líneas y referencias por lotes de IDs, acotados al tenant padre. Si las líneas de un lote exceden el límite de respuesta, paginarlas también con orden único, sin suponer que una factura tiene pocas líneas. Eliminar duplicados por ID como comprobación de integridad, no como sustituto de una consulta correcta. Evitar consultas N+1 a `getFacturaDetalle`, que además carga intentos innecesarios.

Un error de cualquier lectura cancela la generación. No ofrecer un archivo truncado por un límite interno; si un volumen excede la capacidad disponible, fallar explícitamente. El paso a trabajo asíncrono queda fuera de esta primera arquitectura; medir un caso de más de 1000 comprobantes antes de liberar.

Alternativa: una RPC de snapshot transaccional podría ser útil a gran escala, pero agrega una migración y superficie de permisos que el reporte inicial no necesita. La elección del cursor se valida con inserciones/autorizaciones concurrentes sintéticas.

### 4. Contrato único de filas y columnas

Los dos serializadores comparten un registro ordenado de columnas, estable aun sin resultados. Este es el orden inicial; el único desglose por alícuota es el par base 21% / IVA 21%. Los valores son de presentación del reporte: el signo no se persiste en la factura.

| Clave | Encabezado | Fuente o regla |
| --- | --- | --- |
| `fecha` | Fecha comprobante | `fecha_comprobante`, fecha calendario. |
| `numero` | Número | Punto de venta y número como texto `00005-00000103`. |
| `tipo` | Tipo documento | Factura/NC/ND + clase; marca FCE MiPyME si corresponde. |
| `codigoArca` | Código ARCA | `tipo_comprobante`; permite distinguir inequívocamente la FCE. |
| `cae` | CAE | Texto del comprobante, sin notación científica. |
| `caeVencimiento` | Vencimiento CAE | Fecha conservada. |
| `cuitEmisor` | CUIT emisor | `emisor_snapshot.cuit`, texto. |
| `receptor` | Nombre receptor | `receptor_snapshot.nombre`. |
| `documentoTipo` | Tipo documento receptor | Código y etiqueta de documento histórico; conserva 99 para CF. |
| `documentoNumero` | Documento receptor | Número como texto; conserva 0 para CF sin identificar. |
| `condicionIva` | Condición IVA receptor | Código histórico y etiqueta; desconocido se informa. |
| `netoGravado` | Importe neto gravado | Cabecera para A/B/M y sus FCE; cero para C. |
| `sinIvaC` | Importe sin IVA clase C | Campo interno `importe_neto_gravado` para C; cero para otras clases. |
| `exento` | Importe exento | `importe_exento`. |
| `noGravado` | Importe neto no gravado | `importe_no_gravado`. |
| `base21`, `iva21` | Importe base 21% / Importe IVA 21% | Importes históricos de líneas GRAVADO con ID 5, sin recalcularlos. |
| `baseTotal` | Importe total base imponible | Igual a base 21% cuando el desglose es completo; cero para C; desconocido si falta desglose o hay otras alícuotas fuera de alcance. |
| `ivaTotal` | Importe total IVA | `importe_iva`; no se sustituye por una tasa sobre el total. |
| `otrosTributos` | Importe otros tributos | `importe_tributos`, agregado fiscal. |
| `impuestosNacionales` | Otros impuestos nacionales informados | `otros_impuestos_nacionales`; informativo, no adicional al total. |
| `total` | Importe total | `total` de cabecera. |
| `moneda` | Moneda | PES en el contrato actual. |
| `provincia` | Provincia del receptor | Columna prevista; «No informada» sin dato verificable. Ver pendiente P1. |
| `origen` | Origen | ARREGLO o VENTA. |
| `origenId` | Referencia origen | ID de arreglo o venta; no identifica al receptor fiscal. |
| `asociado` | Comprobante asociado | Tipo y número de la factura relacionada; sin agregarla al período. |
| `facturaId` | ID comprobante | Identificador estable para auditoría y diagnóstico. |
| `estadoDesglose` | Estado desglose | COMPLETO, NO_APLICA_C o INCOMPLETO. |
| `observaciones` | Observaciones | Datos faltantes, diferencia fiscal, tributos sin detalle o autorización sin fecha. |

El «total base imponible» se mantiene por familiaridad con la referencia, pero tiene semántica explícita. No se calcula dividiendo el total por 1,21. Si difiere del neto de cabecera se conserva la diferencia y se informa.

El contrato inicial no incluye pares de columnas para otras alícuotas ni los agrega dinámicamente ante un histórico excepcional. Su incorporación se deja como ampliación futura cuando el producto las necesite. Se mantienen las columnas diferenciadas de clase C, exentos y no gravados porque representan tratamientos distintos del IVA al 21%.

### 5. Normalización, clase C y conciliación

Mantener cantidades monetarias como centavos enteros al agregarlas; convertir los `numeric(14,2)` al entrar sin pérdidas silenciosas y validar el rango seguro. No usar aritmética binaria acumulativa ni formateo localizado para calcular. Aplicar factor -1 a todo importe de NC y +1 a facturas/ND; la base de datos conserva sus valores positivos.

Para A/B/M, separar GRAVADO, EXENTO y NO_GRAVADO y sumar base e IVA de las líneas gravadas con ID fiscal 5 (21%). En detalles simplificados, validar y expandir `snapshot.lineasOriginales`, reemplazando el contenedor; esto sigue siendo necesario para distinguir conceptos gravados al 21%, exentos y no gravados. Los originales ya contienen importes fiscales; no volver a fiscalizar. Las notas usan sus propias líneas, no el detalle completo de la factura asociada.

Para C, llevar el importe interno de neto a `sinIvaC` y conservar exento/no gravado. `base21`, `iva21` y `baseTotal` valen cero por no aplicación, no porque el documento se reclasifique como gravado al 0%. `estadoDesglose=NO_APLICA_C` no equivale a datos incompletos. El IVA total se conserva desde cabecera: normalmente cero; si una C histórica contiene IVA incompatible, informarlo como inconsistencia sin corregir el documento.

Contrastar en centavos: base 21% contra neto de cabecera e IVA 21% contra IVA total cuando el desglose es completo dentro del alcance; exentos/no gravados contra sus cabeceras; y `netoGravado + sinIvaC + exento + noGravado + ivaTotal + otrosTributos` contra total. Los impuestos nacionales informativos no se suman otra vez. En una inconsistencia se mantienen los valores de cada fuente y una observación cuantificada.

Cuando faltan datos para verificar el 21%, dejar desconocidos sus casilleros, conservar cabecera y marcar INCOMPLETO. La inexistencia de movimientos al 21% solo implica cero si es verificable. La falta de provincia se informa aparte y no vuelve incompleto un IVA correctamente reconstruido. Si falta una referencia o identificación, conservar la fila y advertirlo; no suprimir comprobantes.

Si aparece una línea gravada con otra alícuota, conservar neto, IVA total y total de cabecera y marcar INCOMPLETO con observación «Alícuota fuera del alcance del desglose». Mantener únicamente los importes al 21% que puedan verificarse, sin atribuirles conceptos de otra tasa; si se conoce que no hay movimientos al 21%, sus casilleros valen cero. `baseTotal` queda indeterminado porque esta versión no representa el desglose completo. Identificar la tasa excepcional en la observación no implica implementar su cálculo, agregar columnas o excluir la factura. El resumen informa el desglose parcial y conserva los totales de todas las cabeceras.

### 6. Tributos y percepciones

La primera entrega exporta `importe_tributos`; la muestra no acredita qué percepciones se necesitan ni el checkout dispone de detalle por tipo/jurisdicción. No poblar columnas de «Percepción IVA» o «Percepción IIBB» con supuestos ni equiparar el número de inscripción del emisor a un monto.

El contrato inicial no crea una hoja de tributos con filas ficticias. Un importe agregado no nulo sin detalle genera observación. Investigar con el contador el catálogo necesario queda registrado como P3; habilitar desglose o emisión de nuevos tributos requiere ampliar el contrato y las tareas antes de implementarlo.

El [manual WSFEv1 v4.7](https://www.arca.gob.ar/ws/documentacion/manuales/manual-desarrollador-ARCA-COMPG.pdf), consultado el 02/11/2026, separa IVA y Tributos; este último documenta código, descripción, base, alícuota e importe. Es una referencia de estructura, no prueba de que un tenant deba percibir un impuesto.

### 7. Presentación y serialización

- XLSX: hoja `Resumen` y hoja `Comprobantes`. La primera identifica el período, alcance, corte, PES y emisores por CUIT/razón social histórica; lista subtotales por CUIT y clase y cantidad total, de facturas, NC y ND, incompletos y sin provincia. Sus montos se obtienen exclusivamente de las mismas filas. Un subtotal de una columna con valores desconocidos se etiqueta como parcial y cuenta los faltantes; no se presenta un cero como total completo.
- `Comprobantes`: encabezado fijo, autofiltro, importes numéricos con dos decimales, identificadores textuales y fechas calendario con presentación DD/MM/AAAA. Las fórmulas no son necesarias: los valores finales son sumas de centavos auditables.
- CSV: un único encabezado de detalle, orden compartido con XLSX, UTF-8 BOM, separador coma, decimales con punto y sin símbolo monetario/miles, fechas ISO y CRLF. Escapar coma, comillas, CR y LF; neutralizar texto no confiable que una planilla interprete como fórmula sin convertir los importes de NC a texto.
- Cero filas: columnas estables, resumen cero, detalle vacío. La razón social de un emisor sin movimientos no se inventa desde una factura; se identifica tenant/período y se aclara que no hubo emisores con comprobantes en ese conjunto.
- Archivo `reporte-fiscal-ventas-AAAA-MM-DD_AAAA-MM-DD.csv|xlsx`, utilizando el rango elegido. Respuesta `private, no-store`; logs sin documentos, CAE ni datos personales innecesarios.

Alternativa: poner el resumen antes del encabezado del CSV haría irregular su tabla; usar las sumas del Excel externo replicaría diferencias ya detectadas.

### 8. Provincia: investigación acordada y alcance condicionado

La columna permanece en el contrato inicial y se acepta «No informada». La carga en cliente/factura y la consulta progresiva durante reportes son hipótesis que pidió investigar el usuario. El núcleo es de lectura; resolver P1/P2 no es condición para desarrollar sus importes, pero sí para implementar cualquier consulta o persistencia geográfica.

| Pendiente | Qué hay que investigar y registrar | Límite vigente |
| --- | --- | --- |
| P1: utilidad y significado | Consultar al contador si necesita provincia, para qué control y si representa domicilio fiscal del receptor o jurisdicción de la operación. Documentar inclusión definitiva o cambio justificado. | La columna está prevista; no inferir que una provincia del padrón determina jurisdicción impositiva. |
| P2: obtención y persistencia | Evaluar provincia actual del cliente, dato conservado al emitir y enriquecimiento posterior; A13, credenciales disponibles, CUIT/CUIL/DNI, múltiples domicilios, caché, deduplicación, límites, actualización, errores y procedencia temporal. | No implementar consultas ni escrituras geográficas hasta definir la política y actualizar este diseño y sus tareas. |
| P3: percepciones necesarias | Confirmar si el contador necesita categorías además del agregado y qué fuentes contienen sus importes. | No crear detalle ni cálculo de impuestos que el producto no registra. |

El [manual A13 v1.2](https://arca.gob.ar/ws/ws-padron-a13/manual-ws-sr-padron-a13-v1.2.pdf) documenta `idProvincia` y `descripcionProvincia` en el domicilio. Se debe verificar respuesta real y permisos con un contexto autorizado durante P2; no se presupone acceso actual ni cobertura para todos los documentos.

Condiciones que debe satisfacer cualquier propuesta posterior de P2:

- Consultar al receptor del comprobante; actualizar la ficha de un cliente solo si su identidad coincide, sin modificar al cliente asociado cuando la factura tenga otro receptor.
- Conservar provincia y procedencia disponibles al emitir; diferenciar el dato consultado hoy para un comprobante histórico. Registrar fuente y fecha; decidir persistencia auxiliar sin alterar snapshots autorizados ni su contenido/hash fiscal.
- Sin documento identificable, ambigüedad o caída de ARCA: «No informada»; la falla no bloquea el archivo ni dispara consultas a otro receptor.
- Reutilizar resultados por identidad dentro del reporte y definir vigencia de caché y límites de consulta antes de habilitar la carga progresiva. Un cambio de resultados geográficos posterior no altera importes ni identidad fiscal.

## Risks / Trade-offs

- [Provincia pendiente] -> Columna prevista con ausencia explícita y tareas P1/P2; el plan no da por implementada ni aprobada la estrategia de padrón.
- [Históricos incompletos o defaults antiguos] -> Conservar cabecera, diferenciar desconocido de cero y advertir discrepancias; no backfill fiscal por inferencia.
- [Límite de filas de Supabase o muchas líneas] -> Cursor estable tanto en cabeceras como en líneas y caso de prueba superior a 1000 comprobantes, con falla explícita antes de entregar un parcial.
- [Tratamientos distintos en detalle simplificado] -> Expandir originales fiscales, distinguir IVA al 21% de exentos/no gravados y evitar duplicar la presentación.
- [Histórico con otra alícuota] -> Conservar totales, señalar el desglose fuera de alcance y no atribuir importes al 21% ni crear columnas de tasas futuras.
- [Varios emisores o clases] -> CUIT por fila, subtotales separados y columna propia para C.
- [Totales calculados en flotantes] -> Centavos, sumas compartidas por serializadores y comprobación resumen/detalle.
- [Ausencia de `autorizada_at` histórica] -> Corte alternativo por creación con advertencia, sin simular precisión temporal inexistente.
- [Consulta progresiva modifica datos al descargar] -> Hipótesis pendiente; ninguna escritura en el contrato inicial. Decidir por separado método/ejecución y autorización si se habilita enriquecimiento.

## Migration Plan

1. Implementar y validar el núcleo sobre tablas y permisos existentes, con fixtures ficticios; no requiere migración de datos ni nuevas credenciales.
2. Habilitar modalidad fiscal y acción propia; comprobar que las descargas generales conservan su contrato.
3. Verificar XLSX/CSV reales generados sobre datos sintéticos, conciliación y permisos; inspeccionar la tabla y el resumen en una planilla.
4. Documentar resultado de P1/P2/P3. Si implican captura, persistencia, llamadas al padrón o nuevos tributos, ampliar y revisar el plan antes de ese trabajo; no escribir manualmente `supabase/schemas/`.
5. Rollback: retirar acción y rama fiscal; las facturas, su autorización y la exportación general permanecen intactas.
