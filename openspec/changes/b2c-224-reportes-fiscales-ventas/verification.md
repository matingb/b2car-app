# Verificación de B2C-224

Fecha: 02/11/2026. Checkout base: `dev`, `9f14aae`; cambios locales de esta implementación. Datos completamente sintéticos.

## Actualización del 03/11/2026: ambiente por ARCA_AMBIENTE

- El servicio reutiliza `getFacturacionAmbiente()` y fija el ambiente una sola vez para lectura y resumen XLSX. El cliente no puede seleccionarlo; no se mezclan ambientes.
- 139 tests aprobados en 14 archivos, incluyendo resolución de ambiente, selección aislada de producción/homologación, fallback ante variable ausente o inválida, rechazo de `ambiente` en la solicitud fiscal, alcance XLSX y regresiones de reporte/UI.
- `npx.cmd tsc --noEmit --pretty false`: aprobado. ESLint focalizado sobre exportación, reporte y modal: aprobado.
- Comprobación directa del servicio, repositorio y serialización con Supabase local: `ARCA_AMBIENTE=HOMOLOGACION` genera un XLSX con las dos facturas autorizadas del 03/11/2026; `PRODUCCION` genera cero filas; variable ausente vuelve a homologación y a las dos filas. Se reabrieron los buffers y se verificó el alcance del resumen.
- Las variantes de ambiente se aplicaron únicamente al proceso de diagnóstico. No se editaron variables de entorno ni datos de la base; no hubo emisión ante ARCA ni recorrido de la descarga en navegador. La lectura directa usó un cliente administrativo local; los permisos del endpoint se comprobaron mediante sus tests.

## Resultado inicial (02/11/2026)

- 128 tests aprobados en 13 archivos, con contrato, repositorio mock, servicio inyectado, serialización real CSV/XLSX, endpoint con autorización real sobre proveedores mock y UI de React Testing Library.
- `npx.cmd tsc --noEmit --pretty false`: aprobado.
- ESLint focalizado sobre los archivos TypeScript/TSX afectados: aprobado.
- `git diff --check`: aprobado.
- `openspec.cmd validate b2c-224-reportes-fiscales-ventas --strict`: aprobado.
- Revisión React: hooks estables, formulario con etiquetas y errores accesibles, estado propio sin heredar filtros, componentes Modal/Calendar existentes y tokens del proyecto. Se conserva Emotion por convención del repo.

## Cobertura de requisitos y escenarios

| Requisito | Evidencia |
| --- | --- |
| Universo y filtros fiscales | `facturasReporteRepository.test.ts`: AUTORIZADA y ambiente resuelto por el servidor, tipos y orígenes, límites de fechas, corte y exclusión de autorización posterior. La actualización del 03/11 agrega ambos ambientes en repositorio/servicio/ruta. `reporteFiscal.test.ts`: fechas imposibles/invertidas, desconocidos y filtros operativos incompatibles. No se consultan pagos ni seguimiento manual FCE. |
| Acceso por tenant y permiso | `route.test.ts`: 401, 403 por membresía y permiso efectivo rol/plan, tenant de sesión, intento de indicar otro tenant rechazado. `serverAuth.test.ts`: regresión del permiso existente. Repositorio: tenant explícito y join padre para líneas. |
| Exportación completa y estable | `facturasReporteRepository.test.ts`: 1205 cabeceras con fechas empatadas, servidor que devuelve menos filas que el límite pedido, 1205 líneas de una sola factura, referencias fuera de período/tenant, errores de cabeceras/líneas/asociados y duplicados. Se termina con página vacía. |
| Identidad histórica, CF, FCE y referencias | `reporteFiscalCalculos.test.ts`: receptor alternativo snapshot y CF 99/0, tipo/código FCE, emisor y origen histórico, no mutación de fuentes y nota contra factura anterior sin agregarla al conjunto. |
| Importes y desglose 21% | `reporteFiscalCalculos.test.ts`: conversión decimal exacta y rango seguro, gravado/exento/no gravado, expansión validada de originales y rechazo de estructuras inválidas, sin sumar contenedor. |
| Clase C y signos | Pruebas de C 100 + 50 exento + 20 no gravado; IVA histórico incompatible preservado; C con importe desconocido contado aparte de NO_APLICA_C; todos los importes NC negativos y factura 121 - NC 121 + ND 60,50. |
| Tributos y faltantes | Pruebas de IVA total sin líneas, diferencia de un centavo, tributos sin detalle, nacionales informativos no sumados otra vez, códigos/identidades ausentes, tasa histórica 10,5% sin crear columnas y mezcla con 21%. |
| Resumen conciliado | `reporteFiscalCalculos.test.ts` y `reporteFiscalSerializers.test.ts`: sumas de las mismas filas por CUIT/clase, conteos, faltantes por columna, conjunto totalmente desconocido no presentado como cero completo y período vacío sin emisor inventado. |
| Formatos y ausencia de resultados | `reporteFiscalSerializers.test.ts`: BOM/CRLF, fechas ISO/calendario, comillas/CR/LF, fórmulas como texto, negativos numéricos, ceros iniciales, hojas/tipos/autofiltro/encabezado fijo, equivalencia semántica y 29 columnas estables incluso vacías. Rechazo de importes/subtotales que perderían centavos por precisión de Excel. |
| Generación íntegra y compatibilidad | `facturasReporteService.test.ts`, `route.test.ts`: fallos de lectura/generación/precisión sin archivo parcial, MIME/nombre/no-store, descarga general CSV/XLSX sin cambios. `page.test.tsx`, `FacturasFiltersModal.test.tsx`, `documentos*.test.ts`: filtros, remitos y formulario independiente. |
| Provincia omitida | Contrato, cálculos, serializadores y UI verifican que no hay columna, conteos ni observaciones geográficas. Decisión explícita del usuario registrada en diseño; no consultas al padrón. |

## Archivos sintéticos y límites de la evidencia

El test de volumen genera y **reabre programáticamente** CSV con el lector de ExcelJS y XLSX con `workbook.xlsx.load`, sin usar el Excel real como fixture. El conjunto tiene 1205 comprobantes, NC/ND, FCE, C, 21% con exentos/no gravados y originales simplificados, tasa fuera de alcance, faltantes, tributos, nacionales informativos, autorización histórica sin fecha, discrepancia de un centavo y varios emisores/clases. Verifica conteo completo y conciliación por grupo. Se comprobaron anchos, tipos, ajuste de texto, altura de encabezados/filas, autofiltro y congelado; no se afirma apertura visual en Excel/LibreOffice.

Muestra local ignorada por Git: `.codex-work/reportes/artifacts/reporte-fiscal-sintetico.xlsx` y `.csv`. `verificacion.json` conserva filas, bytes, tiempo de generación/reapertura y resumen conciliado. Última medición: 0,764 segundos y 125.718 bytes de XLSX; es una medición sintética de esta máquina, sin red ni base real.

En la validación inicial del 02/11 no se inició un servidor ni se recorrió la UI en navegador. No se consultó una base real, no se ejecutó el setup de integración, no se emitió ante ARCA y no se inspeccionaron secretos. Esa validación de las consultas usa mocks; no acredita estado de permisos/datos de un entorno desplegado. La comprobación posterior con base local está registrada en la actualización del 03/11. Se recomienda revisar visualmente la muestra y realizar un recorrido con una sesión de pruebas antes de liberar.

## Reproducción y bloqueo previo de JSX

La configuración compartida actual falla al transformar TSX con el Vite/Vitest instalado (`Unexpected JSX expression`) antes de ejecutar los tests. Se verificó con una configuración temporal local de OXC; no se modificó `vitest.config.ts` ni dependencias. El ajuste sigue la [configuración de JSX de Vite](https://vite.dev/config/shared-options#oxc).

Crear `.codex-work/reportes/vitest.config.mts` con:

```ts
import { mergeConfig } from "vitest/config";
import base from "../../vitest.config";
export default mergeConfig(base, {
  esbuild: false,
  oxc: { jsx: { runtime: "automatic", importSource: "@emotion/react" } },
});
```

Ejecutar desde la raíz en PowerShell:

```powershell
$env:FISCAL_ARTIFACT_DIR = Join-Path (Get-Location) '.codex-work/reportes/artifacts'
npm.cmd run test -- --run --config .codex-work/reportes/vitest.config.mts src/lib/facturacion/environment.test.ts src/lib/facturacion/reporteFiscal.test.ts src/lib/facturacion/reporteFiscalCalculos.test.ts src/lib/facturacion/reporteFiscalSerializers.test.ts src/app/api/facturas/export/facturasReporteRepository.test.ts src/app/api/facturas/export/facturasReporteService.test.ts src/app/api/facturas/export/route.test.ts src/app/components/facturacion/ReporteFiscalModal.test.tsx 'src/app/(user)/facturacion/page.test.tsx' src/app/components/facturacion/FacturasFiltersModal.test.tsx src/lib/facturacion/serverAuth.test.ts src/lib/documentos/documentosService.test.ts src/lib/documentos.test.ts src/lib/excel/excelExportBuilder.test.ts --maxWorkers=2
npx.cmd tsc --noEmit --pretty false
npx.cmd eslint 'src/app/api/facturas/export/*.ts' 'src/lib/facturacion/reporteFiscal*.ts' 'src/app/components/facturacion/ReporteFiscalModal*.tsx' 'src/app/(user)/facturacion/page.tsx' 'src/app/(user)/facturacion/page.test.tsx'
git diff --check
openspec.cmd validate b2c-224-reportes-fiscales-ventas --strict
```

## Pendientes de investigación

P1 resuelto para esta entrega: omitir provincia. P2-GEO y P3-TRIBUTOS quedan identificados y evaluados en `design.md`, sin implementación de consultas, persistencia ni tributos nuevos. La respuesta del usuario no valida un catálogo de percepciones. La URL histórica del manual A13 devuelve 404; se documentó el DTO local del SDK como evidencia técnica limitada. Ninguna de estas investigaciones se presenta como funcionalidad implementada.
