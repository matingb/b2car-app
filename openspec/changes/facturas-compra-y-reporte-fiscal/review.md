# Revisión de comprobantes recibidos

## Seguimiento del 22 de noviembre de 2026

Quitar el panel de IVA contenido de la factura B del alta de compra y del modal de documentos. Al adjuntar un documento, usar secciones separadas de conceptos y percepciones, con el selector de percepciones del alta de compra. Los conceptos de A tienen alícuota de IVA discriminado y los de B tienen alícuota de IVA incluido. Para B y C se cargan importes finales. C se carga sin selector. Las percepciones llevan importe manual en las tres clases.

La compra con factura B quedaba guardada y la factura fallaba en el segundo paso. El formulario omitía la alícuota que requería PostgreSQL y la función de compatibilidad solo aceptaba tasas de A. El reintento debe guardar el documento sobre la compra ya creada.

Los importes de IVA contenido guardados anteriormente se conservan como dato histórico. La alícuota de una B tampoco se usa para calcular IVA discriminado en el reporte.

**19 de noviembre de 2026 · Cambios solicitados**

Revisé la rama `comprobantes-recibidos` en `a52893ca` contra `origin/dev` local (`e1d46478`), incluidos los cambios sin commit y la migración local de IVA para el alta de compras A. Tomé como contrato vigente los deltas de [comprobantes recibidos](specs/comprobantes-recibidos/spec.md) y [reporte fiscal de compras](specs/reportes-fiscales-compras/spec.md), junto con el [diseño](design.md) y las [tareas](tasks.md). Las búsquedas en Linear por «comprobantes recibidos» y «facturas de compra» no devolvieron issues, y no encontré un `PLAN.md` dedicado en el checkout.

## Hallazgos

### P1 — El reporte puede alterar el total documentado y presentar IVA inferido como confirmado

Al faltar `desgloseIva`, el reporte deriva base e IVA si todos los conceptos tienen alícuota. Para A interpreta esos importes como bases netas y suma el IVA al total, aunque el formulario de carga posterior permite guardar importes finales y quitar el desglose. En un caso sintético con una A cuyo único concepto era de $121 al 21% sin desglose, la exportación calculó $25,41 de IVA, cambió el total a $146,41 y marcó el desglose como completo. El spec exige conservar $121, dejar el IVA vacío y reflejar el faltante en el resumen.

La misma reconstrucción toma una B de $121 y exporta $21 como IVA discriminado. El alta conjunta y el formulario de carga posterior también calculan y guardan ese desglose de B, y el validador exige una tasa por concepto. El escenario de B/C exige conservar el total final y excluir ese IVA de las columnas fiscales discriminadas. Conviene eliminar la reconstrucción de datos ausentes al exportar, separar cualquier IVA contenido informado y cubrir el caso de quitar la última fila de una A que conserva tasas en sus conceptos.

[Cálculo del reporte](../../../src/lib/comprobantesRecibidos/reporteFiscalCalculos.ts#L82) · [Carga posterior](../../../src/app/components/comprobantesRecibidos/ComprobanteRecibidoModal.tsx#L154) · [Alta conjunta](../../../src/app/components/operaciones/useFacturaCompraDraft.ts#L130) · [Validación de líneas](../../../src/lib/comprobantesRecibidos/input.ts#L67) · [Contrato de datos ausentes](specs/reportes-fiscales-compras/spec.md#L116)

### P1 — CSV y XLSX de compras omiten columnas fiscales obligatorias

Ambos formatos comparten un esquema propio que comienza con `Fecha`, `Razón Social`, `Número`, `CUIT` y `Tipo Fac`. En una selección sin percepciones, generaron 17 columnas en el detalle. El spec exige que las primeras 24 tengan los mismos encabezados y orden que ventas. Se pierden campos como CAE, identidad del receptor, base 21% e IVA 21%, incluso cuando el cálculo tiene los valores. Hay un test que consolida los 12 encabezados iniciales del esquema resumido.

Usar `FISCAL_COLUMNS` como prefijo común, mapear el dato manual o el vacío correspondiente y anexar las percepciones dinámicas. Verificar el encabezado completo en ambos formatos, incluida una selección vacía, y conciliar una factura con tasas mixtas.

[Columnas de compras](../../../src/lib/comprobantesRecibidos/reporteFiscalSerializers.ts#L34) · [Contrato de ventas](../../../src/lib/facturacion/reporteFiscal.ts#L61) · [Test vigente](../../../src/lib/comprobantesRecibidos/reporteFiscalSerializers.test.ts#L29) · [Spec del reporte](specs/reportes-fiscales-compras/spec.md#L26)

### P1 — El alta con factura A no permite confirmar los importes del proveedor

El alta muestra base e IVA calculados como texto y guarda directamente el resultado generado desde las líneas operativas. Si sugiere $2.100,00 y el comprobante indica $2.099,99, el usuario no puede registrar ese redondeo al guardar la compra. La edición posterior permite corregir el desglose, así que el alta puede dejar una factura con importes distintos de los informados por el proveedor.

Permitir editar y confirmar base e IVA por tasa antes del guardado documental. Mantener el total operativo calculado con las líneas de compra y avisar si difiere del importe documentado, según D3 y D9.

[Resumen de IVA en el alta](../../../src/app/components/operaciones/OperacionFacturaPercepciones.tsx#L64) · [Payload documental](../../../src/app/components/operaciones/useFacturaCompraDraft.ts#L149) · [Spec de confirmación](specs/comprobantes-recibidos/spec.md#L104) · [Total operativo](design.md#L160)

### P1 — El detalle de compra perdió el acceso a la edición de cargos

El commit `5f90170d` retiró el botón y la instancia de `OperacionCargosModal`. La tarjeta actual solo lista cargos. La API y el modal siguen presentes y el test del modal pasa al montarlo directamente. Desde el detalle de una compra, un usuario autorizado no puede agregar, quitar ni copiar percepciones como cargos, aunque la tarea 7.2 está marcada como completada.

Restituir el acceso condicionado a `operaciones:edit` y probarlo desde el detalle, también para una compra sin cargos. Para la vista previa usar el total operativo menos los cargos anteriores, de modo que la base del editor conserve el IVA operativo de una compra A.

[Tarjeta actual](../../../src/app/%28user%29/operaciones/%5Bid%5D/page.tsx#L602) · [Test aislado del modal](../../../src/app/components/operaciones/OperacionCargosModal.test.tsx#L41) · [Spec de edición](specs/comprobantes-recibidos/spec.md#L253) · [Tarea 7.2](tasks.md#L56)

### P1 — Perder la respuesta del alta puede duplicar compra, movimientos y stock

El reintento documental funciona cuando el navegador ya recibió `created.id`. Si se confirma la compra en la base y se pierde la respuesta, o falla la lectura del detalle posterior a la RPC, el formulario queda en el alta y genera una nueva clave al reenviar. La RPC busca la clave en movimientos de cuenta, así que una compra pendiente sin movimiento tampoco tiene deduplicación aunque el cliente reenvíe la misma clave. Al repetir el alta se puede crear otra compra, registrar otra recepción y repetir pagos iniciales si los había. La unicidad de la factura protege el documento después de esos efectos.

Conservar una clave por intento lógico y resolverla en la transacción de creación de la operación, también para compras sin pago inicial. Probar una respuesta perdida después del commit y comprobar un solo efecto en operación, pagos, stock y documento.

[Clave generada al enviar](../../../src/app/components/operaciones/OperacionFormContext.tsx#L891) · [Recuperación a partir del ID](../../../src/app/components/operaciones/OperacionFormContext.tsx#L938) · [Lectura después de crear](../../../src/app/api/operaciones/operacionesService.ts#L262) · [Búsqueda de idempotencia en SQL](../../../supabase/migrations/20261119130950_compra_factura_a_iva_en_total.sql#L59) · [Spec de reintentos](specs/comprobantes-recibidos/spec.md#L267)

### P2 — El alta usa el total con IVA para validar solo una modalidad de pago

El endpoint calcula el total con IVA y cargos, pero con `pagos[]` valida cada importe positivo y la cuenta sin comparar la suma con ese total. El helper de alta inserta los movimientos, y el trigger marca pagada la operación si el acumulado alcanza o supera el monto. Por inspección del flujo, la compra de $1.240 del ejemplo del spec puede recibir $1.250 de pagos iniciales por API. El circuito de pagos posteriores sí rechaza importes por encima del saldo.

Validar el acumulado en la misma transacción de alta con el total definitivo, para pagos explícitos y pago inicial, y cubrir el límite exacto, un pago parcial y un exceso de un centavo.

[Validación HTTP](../../../src/app/api/operaciones/route.ts#L228) · [Inserción de pagos iniciales](../../../supabase/migrations/20261116120000_operaciones_cargos.sql#L300) · [Trigger de estado de pago](../../../supabase/database/schemas/public/functions/_recalcular_estado_pago_operacion.sql#L8) · [Tope en pagos posteriores](../../../supabase/database/schemas/public/functions/rpc_registrar_pago_operacion.sql#L80)

### P2 — El listado integrado exige también permiso de facturación de ventas

El detalle y la exportación de recibidos tienen permiso propio, pero la navegación a Documentos y `GET /api/documentos` requieren `facturas:view`. Si un rol o plan conserva `comprobantes_recibidos:view` y pierde `facturas:view`, puede consultar un recibido por enlace directo, pero pierde el listado integrado. La configuración inicial de permisos idénticos oculta el problema.

Habilitar el listado con cualquiera de los dos permisos y filtrar las fuentes en el servidor según el permiso efectivo. Probar consulta solo de recibidos, consulta solo de ventas y ausencia de ambos permisos.

[Permisos de rutas](../../../src/lib/permissions.ts#L107) · [Menú](../../../src/app/hooks/useSidebarMenu.tsx#L61) · [Listado HTTP](../../../src/app/api/documentos/route.ts#L6) · [Spec de permisos](specs/comprobantes-recibidos/spec.md#L276)

### P2 — La actualización del esquema depende de qué versión de las migraciones ya se aplicó

`20261116110000` y `20261116120000` cambiaron después de su versión en `b949a004`. Si algún entorno registró esas versiones originales, no se agregarán por esa vía `desglose_iva`, `iva_alicuota_id` ni la RPC de edición de cargos. La nueva migración de IVA también invoca un helper agregado después dentro de la misma versión histórica de cargos. Esto puede romper la consulta documental, el reporte y las compras A con cargos en ese entorno. La migración final está sin seguimiento de Git en el checkout revisado y el servicio ya envía su parámetro nuevo en todas las altas con stock.

Verificar el historial de los entornos de destino. Si aplicaron las versiones anteriores, incorporar migraciones aditivas para preservar datos y cubrir la actualización desde `b949a004`. Incluir y aplicar la migración final junto con el cambio del contrato RPC.

[Columnas del documento](../../../supabase/migrations/20261116110000_comprobantes_recibidos.sql#L89) · [Helper de cargos](../../../supabase/migrations/20261116120000_operaciones_cargos.sql#L73) · [Migración nueva](../../../supabase/migrations/20261119130950_compra_factura_a_iva_en_total.sql#L97) · [Llamada del servicio](../../../src/app/api/operaciones/operacionesService.ts#L227)

## Cobertura y validación

- La inspección de código encontró que cada documento pertenece a una sola operación y que cada operación admite varios documentos. También comprobé que hay unicidad normalizada de factura, bloqueo de borrado en SQL, permisos documentales y retenciones con detalle separado en la exportación. Edición y eliminación documentales operan sobre cabecera y líneas. La evidencia para estos puntos es estática.
- Pasaron 145 tests focalizados en 18 archivos, TypeScript con `--noEmit --incremental false`, ESLint sobre los TS/TSX modificados contra `origin/dev` y `openspec.cmd validate facturas-compra-y-reporte-fiscal --strict`. La prueba en memoria comprobó encabezados CSV/XLSX y los importes de A y B descritos arriba.
- La suite general de Vitest terminó con **2.785 tests aprobados y 11 fallidos** en 5 archivos. Los 7 fallos y 7 errores no manejados en cuentas financieras provienen de un mock que no exporta `TenantContext`. También fallaron las expectativas del argumento `incluirRecibidos` en Documentos y del campo `condicion_iva` en dos tests de Proveedores. El test de descarga fiscal de ventas no consiguió aplicar los filtros de documento, origen ni formato en el modal actualizado, por lo que la comprobación del flujo de descarga quedó fallida. [Cuentas financieras](../../../src/app/%28user%29/cuentas-financieras/%5Bid%5D/page.test.tsx#L35) · [Documentos](../../../src/app/api/documentos/route.test.ts#L39) · [Servicio de proveedores](../../../src/app/api/proveedores/proveedorService.test.ts#L95) · [Ruta de proveedores](../../../src/app/api/proveedores/route.test.ts#L134) · [Descarga fiscal](../../../src/app/components/facturacion/ReporteFiscalModal.test.tsx#L45)
- `git diff --check origin/dev` detectó una línea vacía extra al final de [reporteFiscal.ts](../../../src/lib/comprobantesRecibidos/reporteFiscal.ts#L134).
- Quedaron sin verificar en PostgreSQL y navegador el alta con tasas mixtas y pagos, RLS por rol/plan, reintentos y borrado concurrente, y la exportación con una percepción exclusiva de la última página. Docker rechazó el acceso a su daemon. La suite de integración requiere una base desechable porque su setup ejecuta `TRUNCATE auth.users CASCADE`. No se consultaron entornos remotos.
