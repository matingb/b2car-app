# Implementation Tasks: Tipo de arreglo (catalogo) y empleado a nivel de detalle

**Change ID:** `detalle-arreglo-tipo-empleado`

---

## Phase 1: Base de datos - aditiva (sin romper nada existente)

- [x] 1.1 Migracion: `CREATE TABLE public.tipos_arreglo` (id, tenant_id default JWT, nombre, activo bool default true, color text NULL, created_at, updated_at) + indices + trigger `updated_at` + RLS `tenant_access` (patron identico a `productos`/`empleados`). Constraint unico `(tenant_id, lower(nombre))`.
- [x] 1.2 Migracion: `ALTER TABLE public.detalle_arreglo ADD COLUMN tipo_arreglo_id uuid NULL REFERENCES tipos_arreglo(id) ON DELETE SET NULL`, `ADD COLUMN empleado_id uuid NULL REFERENCES empleados(id) ON DELETE SET NULL`. Indices `(tenant_id, tipo_arreglo_id)` y `(tenant_id, empleado_id)`.
- [x] 1.2b Migracion: `ALTER TABLE public.operaciones_lineas ADD COLUMN tipo_arreglo_id uuid NULL REFERENCES tipos_arreglo(id) ON DELETE SET NULL`, `ADD COLUMN empleado_id uuid NULL REFERENCES empleados(id) ON DELETE SET NULL`. Mismos indices. Nullable siempre: solo se completan para lineas de operaciones tipo `ASIGNACION_ARREGLO`; el resto (`COMPRA`/`VENTA`/`AJUSTE`) quedan en `NULL`.
- [x] 1.3 Migracion: `ALTER TABLE public.arreglos ADD COLUMN tipos uuid[] NOT NULL DEFAULT '{}'`, `ADD COLUMN empleados uuid[] NOT NULL DEFAULT '{}'`. Indices GIN sobre ambas columnas para filtros por contencion.
- [x] 1.4 Migracion: `ALTER TABLE public.formularios ADD COLUMN tipo_arreglo_id uuid NULL REFERENCES tipos_arreglo(id) ON DELETE SET NULL` (reemplazo del matching por texto).
- [x] 1.5 Funcion + trigger `sync_arreglo_derivados(p_arreglo_id uuid)`: recalcula `tipos`/`empleados` del arreglo agregando (`ARRAY_AGG(DISTINCT ...)`) sobre **ambas** fuentes: `detalle_arreglo` (por `arreglo_id`) y `operaciones_lineas` (via `operaciones_asignacion_arreglo` + `operaciones` con `tipo = 'ASIGNACION_ARREGLO'`). Se invoca desde dos triggers: AFTER INSERT/UPDATE(tipo_arreglo_id, empleado_id)/DELETE en `detalle_arreglo`, y AFTER INSERT/UPDATE(tipo_arreglo_id, empleado_id)/DELETE en `operaciones_lineas` (resolviendo el `arreglo_id` via el join a `operaciones_asignacion_arreglo`).
- [x] 1.6 Actualizar `_insert_detalles_arreglo` (helper del RPC) para aceptar y guardar `tipo_arreglo_id`/`empleado_id` de cada item del array `p_detalles`.
- [x] 1.6b Actualizar `rpc_asignar_repuesto_existente_con_compra`, `rpc_crear_producto_inline_para_arreglo` y `_asignar_repuestos_existentes_a_arreglo` para aceptar `p_tipo_arreglo_id`/`p_empleado_id` (nuevos parametros opcionales al final de la firma, para no romper llamadas existentes) y persistirlos en la fila de `operaciones_lineas` creada.
- [x] 1.7 Backfill (misma migracion o migracion siguiente, ejecutada una sola vez):
  - Sembrar `tipos_arreglo` desde `SELECT DISTINCT tenant_id, tipo FROM arreglos WHERE tipo IS NOT NULL AND trim(tipo) <> ''`.
  - `UPDATE detalle_arreglo SET tipo_arreglo_id = ...` mapeando por `arreglo_id -> arreglos.tipo -> tipos_arreglo.nombre` (mismo tenant).
  - `UPDATE formularios SET tipo_arreglo_id = ...` matcheando `descripcion` (trim/lower) contra `tipos_arreglo.nombre` (mismo tenant).
  - `operaciones_lineas` historicas quedan con `tipo_arreglo_id`/`empleado_id` en `NULL` (no hay dato previo del que migrarlas).
  - Disparar `sync_arreglo_derivados` (o un `UPDATE` agregado equivalente) para poblar `tipos`/`empleados` de todos los arreglos existentes.
- [x] 1.8 Nuevos RPCs de dashboard (reemplazan/extienden `dashboard_tipos_con_ingresos`):
  - `dashboard_facturacion_por_tipo` / `dashboard_facturacion_por_empleado`: suman `detalle_arreglo.cantidad*valor` + `operaciones_lineas.cantidad*monto_unitario`, agrupado por `tipo_arreglo_id`/`empleado_id` (join a `tipos_arreglo`/`empleados`, `COALESCE` -> "Sin tipo"/"Sin empleado").
  - `dashboard_costo_por_tipo`: suma `operaciones_lineas.cantidad * productos.costo_unitario` (join `producto_id`), agrupado por `tipo_arreglo_id`. No incluye sueldo.
  - `dashboard_costo_por_empleado`: suma lo mismo agrupado por `empleado_id`, **mas** el sueldo vigente del empleado en el periodo (misma logica que la CTE `sueldo_mes` de `dashboard_gastos_por_periodo`, pero desagregada por empleado en vez de sumada).

**Quality Gate:**
- [x] `supabase db reset` local corre sin errores con el seed actualizado
- [x] Backfill verificado manualmente (insert directo + trigger) — logica de backfill de produccion no ejercida por el seed local (seed no trae `detalle_arreglo`/`tipo` pre-existente para backfillear)
- [x] No hay suite de tests de integracion en el repo todavia (el cambio `e2e-rpc-integration-tests` sigue en estado Draft) — validado manualmente via psql: `rpc_set_asignacion_arreglo_linea`, `rpc_asignar_repuesto_existente_con_compra` y las 4 RPCs de dashboard nuevas, incluyendo un caso NULL-empleado que revelo y corrigio un bug de join
- [x] Suite unitaria completa (`npm test`) sigue en verde: 436/436 (Phase 1 es solo SQL, no toca TS)

---

## Phase 2: API / capa de datos

- [x] 2.1 `detalleArregloService.ts`: extender `DETALLE_ARREGLO_SELECT`, `DetalleArregloRow`, payload de `create`/`updateById` con `tipo_arreglo_id`/`empleado_id`.
- [x] 2.2 Rutas `detalles/route.ts` (POST) y `detalles/[detalleId]/route.ts` (PUT): aceptar y validar los dos campos nuevos (opcionales, UUID o null). Agregar `statsService.onDataChanged` (hoy solo llaman `syncArregloDescripcion`).
- [x] 2.2b Rutas `repuestos/route.ts` (POST) y `repuestos/[lineaId]/route.ts` (PUT): agregar `tipo_arreglo_id`/`empleado_id` opcionales a `UpsertRepuestoLineaRequest`/`CreateInlineProductoRepuestoRequest`, pasarlos a los RPCs de repuestos, y agregar `statsService.onDataChanged`.
- [x] 2.3 `route.ts` POST `/api/arreglos`: incluir `tipo_arreglo_id`/`empleado_id` en `normalizedDetalles` y en `normalizedRepuestos`/`normalizedRepuestosNuevos` para que viajen a los RPCs correspondientes.
- [x] 2.4 Nuevo modulo `src/app/api/tipos-arreglo/` (service + route GET/POST/PUT/DELETE) con `onDataChanged`, patron identico a `src/app/api/empleados/`.
- [x] 2.5 Nuevo `src/clients/tiposArregloClient.ts`; extender `arreglosClient.ts` (`createDetalle`/`updateDetalle`/`CreateArregloInput.detalles`/`.repuestos`).
- [ ] 2.6 Migrar `buildArregloDescripcion` para armar la descripcion a partir de los tipos usados en los detalles (via join a `tipos_arreglo`), no de `arreglos.tipo`.
- [ ] 2.7 Migrar el selector de tipo del encabezado (`rpc_crear_arreglo_completo` / `_insert_arreglo_base`, `CreateArregloInsertPayload`, `UpdateArregloRequest`, `ArregloListFilters.tipo`) para usar `tipo_arreglo_id` en vez de texto libre. El filtro de listado pasa de `ilike` a `tipos @> ARRAY[p_tipo_id]`.
- [x] 2.8 `arregloRepository`/`arregloService`: reemplazar `tiposConIngresos` por 4 metodos nuevos (`facturacionPorTipo`, `facturacionPorEmpleado`, `costoPorTipo`, `costoPorEmpleado`) que envuelven los RPCs de 1.8.

**Quality Gate:**
- [ ] Tests unitarios de `detalleArregloService`, rutas de detalle/repuestos y `arregloRepository` actualizados y en verde
- [ ] `arreglos.tipo` ya no se lee ni escribe desde ningun archivo de `src/` (grep limpio)

---

## Phase 3: UI

- [x] 3.1 Nuevo `TiposArregloProvider` (modelo: `EmpleadosProvider.tsx`), montado en `(user)/layout.tsx`. Expone `tipos`, `createTipo` (alta rapida), `loadTipos`.
- [ ] 3.2 `ArregloFormFields.tsx`: el selector "Tipo" del encabezado pasa de autocomplete de texto libre a autocomplete acotado al catalogo `tipos_arreglo` (con alta rapida si se escribe un valor nuevo). El matching de formularios custom usa `tipo_arreglo_id` en vez de comparar strings. **DIFERIDO** — depende de 2.6/2.7 (migracion de `arreglos.tipo`), que se deja para una sesion dedicada por el riesgo de tocar el matching de formularios custom existente.
- [x] 3.3 `ServicioLinea` (`ServicioLineasEditableSection.tsx`): agregar `tipoArregloId?`, `empleadoId?` opcionales. Ajustar `Draft`, `validate` (ambos opcionales) y `draftFromItem`.
- [x] 3.3b `RepuestoLinea` (`RepuestoLineasEditableSection.tsx`): agregar `tipoArregloId?`, `empleadoId?` opcionales, simetrico a `ServicioLinea`.
- [x] 3.4 `EditableLineaCard.tsx`: usar el slot `extra` existente para agregar dos `Autocomplete` (Tipo del catalogo con alta rapida, Empleado desde `useEmpleados()`). Reutilizado tanto por servicios como por repuestos, ya que ambas secciones se apoyan en este mismo componente.
- [x] 3.5 Estado compartido de "ultimo usado" (tipo/empleado) a nivel del formulario del arreglo (no dentro de cada hook por separado), consumido tanto por `useServiciosDraft` como por `useRepuestosDraft` al precargar una linea nueva; vacio si es la primera linea cargada en la sesion.
- [x] 3.6 `ReadOnlyLineaCard.tsx` y vistas de detalle (`ArregloDetalleLineasList.tsx`, etc.): mostrar chip de tipo y de empleado por linea, tanto en servicios como en repuestos.
- [x] 3.7 Pagina de edicion `(user)/arreglos/[id]/page.tsx`: `handleAddServicio`/`handleUpdateServicio` y los handlers equivalentes de repuestos pasan los nuevos campos a `createDetalle`/`updateDetalle`/rutas de repuestos.
- [x] 3.8 `ArregloModal.tsx`: mapear los nuevos campos del draft a `detalles[]`/`repuestos[]`/`repuestos_nuevos[]` en el POST de creacion.
- [ ] 3.9 Listado de arreglos (`ArregloItem.tsx`/filtros): chips desde `tipos`/`empleados` (resueltos contra los providers en memoria, sin fetch adicional); el filtro de tipo pasa a ser un select del catalogo.

**Quality Gate:**
- [ ] Flujo manual verificado en navegador (**pendiente** — no se corrio el dev server con sesion autenticada en esta pasada; validado a nivel DB directo via psql y con la suite automatizada)
- [x] Tests de componentes/hooks afectados en verde (440/440, incluye nuevos casos para selectores y "ultimo usado")

---

## Phase 4: Dashboard

- [x] 4.1 `dashboardStatsService.ts`: reemplazar `arregloService.tiposConIngresos` en el `Promise.all` de `getStats()` por las 4 llamadas nuevas (`facturacionPorTipo`, `facturacionPorEmpleado`, `costoPorTipo`, `costoPorEmpleado`); extender el tipo `DashboardStats` (y su duplicado en `DashboardProvider.tsx`) quitando `arreglos.tipos` (el viejo shape) y agregando los 4 nuevos datasets.
- [x] 4.2 Nuevo componente generico `src/app/components/graficos/DesglosePieChart.tsx` (recharts `PieChart` parametrizable por titulo/dataset/paleta), reemplazando la necesidad de 4 componentes casi identicos. `CantidadTiposArreglos.tsx` se elimina (queda reemplazado por instancias de este componente generico).
- [x] 4.3 `(user)/dashboard/page.tsx`:
  - Eliminar el `mainPanel` fijo (las dos mitades "Arreglos | Tipos" y "Arreglos | Estado de pago" que hoy se muestran siempre, sin importar la tarjeta activa).
  - Dentro del `DashboardExpandablePanel` de la tarjeta **"Facturacion"**: agregar, junto a `GraficoIngresos`, dos instancias de `DesglosePieChart` — "Facturacion por tipo" y "Facturacion por empleado".
  - Dentro del `DashboardExpandablePanel` de la tarjeta **"Gastos"**: agregar, junto a `GraficoGastos`, dos instancias de `DesglosePieChart` — "Costo por tipo" y "Costo por empleado".
  - Reubicar `EstadoCobroArreglos` dentro del panel de la tarjeta **"Arreglos"** (unica ubicacion con sentido tematico tras eliminar el panel fijo).
- [x] 4.4 `onDataChanged` se dispara desde las rutas de detalle y de repuestos (Phase 2.2/2.2b) para invalidar la cache de 1h del dashboard.

**Quality Gate:**
- [ ] Dashboard muestra los 4 desgloses nuevos (facturacion x2, costo x2) con datos reales del entorno local, dentro de sus paneles respectivos
- [ ] El panel fijo inferior ya no aparece; `EstadoCobroArreglos` sigue siendo visible en algun lugar del dashboard
- [ ] Cache se invalida al crear/editar/borrar una linea de detalle o de repuesto (verificado manualmente o con test)

---

## Phase 5: Limpieza final - drop de `arreglos.tipo`

> Fase separada y explicita por ser una operacion destructiva y dificil de revertir. Ejecutar **solo** despues de confirmar que Phases 1-4 estan en produccion, estables, y que ningun codigo activo lee o escribe `arreglos.tipo`.

- [ ] 5.1 Grep final en todo `src/` y `supabase/` confirmando cero referencias a `arreglos.tipo` fuera de migraciones historicas
- [ ] 5.2 Migracion: `ALTER TABLE public.arreglos DROP COLUMN tipo`
- [ ] 5.3 Actualizar `Arreglo` (model/types.ts), `CreateArregloInsertPayload`, `UpdateArregloRequest`, `ArregloListPageRow` y cualquier `select("*")` que dependiera implicitamente de la columna
- [ ] 5.4 Verificar que `rpc_crear_arreglo_completo` ya no recibe `p_tipo` (o lo recibe solo como alias legacy si se decide mantener compatibilidad de firma por un tiempo)

**Quality Gate:**
- [ ] Suite completa de tests (unit + integration) en verde tras el drop
- [ ] Confirmacion explicita del usuario antes de aplicar esta migracion en produccion

---

## Completion Checklist

- [ ] All phases complete
- [ ] All quality gates passed
- [ ] `arreglos.tipo` eliminado y todo su uso migrado al catalogo
- [ ] Dashboard con desglose por tipo (detalle) y por empleado
- [ ] Documentacion/README actualizado si aplica
- [ ] Ready for `/openspec-archive`
