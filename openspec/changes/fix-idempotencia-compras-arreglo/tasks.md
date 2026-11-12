# Tasks

## 1. Derivación de claves y regresiones

- [ ] 1.1 Preparar una base local descartable con autorización para el reset del setup de integración; verificar que `DATABASE_URL` y `testClient` apuntan al mismo destino y que las migraciones necesarias están aplicadas. Registrar destino sin credenciales y resultado de conectividad antes de ejecutar pruebas.
- [ ] 1.2 Agregar en `src/tests/integration/arreglos/crearArregloRepuestos.integration.test.ts` las regresiones de dos faltantes con costo y de compra más cobro inicial (parametrizar uno y dos faltantes). Reproducir el fallo previo y comprobar, tras el fix, compras por el faltante exacto, asignaciones completas, claves distintas, débito total y cobro por `precio_final` con clave original.
- [ ] 1.3 Crear una migración con el CLI que reemplace solo `_asignar_repuestos_existentes_a_arreglo(uuid, uuid, jsonb, uuid, uuid)`: enumerar con posición original, normalizar `stock_id` y transmitir `md5(format('arreglo-compra:v1:%s:%s:%s', clave_raiz, stock_id, posicion))::uuid`, conservando `NULL` si no hay raíz. Verificar el diff, firma, defaults y permisos, aplicar en la base descartable y hacer pasar las regresiones de 1.2; no editar schemas declarativos.
- [ ] 1.4 Agregar `supabase/tests/arreglo_compras_idempotencia.sql` con fixtures aislados y rollback para verificar claves persistidas, estabilidad con la misma entrada, separación al cambiar raíz/stock/posición, posiciones repetidas del mismo stock y llamada directa sin raíz. Ejecutar con `psql -v ON_ERROR_STOP=1` en la base descartable y verificar que no deja datos persistidos ni expone helpers privados.
- [ ] 1.5 Agregar casos de compra con costo seguida de compra a costo cero, combinación de stock suficiente e insuficiente y ausencia de compras cuando todo tiene stock. Verificar cantidades y que solo los costos positivos generan débitos; ejecutar la suite de creación.
- [ ] 1.6 Agregar una regresión con compra válida en el primer repuesto y faltante sin `precio_compra` en el segundo. Verificar que falla dentro del RPC y no persisten arreglo, documentos, pagos, movimientos ni asientos del intento; comprobar stocks y saldo sin cambios.

## 2. Verificación integrada y entrega

- [ ] 2.1 Ejecutar las suites relacionadas de creación de arreglos, asignación, costo cero, activación de presupuestos y cobro, además del fixture SQL, en la base descartable; registrar comandos y resultados reales, diferenciando errores de entorno de fallas del fix.
- [x] 2.2 Ejecutar `git diff --check` y `openspec.cmd validate fix-idempotencia-compras-arreglo --strict`; revisar que el cambio de producción queda limitado a la migración del helper y documentar resultados y limitaciones. Entregar migración y pruebas sin aplicar cambios a una base remota.
