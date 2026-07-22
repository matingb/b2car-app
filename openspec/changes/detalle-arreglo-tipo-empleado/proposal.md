# Proposal: Tipo de arreglo (catalogo) y empleado a nivel de detalle de arreglo

**Change ID:** `detalle-arreglo-tipo-empleado`
**Created:** 2026-07-19
**Status:** Draft

---

## Problem Statement

- Hoy `arreglos.tipo` es un campo de texto libre a nivel de **arreglo general** (autocomplete con `allowCustomValue`). No existe forma de saber que empleado hizo cada linea de trabajo (`detalle_arreglo`), ni de asignar un tipo distinto por linea (ej: un arreglo "Mecanica" que incluye una linea de "Electricidad" hecha por otro empleado).
- Esto impide un desglose de estadisticas mas fino: hoy el dashboard solo puede agrupar ingresos por el `tipo` string del arreglo completo, y no existe ningun agregado por empleado.
- No existe ninguna tabla de empleados vinculada a arreglos: la tabla `empleados` (modulo de personal) es completamente independiente.
- El `tipo` libre ademas cumple una segunda funcion hoy: cuando el texto escrito coincide con `formularios.descripcion`, dispara un formulario dinamico custom en el alta del arreglo (`ArregloFormFields.tsx`). Cualquier cambio debe preservar esa funcionalidad.

## Proposed Solution

1. **Catalogo `tipos_arreglo`** (nueva tabla, scope por tenant) que reemplaza por completo el texto libre `arreglos.tipo`.
2. **`detalle_arreglo`** (lineas de mano de obra) gana dos columnas nullable: `tipo_arreglo_id` (FK a `tipos_arreglo`) y `empleado_id` (FK a `empleados`). La verdad de "que tipo/empleado hizo esta linea" vive aqui.
3. **`operaciones_lineas`** (lineas de repuestos asignados a un arreglo) gana las **mismas** dos columnas nullable `tipo_arreglo_id`/`empleado_id`, simetrico a `detalle_arreglo`. Un repuesto asignado tambien queda atribuido a un tipo y a un empleado.
4. **`arreglos`** gana dos columnas derivadas **materializadas** `tipos uuid[]` y `empleados uuid[]`: el conjunto unico de ids usados tanto en los detalles (mano de obra) como en los repuestos asignados del arreglo. Se leen sin joins; se escriben via trigger cuando cambian esos datos. Reemplazan funcionalmente al viejo `tipo` para listar/filtrar arreglos.
5. **`arreglos.tipo` (texto libre) se elimina.** Se migra el dato existente al catalogo (`tipos_arreglo`, sembrado desde los valores distintos de `arreglos.tipo`) y se backfillea `detalle_arreglo.tipo_arreglo_id` mapeando cada detalle al tipo de su arreglo padre.
6. **Formularios custom**: el matching hoy es por texto (`formulario.descripcion` == `arreglos.tipo` escrito). Se agrega `formularios.tipo_arreglo_id` (FK) y el selector de "tipo" en el alta de arreglo pasa a elegir un `tipo_arreglo_id` del catalogo (no texto libre). Backfill: matchear `formularios.descripcion` contra el nombre del tipo sembrado.
7. **Default al agregar una linea nueva** (detalle o repuesto): hereda el **ultimo tipo/empleado usado** en la sesion de edicion (no el primer detalle ni un "principal" fijo del arreglo). Se puede cambiar individualmente por linea. El "ultimo usado" se comparte entre lineas de mano de obra y de repuestos dentro de la misma sesion de edicion del arreglo.
8. **Dashboard**: se reorganiza en dos ejes en vez de uno solo ("tipos con ingresos"):
   - **Facturacion** (dentro del panel "Facturacion"): dos gráficos de torta nuevos, "Facturacion por tipo" y "Facturacion por empleado", sumando lo facturado en mano de obra (`detalle_arreglo`) + repuestos (`operaciones_lineas`), agrupado por `tipo_arreglo_id`/`empleado_id`.
   - **Costo** (dentro del panel "Gastos"): dos gráficos de torta nuevos, "Costo por tipo" y "Costo por empleado". "Costo por tipo" suma solo el costo de repuestos (`productos.costo_unitario`) agrupado por tipo — el sueldo no tiene dimension tipo y no se prorratea. "Costo por empleado" suma el costo de repuestos atribuidos a ese empleado **mas** su sueldo del periodo (via `empleado_salarios`, ya calculado hoy en `dashboard_gastos_por_periodo` pero sin desagregar por empleado).
   - Los graficos `CantidadTiposArreglos` (tipos) y `EstadoCobroArreglos` (estado de pago) se **sacan** del panel inferior fijo (`mainPanel`) que hoy se muestra siempre debajo de las 4 tarjetas; ese panel fijo desaparece. `EstadoCobroArreglos` se reubica dentro del panel "Arreglos" (unica ubicacion natural restante) — **a confirmar con el usuario**, ver Architecture Considerations.

## Scope

### In Scope

- Tabla `tipos_arreglo` (catalogo, tenant-scoped) + CRUD basico (crear al vuelo desde el selector + gestion simple).
- Columnas `tipo_arreglo_id`, `empleado_id` en `detalle_arreglo` **y en** `operaciones_lineas` (nullable en ambas).
- Columnas derivadas `tipos uuid[]`, `empleados uuid[]` en `arreglos`, mantenidas por trigger, alimentadas desde ambas tablas.
- Eliminacion de `arreglos.tipo` (texto libre) y migracion completa de sus usos:
  - `rpc_crear_arreglo_completo` / helpers (`_insert_arreglo_base`, `_insert_detalles_arreglo`)
  - `rpc_asignar_repuesto_existente_con_compra`, `rpc_crear_producto_inline_para_arreglo`, `_asignar_repuestos_existentes_a_arreglo` (repuestos)
  - Filtro de tipo en el listado de arreglos (pasa de `ilike` sobre texto a filtro exacto por `tipo_arreglo_id` via `tipos`)
  - `buildArregloDescripcion` (arma la descripcion del arreglo a partir de los tipos de sus detalles)
  - Matching de formularios custom (via `formularios.tipo_arreglo_id`, no texto)
- Backfill de datos existentes (tipos, `tipo_arreglo_id` en detalles, `formularios.tipo_arreglo_id`, derivados iniciales). Los repuestos historicos quedan sin tipo/empleado (no hay dato previo del que migrarlos).
- UI: selector de Tipo (catalogo, con alta rapida) y de Empleado, tanto en lineas de mano de obra (`ServicioLineasEditableSection`) como en lineas de repuestos (`RepuestoLineasEditableSection`), con default = ultimo usado compartido entre ambas. Selector de Tipo a nivel encabezado de arreglo (reemplaza el actual) para disparar formularios custom y como default de la primera linea.
- Dashboard: cuatro nuevos desgloses en gráfico de torta — Facturacion por tipo, Facturacion por empleado (panel "Facturacion"), Costo por tipo, Costo por empleado (panel "Gastos") — y remocion del panel fijo inferior (`CantidadTiposArreglos` + `EstadoCobroArreglos`).
- Tests unitarios de servicios/repositorios/hooks afectados.

### Out of Scope

- Pagina de administracion dedicada para el catalogo `tipos_arreglo` (se resuelve con alta rapida + modal simple; una pantalla de configuracion completa queda para una iteracion futura).
- Reasignar `empleados` a un taller distinto del arreglo, o validar que el empleado pertenezca al mismo `taller_id` que el arreglo (se puede agregar despues si se pide).
- Prorrateo de sueldo entre tipos (decidido explicitamente: "Costo por tipo" no incluye sueldo, solo repuestos).
- Historizar cambios de tipo/empleado por linea (no hay auditoria de "quien lo cambio y cuando").
- Atribuir tipo/empleado a las lineas de `VENTA`/`COMPRA`/`AJUSTE` de `operaciones_lineas` (las columnas nuevas solo se completan para lineas de asignacion a arreglo).

## Impact Analysis

| Component | Change Required | Details |
|-----------|-----------------|---------|
| Database | Si | Nueva tabla `tipos_arreglo`; nuevas columnas en `detalle_arreglo`, `operaciones_lineas`, `arreglos`, `formularios`; trigger de derivados (fuente doble); drop de `arreglos.tipo`; RPCs nuevos/modificados (servicios, repuestos y dashboard) |
| API | Si | `detalleArregloService`, rutas de detalle y repuestos (POST/PUT), `arregloRequests`, `arregloRepository`/`arregloService`, nuevo `tiposArregloService`/rutas |
| State | Si | Nuevo `TiposArregloProvider`; `useServiciosDraft`/`useRepuestosDraft` ganan tipo/empleado con default "ultimo usado" compartido |
| UI | Si | `ArregloFormFields` (selector de tipo pasa a catalogo), `EditableLineaCard` (usado por servicios y repuestos), `ReadOnlyLineaCard` (chips), listado de arreglos (chips desde `tipos`/`empleados`) |
| Dashboard | Si | 4 nuevos desgloses (facturacion x2, costo x2) + remocion del panel fijo `CantidadTiposArreglos`/`EstadoCobroArreglos` |

## Architecture Considerations

- **Patron existente a seguir**: `EmpleadosProvider`/`FormulariosProvider` como modelo para el nuevo `TiposArregloProvider`. RLS `tenant_access` igual que `productos`/`empleados`. El slot `extra` de `EditableLineaCard` ya existe y es el punto de extension natural para los selectores por linea (se usa tanto en `ServicioLineasEditableSection` como en `RepuestoLineasEditableSection`, ya que ambas se apoyan en el mismo `EditableLineaCard`).
- **Derivados con GUIDs, no denormalizacion de nombres**: `tipos`/`empleados` son `uuid[]`, no `jsonb` con nombre copiado. Esto evita el problema de "nombre desactualizado" si se renombra un tipo o un empleado; el nombre siempre se resuelve con join contra el catalogo/empleados al mostrar.
- **Migracion en dos pasos por el drop de columna**: eliminar `arreglos.tipo` es una operacion destructiva y dificil de revertir. Se planifica como (1) migracion aditiva + backfill + adaptacion de todo el codigo para dejar de leer/escribir `arreglos.tipo`, verificacion completa, y luego (2) migracion separada que hace el `DROP COLUMN`, ejecutada solo tras confirmacion explicita.
- **Formularios custom**: pasar el matching de texto a `tipo_arreglo_id` es un cambio de contrato del selector de "tipo" en el encabezado (deja de ser `allowCustomValue` libre y pasa a ser una seleccion del catalogo). Se preserva la funcionalidad de disparo de formulario custom, ahora por id en vez de string.
- **Un solo componente de grafico de torta parametrizable**: en vez de 4 componentes recharts casi identicos (facturacion x tipo, facturacion x empleado, costo x tipo, costo x empleado), se crea un unico componente generico (ej. `DesglosePieChart`) parametrizado por titulo/dataset/color, siguiendo el patron de `CantidadTiposArreglos.tsx` pero evitando la duplicacion.
- **Costo de repuestos**: se toma de `productos.costo_unitario` (no hay columna de costo en `operaciones_lineas`), multiplicado por `cantidad`, igual que ya hace `dashboard_gastos_por_periodo` para el total de repuestos.
- **`EstadoCobroArreglos` sin panel fijo donde vivir**: el usuario pidio remover `CantidadTiposArreglos` y `EstadoCobroArreglos` del panel fijo inferior (`mainPanel`) en ambas instrucciones, sin indicar un destino para `EstadoCobroArreglos`. Se asume que se reubica dentro del panel "Arreglos" (unico lugar restante con sentido tematico). **Esto es un supuesto, no una confirmacion explicita** — si se prefiere eliminarlo del dashboard directamente, avisar antes de implementar.
- **Costo por tipo excluye sueldo por decision explicita**: el sueldo no tiene una dimension "tipo" natural (es mensual y por empleado); en vez de inventar una formula de prorrateo, "Costo por tipo" solo suma costo de repuestos. "Costo por empleado" si incluye sueldo completo, ya que ahi la atribucion es directa.

## Success Criteria

- [ ] Cada `detalle_arreglo` y cada linea de repuesto (`operaciones_lineas`) puede tener su propio `tipo_arreglo_id` y `empleado_id`, independientes del resto de las lineas del mismo arreglo.
- [ ] Al agregar una linea nueva (detalle o repuesto), el formulario pre-carga el ultimo tipo/empleado usado en esa sesion de edicion; el usuario puede cambiarlo antes de guardar.
- [ ] `arreglos.tipo` ya no existe; toda la funcionalidad que dependia de el (filtro, descripcion, formularios custom) funciona igual o mejor via el catalogo.
- [ ] El panel "Facturacion" muestra dos gráficos de torta nuevos: Facturacion por tipo y Facturacion por empleado (mano de obra + repuestos).
- [ ] El panel "Gastos" muestra dos gráficos de torta nuevos: Costo por tipo (solo repuestos) y Costo por empleado (repuestos + sueldo).
- [ ] El panel fijo inferior (`CantidadTiposArreglos` + `EstadoCobroArreglos`) ya no aparece siempre visible; `EstadoCobroArreglos` se reubica en el panel "Arreglos".
- [ ] Los datos existentes quedan migrados sin perdida: cada detalle historico tiene un `tipo_arreglo_id` mapeado desde el `tipo` que tenia su arreglo.
- [ ] Borrar un tipo o un empleado del catalogo no rompe arreglos ni repuestos existentes (la linea cae a "Sin tipo"/"Sin empleado").

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Perdida de datos al eliminar `arreglos.tipo` sin backfill completo | Baja | Alta | Migracion en dos pasos (aditiva primero, drop separado tras verificacion); backfill probado contra copia de datos reales antes de aplicar en produccion |
| Romper el disparo de formularios custom al migrar de texto a `tipo_arreglo_id` | Media | Alta | Backfill de `formularios.tipo_arreglo_id` matcheando `descripcion` contra el nombre sembrado en `tipos_arreglo`; test de regresion especifico para el flujo de alta con formulario custom |
| Trigger de derivados desincronizado si se renombra un tipo/empleado | Baja | Baja | Al usar `uuid[]` (no nombres denormalizados) el problema no aplica: el nombre se resuelve siempre por join en el momento de lectura |
| Filtro de "tipo" en listado de arreglos cambia de busqueda por texto (`ilike`) a seleccion exacta de catalogo | Media | Media | Comunicar el cambio de UX; el nuevo selector sigue siendo un autocomplete, ahora acotado al catalogo existente |
| Concurrencia: dos requests de linea en paralelo (detalle y/o repuesto) disparan el trigger de derivados simultaneamente | Baja | Baja | El trigger recalcula con `SELECT DISTINCT`/`ARRAY_AGG` completo sobre ambas fuentes (no incrementa/decrementa), por lo que es idempotente sin importar el orden |
| Tocar los RPCs de repuestos (`rpc_asignar_repuesto_existente_con_compra`, etc.) introduce una regresion en la logica de stock/compra automatica ya existente | Media | Alta | Cambios aditivos (nuevos parametros opcionales al final de la firma), tests de integracion existentes para estos RPCs deben seguir pasando sin modificacion |
| `EstadoCobroArreglos` queda sin ubicacion clara al remover el panel fijo | Media | Baja | Reubicado por defecto en el panel "Arreglos"; confirmar con el usuario antes de implementar (ver Architecture Considerations) |
