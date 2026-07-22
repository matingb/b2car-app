# Delta: Dashboard / Estadisticas

**Change ID:** `detalle-arreglo-tipo-empleado`
**Affects:** `dashboardStatsService`, `arregloService`/`arregloRepository` (metodos de agregacion), `DashboardProvider`, `components/graficos/*`, `(user)/dashboard/page.tsx`

---

## ADDED

### Requirement: Desglose de facturacion por tipo y por empleado (panel Facturacion)

Dentro del panel expandible "Facturacion" del dashboard, ademas del grafico existente de ingresos por periodo, deben mostrarse dos gráficos de torta nuevos: **Facturacion por tipo** y **Facturacion por empleado**. Ambos suman el monto facturado en mano de obra (`detalle_arreglo.cantidad * valor`) mas el monto facturado en repuestos (`operaciones_lineas.cantidad * monto_unitario`), agrupado por `tipo_arreglo_id` o `empleado_id` respectivamente, para el periodo seleccionado.

#### Scenario: Ver facturacion por tipo incluyendo mano de obra y repuestos
- GIVEN un arreglo con un detalle de mano de obra tipo "Mecanica" (monto 10000) y un repuesto tipo "Mecanica" (monto 3000), dentro del periodo
- WHEN se abre el panel "Facturacion" y se consulta el desglose por tipo
- THEN "Mecanica" acumula 13000 (10000 + 3000)

#### Scenario: Ver facturacion por empleado
- GIVEN detalles y repuestos con `empleado_id` asignado dentro del periodo del dashboard
- WHEN se consulta el desglose por empleado
- THEN se muestra el monto total facturado (mano de obra + repuestos) atribuido a cada empleado en ese periodo

#### Scenario: Lineas sin tipo o sin empleado se agrupan aparte
- GIVEN existen detalles o repuestos sin `tipo_arreglo_id` (o sin `empleado_id`) en el periodo consultado
- WHEN se calcula cualquiera de los dos desgloses de facturacion
- THEN esas lineas se agrupan bajo la etiqueta "Sin tipo" o "Sin empleado" respectivamente, sin excluirse del total

---

### Requirement: Desglose de costo por tipo y por empleado (panel Gastos)

Dentro del panel expandible "Gastos" del dashboard, ademas del grafico existente de gastos por periodo, deben mostrarse dos gráficos de torta nuevos: **Costo por tipo** y **Costo por empleado**.

- "Costo por tipo" suma unicamente el costo de los repuestos asignados (`operaciones_lineas.cantidad * productos.costo_unitario`), agrupado por `tipo_arreglo_id`. No incluye sueldos: el sueldo es mensual y por empleado, sin una dimension "tipo" a la que atribuirse, y se decidio explicitamente no prorratearlo.
- "Costo por empleado" suma el costo de los repuestos atribuidos a ese empleado **mas** su sueldo vigente en el periodo (misma fuente que ya usa `dashboard_gastos_por_periodo` para el total de sueldos, ahora desagregada por empleado).

#### Scenario: Costo por tipo no incluye sueldo
- GIVEN un periodo donde se pagaron sueldos y se asignaron repuestos con distintos tipos
- WHEN se consulta el desglose "Costo por tipo"
- THEN el total de cada tipo refleja solo el costo de los repuestos de ese tipo, sin ningun monto de sueldo

#### Scenario: Costo por empleado incluye sueldo y repuestos
- GIVEN un empleado con sueldo vigente de 300000 en el periodo, que ademas tiene repuestos asignados por un costo total de 50000
- WHEN se consulta el desglose "Costo por empleado"
- THEN ese empleado acumula 350000 (300000 de sueldo + 50000 de repuestos)

#### Scenario: Repuestos sin tipo o sin empleado se agrupan aparte
- GIVEN existen repuestos asignados sin `tipo_arreglo_id` (o sin `empleado_id`) en el periodo
- WHEN se calcula cualquiera de los dos desgloses de costo
- THEN esos repuestos se agrupan bajo la etiqueta "Sin tipo" o "Sin empleado" respectivamente

---

## MODIFIED

### Requirement: Composicion del dashboard (paneles y ubicacion de graficos)

El panel fijo inferior que hoy se muestra siempre, sin importar la tarjeta activa (`mainPanel`, con las mitades "Arreglos | Tipos" usando `CantidadTiposArreglos` y "Arreglos | Estado de pago" usando `EstadoCobroArreglos`), deja de existir. `CantidadTiposArreglos` se elimina (reemplazado por los desgloses de facturacion/costo por tipo, ahora dentro de sus paneles correspondientes). `EstadoCobroArreglos` se reubica dentro del panel expandible de la tarjeta "Arreglos".

#### Scenario: El panel fijo ya no aparece al ver Gastos o Balance
- GIVEN el usuario tiene seleccionada la tarjeta "Gastos" o "Balance"
- WHEN observa el dashboard
- THEN no ve ningun panel de "Tipos" o "Estado de pago" debajo, salvo los desgloses propios de "Facturacion"/"Gastos" cuando esas tarjetas estan activas

#### Scenario: Estado de pago sigue siendo consultable
- GIVEN el usuario quiere ver cuantos arreglos estan cobrados vs pendientes
- WHEN abre el panel de la tarjeta "Arreglos"
- THEN encuentra el grafico `EstadoCobroArreglos` ahi

---

### Requirement: Desglose de ingresos por tipo de arreglo (superseded)

El desglose "Tipos con ingresos" (RPC `dashboard_tipos_con_ingresos`, agregando por `arreglos.tipo`, un valor por arreglo completo) queda reemplazado por "Facturacion por tipo" (ver ADDED), que agrega por `tipo_arreglo_id` a nivel de linea (detalle + repuesto) y refleja que un mismo arreglo puede tener lineas de distintos tipos.

#### Scenario: Un arreglo con lineas de dos tipos aporta a ambos
- GIVEN un arreglo con un detalle de tipo "Mecanica" (monto 10000) y otro de tipo "Electricidad" (monto 5000)
- WHEN se calcula "Facturacion por tipo" del periodo
- THEN "Mecanica" suma 10000 e "Electricidad" suma 5000 (en vez de que los 15000 se atribuyan a un unico tipo de encabezado)

---

### Requirement: Invalidacion de cache del dashboard

La cache de estadisticas del dashboard (`unstable_cache` por tenant, `onDataChanged`) debe invalidarse tambien ante altas, ediciones y bajas de `detalle_arreglo` **y de `operaciones_lineas` de repuestos asignados a un arreglo** (hoy solo invalida via el alta/baja del arreglo completo), dado que ahora ambas tienen datos propios (tipo, empleado) que afectan los agregados de facturacion y costo.

#### Scenario: Cambiar el empleado de un detalle refresca el dashboard
- GIVEN el dashboard tiene cacheados los resultados del periodo actual
- WHEN se actualiza el `empleado_id` de un detalle existente via `PUT /api/arreglos/[id]/detalles/[detalleId]`
- THEN la proxima consulta al dashboard refleja el cambio (cache invalidada), sin esperar el vencimiento de 1 hora

#### Scenario: Cambiar el tipo de un repuesto asignado tambien refresca el dashboard
- GIVEN el dashboard tiene cacheados los resultados del periodo actual
- WHEN se actualiza el `tipo_arreglo_id` de una linea de repuesto existente
- THEN la proxima consulta al dashboard refleja el cambio sin esperar el vencimiento de la cache

---

## REMOVED

### Requirement: Panel fijo "Arreglos | Tipos" / "Arreglos | Estado de pago"

Se elimina el bloque `mainPanel` que hoy se renderiza siempre debajo de las 4 tarjetas del dashboard, independientemente de cual este activa. Su contenido se redistribuye segun los requerimientos ADDED/MODIFIED de este documento.
