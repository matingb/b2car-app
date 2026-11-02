# Verificación de la revisión de producción

Fecha: 2026-11-02. Se modificaron las cuatro migraciones todavía pendientes del 01/11; no se aplicó ningún cambio a producción. Se usó CLI, sin MCP.

## Decisiones implementadas

- RPCs de escritura `SECURITY DEFINER`, permisos explícitos de la acción y validaciones de tenant/taller/referencias. `authenticated` conserva lectura con RLS, sin escritura directa sobre documentos, hijas, OMC, OMS ni ledgers. Los helpers internos no tienen EXECUTE público.
- Compras y ventas aceptan contraparte nula y exigen su hija. Las contrapartes informadas deben pertenecer al tenant.
- Una OMC de signo normal por documento histórico pagado sin asiento, más un AJUSTE_FINANCIERO neto por tenant en la favorita activa o primera activa. Sin marca persistente, sin alterar estadísticas comerciales ni saldo inicial de cuentas.
- Reconstrucción de reversas de ediciones financieras históricas, emparejamiento individual de pagos y protección del gasto con un único pago parcial.
- DROP del helper de kardex con su firma real de 14 argumentos; eliminación exclusivamente de asignaciones huérfanas completamente vacías; validación retroactiva de documentos.
- Bloqueo del stock antes de agregar reservas. NC con cancelación de unidades pendientes independiente de la devolución física, también sin filas de devolución y con factura simplificada. La reserva y la UI limitan las devoluciones a unidades entregadas, antes de solicitar autorización fiscal.
- La compra automática desde un arreglo reutiliza un helper privado: el operativo no necesita obtener `operaciones:edit` para mantener su permiso de comprar repuestos.

## Copia anonimizada de producción

Se exportaron por SELECT las tablas involucradas y sus referencias, con nombres y datos personales sustituidos/omitidos y únicamente IDs de Auth. La copia conserva IDs, importes, fechas y relaciones relevantes; no incluye credenciales, certificados ni sesiones. Se cargó en el esquema local `20261017100000`, con triggers deshabilitados exclusivamente durante la carga local, y se aplicaron las 23 migraciones intermedias más las cuatro del rediseño.

Resultados:

- 359 documentos regularizados: 348 compras y 11 ventas. Una OMC por documento, por el total y con su signo correcto.
- 4 ajustes compensatorios. Efecto financiero conjunto de la regularización: cero.
- 38 cuentas: saldo idéntico antes/después y consistente con su ledger.
- 1.432 stocks: cantidad física idéntica antes/después.
- Diagnóstico: cero filas; todas las hijas, referencias y operaciones instantáneas válidas. Cero diferencias en pagos derivados, cantidades cumplidas y reservas.
- Gasto histórico con nueve asientos: edición posterior y anulación correctas, verificadas con rollback.
- Se conserva el historial de 92 asientos sin operación/OMC, de importe neto cero por cuenta. Son anteriores al rediseño; no se inventan documentos para ellos.
- La única asignación sin hija ni líneas se elimina. Las compras sin proveedor y las ventas sin cliente permanecen válidas.

La copia es de las tablas del dominio y referencias necesarias, no una restauración completa de todos los servicios de Supabase. No se ensayaron Auth/Storage externos ni se enviaron comprobantes a ARCA.

## Validación del código

- Integración completa: **205 tests, 31 archivos, todos pasan**.
- Pruebas focalizadas de facturación y presentación: **63 tests, todos pasan**, usando un config local con `oxc.jsx.runtime = "automatic"` e `importSource = "@emotion/react"` por la incompatibilidad del config existente con Vite 8.
- Suite unitaria completa con ese config: **2.498 pasan; 9 fallan** en cuatro archivos fuera de los modificados: `AppClientLayout.test.tsx`, `ClienteVentasTab.test.tsx`, `TurnoFormFields.test.tsx` y `productosExportService.test.ts`. No se modificaron esas áreas para resolver sus fallas.
- TypeScript y build de producción: pasan. El build genera las 59 páginas previstas.
- ESLint de todos los archivos modificados: pasa. Lint global: 2.614 errores y 61.810 warnings, mayormente en fuentes/artefactos ajenos al cambio; no queda verde a nivel repositorio.
- OpenSpec: validación estricta pasa.
- Advisors de seguridad: se fijó el search_path del trigger nuevo de OMS. Quedan siete funciones anteriores con search_path mutable y una policy permisiva de `representantes`, fuera del alcance de este cambio.

Los scripts reproducibles están en `supabase/tests/rediseno-operaciones-ledgers/`. Los dumps anonimizados y logs de trabajo permanecen en `.codex-work/`, fuera de Git. Los cambios previos en `package-lock.json` y la configuración local se conservaron.

## Despliegue

1. Tomar el backup/snapshot habitual y frenar escrituras mientras se aplica la cadena. La copia verificada representa el corte auditado; si entran nuevos datos, repetir el ensayo/diagnóstico sobre el nuevo corte.
2. Aplicar en orden todas las migraciones pendientes, con A en una transacción separada antes de B por los valores nuevos del enum. No ejecutar fragmentos de B fuera de su transacción: utiliza tablas temporales ON COMMIT DROP.
3. Ejecutar `diagnostico.sql` y comparar saldos/cantidades con el snapshot previo. Publicar el código compatible con los nuevos tipos y contratos en la misma ventana.
4. Comprobar los flujos habituales en la UI y regenerar `supabase/schemas/` con el flujo del equipo. No se editaron esos archivos a mano.

No se amplió el tratamiento del kardex parcial de instalaciones intermedias: la producción auditada no tiene kardex previo. El ensayo real partió de esa condición. Una instalación que ya tenga kardex/entregas parciales anteriores necesita su propio ensayo.
