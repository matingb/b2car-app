# Reporte fiscal de ventas

En **Documentos → Reporte fiscal**, revisá desde/hasta y elegí Excel o CSV. El mes sugerido es el actual en Argentina. Podés filtrar por factura/nota, origen (arreglo/venta) y CUIT emisor; inicialmente se incluyen todos. El período usa la fecha del comprobante, con ambos extremos incluidos.

El reporte incluye comprobantes **autorizados del ambiente configurado para facturación**, también FCE, estén pagos o impagos. Se determina en el servidor mediante `ARCA_AMBIENTE`: `PRODUCCION` selecciona producción; cualquier otro valor o su ausencia selecciona homologación, igual que el resto de la facturación. Cada archivo contiene un solo ambiente; se aplica al filtro del reporte y no se muestra en el resumen. El formulario no permite cambiarlo y no lo hereda del listado.

Las notas de crédito llevan importes negativos; las notas de débito y facturas, positivos. Los nombres, documentos e importes provienen de lo que quedó guardado al emitir. Un comprobante asociado de otro período se referencia sin incorporarlo al detalle de ese período.

Los enlaces **CSV** y **Excel** del listado conservan la descarga general con búsqueda, estado y demás filtros aplicados. **Reporte fiscal** abre un formulario independiente: no hereda esos filtros ni la página del listado. En la vista de remitos no se muestran estas descargas fiscales.

Excel contiene **Resumen** y **Comprobantes**, con importes numéricos, encabezado fijo y filtros de columnas. El resumen muestra período, filtros, conteos y subtotales; omite tenant, alcance, moneda, generación/corte, el listado de emisores históricos y el criterio de sumas. **Comprobantes** y el CSV contienen las mismas 24 columnas; se omiten Moneda, Referencia origen, Comprobante asociado, ID comprobante y Estado desglose. Ambos formatos conservan decimales con punto. Para conservar ceros iniciales al importar un CSV, elegí texto para CAE, CUIT, documentos y números de comprobante; Excel ya conserva esos campos como texto. El archivo se llama `reporte-fiscal-ventas-desde_hasta.xlsx` o `.csv`, con las fechas del período.

Se separan bases e IVA al 21%, exentos, no gravados e importe sin IVA de clase C. Los datos desconocidos quedan vacíos y se explican en **Observaciones**; cero representa un valor conocido o no aplicable. Una alícuota histórica fuera del alcance conserva sus totales y se identifica como desglose incompleto. El resumen advierte subtotales parciales y faltantes. **Otros impuestos nacionales informados** ya están contenidos en el total y no deben sumarse otra vez.

El reporte muestra los otros tributos registrados como agregado; no calcula percepciones ni inventa categorías. Provincia se omite porque no hay una fuente guardada verificable, según la decisión del usuario para esta entrega. No se consulta al padrón al descargar.

Sin movimientos se descarga el encabezado completo y, en Excel, un resumen en cero. Si falla una lectura o la generación, se informa el error sin entregar un archivo parcial. El permiso requerido es `facturas:view`, sujeto al rol/plan y a la membresía del tenant activo.
