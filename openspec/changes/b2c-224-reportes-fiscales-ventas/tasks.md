# Tasks

Las secciones 1 a 5 implementan el núcleo de lectura definido. La sección 6 mantiene las investigaciones solicitadas por el usuario; no autoriza implementar padrón progresivo, persistencia geográfica ni nuevos tributos. Cualquier ampliación resultante requiere actualizar y revisar los artefactos antes de programarla. Ninguna tarea se ha implementado durante la propuesta.

## 1. Contrato y filtros fiscales

- [x] 1.1 Definir tipos del conjunto fiscal, estados de desglose y registro único ordenado de columnas de `design.md`; verificar que ambos formatos y el resultado vacío coinciden y contienen solo el par base/IVA 21% como desglose por alícuota.
- [x] 1.2 Implementar validación de `reporte=fiscal`, formatos, fechas obligatorias e inclusivas, documento, origen y CUIT emisor; verificar errores por fechas imposibles, rango invertido, valores desconocidos y filtros operativos incompatibles, conservando la rama general sin cambios.
- [x] 1.3 Documentar junto al contrato los campos de cabecera, líneas, originales simplificados y transformaciones de clase C; verificar que cada columna tiene fuente, regla de signo y tratamiento de ausencia, sin consultas a pagos ni datos actuales del cliente.

## 2. Repositorio de lectura completa y aislada

- [x] 2.1 Implementar selección de cabeceras por tenant, AUTORIZADA, ambiente resuelto en el servidor con `getFacturacionAmbiente()` desde `ARCA_AMBIENTE`, origen y filtros fiscales, con corte de autorización y cursor `(fecha_comprobante, id)`; verificar ambos ambientes sin mezclarlos, fallback a homologación, más de 1000 comprobantes, empates de fecha y una autorización posterior al corte.
- [x] 2.2 Implementar fallback temporal para autorizados históricos sin `autorizada_at`; verificar inclusión por `created_at` y observación de limitación sin inventar fecha de autorización.
- [x] 2.3 Cargar líneas y cabeceras asociadas por lotes, con aislamiento por tenant y paginación adicional de líneas; verificar una factura/lote con más de 1000 líneas, una nota asociada fuera del período y una referencia de otro tenant sin exposición de datos.
- [x] 2.4 Propagar fallos de cualquier página y detectar duplicación inesperada de IDs; verificar que el servicio no recibe un conjunto truncado como exitoso. Documentar orden, corte y criterio de finalización del recorrido junto al repositorio.

## 3. Agregación fiscal, signos y calidad de datos

- [x] 3.1 Implementar conversión fiscal a centavos y acumulación de base/IVA al 21%, separando exentos y no gravados; verificar precisión y límite numérico seguro, sin desarrollar cálculos ni columnas de otras alícuotas.
- [x] 3.2 Validar y expandir originales guardados de facturas simplificadas, reutilizando la utilidad existente cuando corresponda; verificar conceptos al 21% junto con exentos/no gravados y ausencia de doble suma del contenedor. Usar exclusivamente las líneas de cada NC/ND para sus importes.
- [x] 3.3 Mapear cabeceras C a importe sin IVA propio, conservar exentos/no gravados y marcar NO_APLICA_C; verificar una C por 100 + 50 exento + 20 no gravado y una C histórica con IVA incompatible, sin ocultar ese dato.
- [x] 3.4 Aplicar signo negativo de NC a todos sus importes y conservar factura/ND positivas; verificar NC parcial de un período anterior y factura 121 + NC -121 + ND 60,50 con neto final 60,50.
- [x] 3.5 Construir filas desde snapshots, con emisor, CF 99/0, receptor alternativo, FCE, origen y factura asociada; verificar cambios posteriores del cliente y productos sin cambiar la identidad ni importes históricos exportados.
- [x] 3.6 Implementar diagnóstico de importes/desglose faltantes y diferencias entre fuentes; verificar IVA total sin detalle verificable al 21%, diferencia de un centavo y tributos sin detalle, sin observaciones geográficas. Agregar un histórico con otra alícuota como excepción fuera de alcance: preservar cabecera, identificar la tasa y no trasladar sus importes al 21% ni agregar columnas. Documentar COMPLETO, NO_APLICA_C e INCOMPLETO.
- [x] 3.7 Construir resumen desde las mismas filas, con subtotales por CUIT/clase, conteos y advertencia de subtotales parciales; verificar igualdad exacta de sumas, mezcla de emisores/clases, desglose al 21% incompleto o fuera de alcance, impuestos nacionales informativos y período vacío.

## 4. Serialización CSV y XLSX

- [x] 4.1 Generar CSV con columnas estables, BOM UTF-8, CRLF, fechas ISO y decimales sin formato monetario; verificar comillas, coma, saltos CR/LF, textos que parecen fórmulas, ceros iniciales, valores desconocidos y NC numéricas negativas.
- [x] 4.2 Generar XLSX `Resumen`/`Comprobantes` reutilizando ExcelJS y utilidades compatibles; verificar reabriendo el buffer nombres de hojas, tipo numérico de importes, identificadores textuales, calendario de fechas, filtros y encabezado fijo.
- [x] 4.3 Verificar equivalencia semántica CSV/XLSX sobre el mismo conjunto sintético, incluyendo resumen reproducible, NC, IVA al 21% junto con exentos/no gravados, clase C, históricos fuera de alcance, faltantes y cero registros; documentar el contrato de formatos y los nombres de archivo.

## 5. Endpoint y experiencia de descarga

- [x] 5.1 Integrar la rama fiscal con servicio/repositorio inyectables y autorización existente; verificar 401/403, permiso efectivo rol/plan, aislamiento de tenant, errores de lectura/generación, MIME, nombre de archivo y `private, no-store`, sin llamadas a ARCA ni escrituras.
- [x] 5.2 Agregar acción «Reporte fiscal» y formulario propio con fechas, documento, origen, CUIT emisor y formato, usando Modal/Calendar y tokens existentes; verificar mediante pruebas de UI alcance del ambiente configurado, sin selector de ambiente, mes sugerido GMT-3, validaciones y descarga con filtros explícitos. Identificar el ambiente efectivo en el resumen XLSX.
- [x] 5.3 Verificar regresión de exportaciones generales y vista de remitos con las pruebas existentes de Documentos; documentar para el usuario la diferencia entre descargar el listado y generar el reporte fiscal de período, y el tratamiento de datos faltantes.

## 6. Investigaciones acordadas y cierre de alcance condicionado

- [x] 6.1 Registrar P1 con la indicación del usuario de omitir provincia si no existe una fuente guardada; verificar que diseño, contrato, CSV/XLSX y resultado vacío omiten columna, observaciones y conteos geográficos. Mantener semántica/fuente como investigación futura para una eventual incorporación.
- [x] 6.2 Documentar P2 con evaluación de datos A13, identidad real del receptor, documentos sin identificación, múltiples domicilios, fuente/fecha, caché, deduplicación, límites y errores; verificar que la propuesta distingue provincia actual del cliente, dato al emitir y enriquecimiento posterior, sin realizar consultas reales no autorizadas.
- [x] 6.3 Evaluar opciones de persistencia de P2 respetando snapshots/hash fiscales inmutables y actualización del cliente solo ante coincidencia de identidad; verificar mediante un diseño revisable con impacto en permisos/migraciones. Mantener su implementación pendiente hasta resolver la política.
- [x] 6.4 Resolver P3 solicitando por el canal del usuario los tipos de percepciones que necesita el contador y sus fuentes; verificar registrando catálogo validado o falta de evidencia. No crear detalle ni cálculo de tributos nuevos para dar por terminada esta investigación.
- [x] 6.5 Registrar el destino de P1/P2/P3 antes de cerrar el cambio: resuelto dentro del contrato inicial o investigación diferida identificada; verificar que cualquier ampliación del comportamiento tenga spec/diseño/tareas revisados y que ningún pendiente se marque como implementación completada.

## 7. Verificación integrada

- [x] 7.1 Ejecutar los tests focalizados del contrato, repositorio, servicio, serializadores, ruta y UI, más las regresiones de filtros/exportación; verificar resultados aprobados y distinguir validación unitaria de cualquier prueba con base real.
- [x] 7.2 Generar y abrir archivos sintéticos con todos los casos fiscales y más de 1000 comprobantes; verificar conciliación por CUIT/clase, conteo completo, legibilidad y tiempos de generación, sin utilizar el Excel real como fixture ni emitir ante ARCA.
- [x] 7.3 Ejecutar lint focalizado, comprobación TypeScript y `git diff --check`; verificar que pasan los archivos afectados y documentar cualquier fallo previo ajeno con evidencia.
- [x] 7.4 Ejecutar `openspec.cmd validate b2c-224-reportes-fiscales-ventas --strict` y contrastar requisitos/escenarios con las verificaciones realizadas; verificar trazabilidad y pendientes geográficos/tributarios explícitos antes de recomendar cierre.
