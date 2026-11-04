# Contrato del reporte fiscal de ventas

`reporteFiscal.ts` define el orden único de las 24 columnas de CSV y XLSX, incluso sin resultados. Los importes se conservan como centavos enteros seguros hasta serializar; `null` es desconocido y se exporta vacío. Cero significa un dato conocido o no aplicable. No se consultan pagos, stock, productos actuales ni fichas actuales de clientes. Provincia se omite por ausencia de fuente guardada, según indicación del usuario; no genera observaciones ni conteos geográficos.

El servicio construye `FiscalScope` con los filtros validados y el ambiente resuelto una sola vez mediante `getFacturacionAmbiente()` en el servidor: `ARCA_AMBIENTE=PRODUCCION` selecciona producción y cualquier otro valor o ausencia selecciona homologación. El repositorio filtra ese ambiente; el resumen XLSX no lo expone. `ambiente` no es un filtro aceptado en la solicitud fiscal ni se hereda del listado. Los formatos comparten 24 columnas y no mezclan ambientes. El resumen conserva período, filtros, conteos y subtotales; omite tenant, alcance, moneda, generación/corte, el listado de emisores históricos y el criterio de sumas.

| Columnas | Fuente histórica | Ausencia |
| --- | --- | --- |
| Fecha, número, tipo, código ARCA, CAE, vencimiento | Cabecera `fecha_comprobante`, `punto_venta`/`numero_comprobante`, `documento_tipo`/`clase_comprobante`/`tipo_comprobante`, `cae`, `cae_vencimiento` | Texto vacío y observación; nunca completar desde otra operación. Los códigos FCE conservan su marca propia. |
| CUIT emisor | `emisor_snapshot.cuit` | Vacío y observación. La razón social del snapshot no se exporta. |
| Receptor, documento tipo/número, condición IVA | `receptor_snapshot.nombre`, `tipoDocumento`, `numeroDocumento`, `condicionIvaReceptorId` | Vacío o código con etiqueta desconocida y observación. 99/0 se preserva como consumidor final. |
| Neto gravado / sin IVA C | `importe_neto_gravado`: para C va exclusivamente a `sinIvaC`, el otro campo vale cero | Vacío si falta su fuente. |
| Exento / no gravado | `importe_exento`, `importe_no_gravado` | Vacío si no es verificable. |
| Base 21% / IVA 21% | Líneas fiscales GRAVADO, ID 5 y tasa 21, `importe_neto`/`importe_iva` | Vacío si no hay detalle verificable; cero si el detalle permite verificar que no hay 21%. |
| Total base imponible | Base 21% solo con desglose completo dentro del alcance | Vacío si falta detalle o hay otra tasa. C: cero por no aplicación. |
| IVA total, tributos, impuestos nacionales, total | `importe_iva`, `importe_tributos`, `otros_impuestos_nacionales`, `total` | Vacío y observación. Los nacionales son informativos: no se vuelven a sumar. Tributos no nulos: detalle no disponible. |
| Origen | `origen_tipo` | Vacío y observación. No determina la identidad del receptor. |
| Referencia origen, comprobante asociado, ID comprobante | `arreglo_id`, `operacion_id`, `documento_asociado_id` e `id` | No se exportan; las referencias se conservan para las validaciones internas y no agregan comprobantes asociados al período. |
| Estado de desglose | Diagnóstico de líneas y cabecera | No se exporta como columna; se usa para calcular calidad y subtotales parciales. |
| Observaciones | Diagnóstico de la reconstrucción | Explica faltantes y discrepancias fiscales. |
| Moneda | `moneda` | No se exporta como columna. |

Las líneas se leen de `facturas_electronicas_lineas`, sin fiscalizar nuevamente. Para facturas simplificadas se valida `snapshot.lineasOriginales` (campos camelCase `tratamientoIva`, `ivaAlicuotaId`, `ivaAlicuota`, `importeNeto`, `importeIva`, `importeTotal`) antes de expandir con `expandirLineasOriginales`; reemplazan al contenedor. Una estructura inválida se informa como desconocida, sin recurrir al agregado de presentación. Las NC/ND siempre usan sus propias líneas.

Todas las columnas monetarias llevan signo negativo en NC y positivo en factura/ND. Se aplica después de la conciliación en centavos y no se modifica la base. Se contrastan base/IVA 21% y exentos/no gravados con cabecera, y componentes de cabecera con total. Una diferencia de un centavo se informa sin ajustar fuentes.

`COMPLETO`: detalle y cabecera verificables y conciliados dentro del alcance. `NO_APLICA_C`: clase C, bases 21%/IVA 21%/base total cero, neto en columna propia; conserva y advierte IVA histórico incompatible. `INCOMPLETO`: faltantes o discrepancias fiscales, incluyendo tasas fuera del alcance. Para estas últimas se conserva lo verificable al 21%, no se crea otra columna, y base total queda vacía. Tributos agregados sin detalle se observan por separado.

CSV: BOM UTF-8, coma, CRLF, fechas ISO calendario, decimales con punto sin símbolo ni miles. Los textos que comienzan como fórmulas (incluyendo espacios/control inicial) llevan apóstrofo de protección; no se generan fórmulas para conservar identificadores. Un lector debe importar las columnas identificadoras como texto para conservar ceros iniciales: XLSX ya las entrega como celdas de texto. XLSX: `Resumen` y `Comprobantes`, valores numéricos para importes, fechas calendario DD/MM/AAAA, autofiltro y encabezado fijo. La hoja `Comprobantes` y el CSV comparten las mismas 24 columnas; el CSV no intercala resumen. Archivo: `reporte-fiscal-ventas-AAAA-MM-DD_AAAA-MM-DD.csv|xlsx`.

El resumen suma exclusivamente las filas, agrupa CUIT/clase y cuenta faltantes por columna. Si todo es desconocido el subtotal queda vacío, con cantidad faltante; las columnas de desglose también se advierten como parciales ante tasas fuera del alcance. Un período vacío tiene cantidad y montos cero, sin inventar emisores.

El XLSX rechaza importes o acumulados que excedan los [15 dígitos significativos de Excel](https://support.microsoft.com/es-es/excel/excel-specifications-and-limits), sin convertirlos a texto ni perder centavos; el servicio devuelve error sin archivo parcial. CSV conserva el decimal exacto dentro del rango seguro de centavos. El límite incluye los subtotales además de cada fila.
