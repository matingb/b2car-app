---
id: descubrimiento-finanzas-facturacion
module: finanzas-facturacion
status: PARTIAL
observed_at: 2026-10-13
version: pending (checkout; commit not captured)
environment: code-only; no test browser/session verified
role: pending
plan: pending
tenant: pending
sources:
  - src/model/finanzas.ts
  - src/clients/finanzasClient.ts
  - src/lib/facturacion/*
  - src/lib/documentos.ts
  - docs/fce-pdf.md
  - supabase/schemas/public/tables/cuentas_financieras.sql
  - supabase/schemas/public/tables/movimientos_financieros.sql
  - supabase/schemas/public/tables/facturas_electronicas.sql
---
# Descubrimiento funcional: finanzas y facturación

## Alcance y calidad de evidencia
Inspección estática de fuentes y documentación del checkout, no recorrido de interfaz. El repo incluye trabajo concurrente/desarrollado y el hash/version exactos no quedaron registrados. No se verificó URL, entorno, rol, plan, tenant, permisos en ejecución ni persistencia con datos sintéticos. Por ello los recorridos y efectos UI quedan UNKNOWN; PARTIAL indica capacidades corroboradas en código, no verificación funcional end-to-end. No se emitió ningún comprobante.

## Finanzas — PARTIAL (contrato/código)
`src/model/finanzas.ts` define cuentas EFECTIVO, CUENTA_BANCARIA, BILLETERA_DIGITAL, TARJETA_CREDITO; movimientos explícitos GASTO/INGRESO/TRANSFERENCIA/APERTURA_CUENTA y categorías de gastos. Distingue MovimientoCuenta (evento de negocio) de MovimientoFinanciero (ledger derivado descrito como inmutable). `src/clients/finanzasClient.ts` expone operaciones de listado/alta/actualización/baja de cuentas, movimientos, transferencias, ingresos manuales y gastos. Añade claves de idempotencia a altas/modificaciones y DELETE. Los errores HTTP/API y de red se devuelven como `{data:null,error}` y se registran mediante logger.

Persistencia candidata identificada en el schema: cuentas_financieras, movimientos_financieros y operaciones relacionadas; definición completa de columnas, restricciones, RLS/policies, RPC, validaciones de rutas/componentes no cotejadas en esta ficha. No inferir permisos o reversibilidad desde el cliente. Paso a paso UI, campos requeridos, validaciones y transiciones visibles: UNKNOWN (no entorno browser).

## Facturación/ARCA y documentos — PARTIAL (contrato documental/código)
Existen `src/lib/facturacion/` (gateway ARCA, credenciales, ambiente, payload, servicio, idempotencia, PDF fiscal), `src/lib/arca/`, `src/lib/documentos/` y modelo/persistencia de facturas electrónicas, líneas, configuración por tenant/ambiente e intentos/leases/idempotencia.

`docs/fce-pdf.md` documenta la representación PDF FCE MiPyME, revisión normativa fechada 09/10/2026, uso de snapshots, configuración para IIBB, domicilio como campo de texto, conservación de CAE/QR y límites explícitos (p.ej., relación a remitos no disponible en el alcance descrito allí). También documenta generación de muestra PDF ficticia y pruebas, pero no se reejecutaron en este relevamiento. Es documentación de implementación, no regla de negocio aprobada por sí sola.

No se invocó ARCA ni se intentó emitir. No se verificaron ambiente habilitado, permisos, credenciales, pasos de emisión, respuesta/errores reales ni persistencia end-to-end. Emisión real prohibida por la tarea; estas afirmaciones quedan UNKNOWN hasta pruebas controladas sin autorizar comprobantes fiscales reales.

## Reglas aprobadas / tickets / permisos
No se identificó en la exploración limitada una fuente explícita de decisiones aprobadas ni tickets asociados; no se afirma que no existan. La skill pide buscar tickets/decisiones antes de explorar: este aspecto quedó pendiente. La única documentación previa inspeccionada fue `docs/fce-pdf.md` y no equivale a aprobación funcional. Roles/planes/tenant y controles de autorización: UNKNOWN.

## Restricciones, dudas y áreas sin explorar
- Sin navegador de pruebas y contexto (versión, rol, plan, tenant), no puede clasificarse ningún flujo UX como IMPLEMENTED.
- Confirmar rutas API/componentes concretos, permisos, validaciones, estados, errores y efectos en base con tenant sintético aislado.
- Leer esquema actual de tablas/funciones/policies y contrastarlo con endpoints y UI; inspección exhaustiva pendiente.
- Localizar tickets y decisiones humanas aprobadas antes de elevar observaciones a reglas.
- Confirmar qué ambientes ARCA son sandbox/prueba y validar sin emisión fiscal real; no almacenar secretos en la ficha.
- Verificar cambios concurrentes/commit exacto y actualizar fecha/versión cuando haya prueba.

## Evidencias
Fuentes listadas en frontmatter. Observación: listados del checkout confirmaron `src/clients/finanzasClient.ts`, `src/model/finanzas.ts`, módulos `src/lib/facturacion` y esquemas financieros/facturación en `supabase/schemas/public/tables/`. No se adjuntan capturas: no hubo sesión de prueba.

## Próxima verificación
Retomar cuando exista acceso confirmado al entorno de pruebas con versión/commit, rol, plan y tenant sintético; primero buscar tickets/decisiones, después recorrer en UI operaciones no fiscales y contrastar código/schema. Mantener emisión ARCA deshabilitada.
