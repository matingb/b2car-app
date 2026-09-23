# Plan de Implementación — Módulo de Horas
## Slices Verticales End-to-End

Cada slice es un corte completo de la funcionalidad: abarca DB, backend, UI y exports para **una sola capacidad**. Al terminar cada slice, el usuario puede probar esa capacidad de punta a punta, y el sistema queda en un estado estable antes de continuar.

---

## Reglas Transversales

> [!IMPORTANT]
> **Colores**: Usar exclusivamente tokens del sistema de diseño desde `@/theme/theme` (`COLOR`, `BREAKPOINTS`). **Prohibido** escribir valores hexadecimales hardcodeados (`#...`) o nombres de color CSS directamente en componentes. Si el color deseado no existe en el theme, agregar el token primero.
>
> **Referencia de diseño**: Los prototipos en [`/trabajo-por-hora---ui-prototipos/src/components/`](file:///Users/matias/Documents/proyectos/B2Car/b2car-landing/trabajo-por-hora---ui-prototipos/src/components/) son la fuente de inspiración para estructura y comportamiento. Mapeo de colores del prototipo a tokens del theme:
> - `cyan-*` → `COLOR.ACCENT.PRIMARY` / `COLOR.BACKGROUND.INFO_TINT`
> - `amber-*` → `COLOR.SEMANTIC.WARNING` / `COLOR.BACKGROUND.WARNING_TINT`
> - `slate-*` → `COLOR.TEXT.SECONDARY` / `COLOR.BORDER.SUBTLE`
> - `emerald-*` → `COLOR.SEMANTIC.SUCCESS` / `COLOR.BACKGROUND.SUCCESS_TINT`
> - `rose-*` → `COLOR.SEMANTIC.DANGER` / `COLOR.BACKGROUND.DANGER_TINT`

## Gate de Verificación (al final de cada slice)

```bash
npm run build           # debe pasar sin errores TypeScript
npm run test            # tests unitarios
npm run test:integration  # tests de integración
```

> [!CAUTION]
> Si cualquier comando falla, el slice **no está completo**. Corregir antes de pedir revisión humana.

---

## Slice 1 — Precio Hora del Taller

**Capacidad entregada**: El admin puede configurar el precio hora del taller desde una pantalla propia en el sidenav. Al agregar una línea de mano de obra en un arreglo, ese precio se precarga automáticamente.

```
DB: talleres.valor_hora
  └─ tenantService.getTalleres (incluye valor_hora)
       └─ /api/tenant/taller/[id] PUT (nuevo endpoint)
            └─ tenantClient.updateTaller
                 └─ TenantProvider.updateTaller
                      ├─ /talleres/page.tsx  →  UI de configuración en sidenav
                      └─ ServicioLineasEditableSection  →  precarga precioHoraFacturada
```

### Base de Datos

```sql
-- Migración: supabase/migrations/20260920_slice1_taller_valor_hora.sql
ALTER TABLE talleres
  ADD COLUMN valor_hora numeric(12,2) NOT NULL DEFAULT 0
    CHECK (valor_hora >= 0);
```

### Backend

**[MODIFY] [types.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/model/types.ts)**
```diff
 export interface Taller {
   id: string;
   nombre: string;
   ubicacion: string;
+  valor_hora?: number;
 }
```

**[MODIFY] [tenantService.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/api/tenant/tenantService.ts)**
```diff
-  .select("id, nombre, ubicacion")
+  .select("id, nombre, ubicacion, valor_hora")
```
Agregar método `updateTaller(supabase, tallerId, patch)`.

**[NEW] [/api/tenant/taller/[id]/route.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/api/tenant/taller/[id]/route.ts)**
Endpoint `PUT /api/tenant/taller/:id` que acepta `{ nombre?, ubicacion?, valor_hora? }` y llama a `tenantService.updateTaller`.

**[MODIFY] [tenantClient.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/clients/tenantClient.ts)**
Agregar `updateTaller(id, patch)` → `PUT /api/tenant/taller/${id}`.

**[MODIFY] [TenantProvider.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/providers/TenantProvider.tsx)**
Exponer `updateTaller` en el contexto: llama a `tenantClient.updateTaller` y refresca la lista de talleres.

### Navegación

**[MODIFY] [routes.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/routing/routes.ts)**
```diff
+  talleres: "/talleres",
```

**[MODIFY] [useSidebarMenu.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/hooks/useSidebarMenu.tsx)**
Agregar `Talleres = "talleres"` al enum, con icono `Building2`, permiso `ConfiguracionView`, posicionado entre Empleados y Configuración.

**[MODIFY] [permissions.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/lib/permissions.ts)**
```diff
+  { path: ["/talleres", "/api/tenant/taller"], permission: Permission.ConfiguracionView },
```

### UI

**[NEW] [(user)/talleres/page.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/(user)/talleres/page.tsx)**
- 1 taller: formulario directo con `Nombre`, `Ubicación`, `Precio Hora ($/h)`
- Múltiples talleres: lista con formulario inline por ítem
- Guardado con toast de éxito/error
- Usa `useTenant().talleres` + `useTenant().updateTaller`

**[MODIFY] [ServicioLineasEditableSection.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/components/arreglos/lineas/servicios/ServicioLineasEditableSection.tsx)**
Solo en este slice: el `initialDraft` precarga `precioHoraFacturada` (aún como `valor`) con el `valor_hora` del taller activo del arreglo (obtenido por prop o contexto). Sin cambios en el resto del componente todavía.

### ✅ Verificación Humana — Slice 1
- [ ] `npm run build` ✓ — `npm run test` ✓ — `npm run test:integration` ✓
- [ ] El ítem "Talleres" aparece en el sidenav para usuarios admin
- [ ] La pantalla `/talleres` carga el nombre, ubicación y precio hora actual
- [ ] Editar el precio hora y guardar muestra toast de éxito
- [ ] Abrir un arreglo y agregar una nueva línea de mano de obra → el campo "Precio hora" se precarga con el valor configurado

---

## Slice 2 — Horas Facturadas y Trabajadas en Mano de Obra

**Capacidad entregada**: Las líneas de mano de obra tienen campos de horas (facturadas y trabajadas), el card de edición permite ingresarlas con decimales, el card de solo lectura muestra el desglose y el panel de margen, y los totales en todo el sistema (UI, WhatsApp, PDF) se calculan correctamente.

```
DB: detalle_arreglo.valor → precio_hora_facturada (rename)
    detalle_arreglo.horas_facturadas, horas_trabajadas (new)
      └─ DETALLE_ARREGLO_SELECT + DetalleArregloRow
           └─ calcLineTotal() — función única
                ├─ ServicioEditableCard — inputs Hrs/Cant/$/h con decimales
                ├─ ReadOnlyLineaCard — tag horas + panel margen
                ├─ arreglos/[id]/page.tsx — subtotales y handlers
                ├─ whatsapp.ts — mensaje con nueva fórmula
                └─ arregloPrintableInvoice.ts — PDF con nueva fórmula
```

### Base de Datos

```sql
-- Migración: supabase/migrations/20260920_slice2_horas_detalle.sql

-- Renombrar valor → precio_hora_facturada (sin backfill: valor siempre fue unitario)
ALTER TABLE detalle_arreglo RENAME COLUMN valor TO precio_hora_facturada;

-- Agregar columnas de horas
ALTER TABLE detalle_arreglo
  ADD COLUMN horas_facturadas numeric(6,2) NOT NULL DEFAULT 1
    CHECK (horas_facturadas >= 0);
ALTER TABLE detalle_arreglo
  ADD COLUMN horas_trabajadas numeric(6,2) NOT NULL DEFAULT 1
    CHECK (horas_trabajadas >= 0);
```

Actualizar RPC `rpc_get_arreglo_detalle` (en la misma migración): reemplazar `'valor', d.valor` por:
```sql
'precio_hora_facturada', d.precio_hora_facturada,
'horas_facturadas',      d.horas_facturadas,
'horas_trabajadas',      d.horas_trabajadas
```

### Lógica Centralizada

**[NEW] [calcLineTotal.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/lib/calcLineTotal.ts)**
```typescript
import { safeNumber } from "@/lib/numbers";

export type LineaTotalInput = {
  cantidad: number | string;
  horas_facturadas?: number | string | null;
  precio_hora_facturada: number | string;
};

/** cantidad × horas_facturadas × precio_hora_facturada */
export function calcLineTotal(line: LineaTotalInput): number {
  return (
    safeNumber(line.cantidad) *
    safeNumber(line.horas_facturadas ?? 1) *
    safeNumber(line.precio_hora_facturada)
  );
}
```
Agregar `src/lib/calcLineTotal.test.ts` con casos: default horas=1, horas decimales, cantidad 0.

### Backend

**[MODIFY] [detalleArregloService.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/api/arreglos/detalleArregloService.ts)**
```diff
 const DETALLE_ARREGLO_SELECT =
-  "id, arreglo_id, descripcion, cantidad, valor, ...";
+  "id, arreglo_id, descripcion, cantidad, precio_hora_facturada, horas_facturadas, horas_trabajadas, ...";

 type DetalleArregloRow = {
-  valor: number;
+  precio_hora_facturada: number;
+  horas_facturadas: number;
+  horas_trabajadas: number;
 };
```
Actualizar payload de `create` para incluir `precio_hora_facturada`, `horas_facturadas`, `horas_trabajadas`.

### Página de Arreglo

**[MODIFY] [arreglos/[id]/page.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/(user)/arreglos/[id]/page.tsx)**

Subtotal:
```diff
+import { calcLineTotal } from "@/lib/calcLineTotal";
-  (acc, d) => acc + safeNumber(d.valor) * safeNumber(d.cantidad),
+  (acc, d) => acc + calcLineTotal(d),
```

`handleAddServicio` / `handleUpdateServicio`: renombrar `valor` → `precioHoraFacturada` y agregar `horasFacturadas`, `horasTrabajadas` en el input y en el payload a `createDetalle`/`updateDetalle`.

### UI

**[NEW] [ServicioEditableCard.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/components/arreglos/lineas/servicios/ServicioEditableCard.tsx)**

Basado en [`WorkItemForm.tsx`](file:///Users/matias/Documents/proyectos/B2Car/b2car-landing/trabajo-por-hora---ui-prototipos/src/components/WorkItemForm.tsx). Usa Emotion CSS con tokens del theme.

Layout:
```
┌─ Icono ─┬─ [Descripción                         ] ─┬─ Total ─┐
│         │  [Hrs Fact.] [Hrs Trab.] [Cant.] [$/h]   │         │
│         ├─────────────────────────────────────────── │         │
│         │  [Categoría ▾]  [Empleado ▾]   [✓] [✕]   │         │
└─────────┴───────────────────────────────────────────┴─────────┘
```

Props del draft:
```typescript
export type ServicioEditableCardDraft = {
  descripcion: string;
  cantidad: string;            // entero, min 1
  horasFacturadas: string;     // decimal, step 0.25, min 0
  horasTrabajadas: string;     // decimal, step 0.25, min 0
  precioHoraFacturada: string; // entero, min 0
  categoriaArregloId: string | null;
  empleadoId: string | null;
};
```

Inputs:
- `horasFacturadas` / `horasTrabajadas`: `type="number"`, `inputMode="decimal"`, `step="0.25"` — **no** filtrar con `/\D/g`
- `cantidad`: `type="number"`, `inputMode="numeric"`, `step="1"`
- `precioHoraFacturada`: `type="number"`, `inputMode="numeric"`, `step="500"`

Total reactivo:
```typescript
calcLineTotal({ cantidad, horas_facturadas: horasFacturadas, precio_hora_facturada: precioHoraFacturada })
```

Colores (mapeo del prototipo a tokens):
| Elemento | Token del theme |
|---|---|
| Círculo icono wrench (bg) | `COLOR.BACKGROUND.INFO_TINT` |
| Icono wrench | `COLOR.ACCENT.PRIMARY` |
| Input focus ring | `COLOR.ACCENT.PRIMARY` |
| Botón confirmar ✓ (bg) | `COLOR.BACKGROUND.SUCCESS_TINT` |
| Botón confirmar ✓ (border/texto) | `COLOR.SEMANTIC.SUCCESS` |
| Botón cancelar ✕ (bg) | `COLOR.BACKGROUND.DANGER_TINT` |
| Botón cancelar ✕ (border/texto) | `COLOR.SEMANTIC.DANGER` |
| Card border activo | `COLOR.ACCENT.PRIMARY` |

**[MODIFY] [ServicioLineasEditableSection.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/components/arreglos/lineas/servicios/ServicioLineasEditableSection.tsx)**
- Actualizar tipos `ServicioLinea`, `ServicioLineaValue`, `Draft` con `horasFacturadas`, `horasTrabajadas`, `precioHoraFacturada`
- Reemplazar `EditableLineaCard` por `ServicioEditableCard`
- Subtotal usa `calcLineTotal`

**[MODIFY] [ReadOnlyLineaCard.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/components/arreglos/lineas/shared/ReadOnlyLineaCard.tsx)**

Basado en [`WorkItemCard.tsx`](file:///Users/matias/Documents/proyectos/B2Car/b2car-landing/trabajo-por-hora---ui-prototipos/src/components/WorkItemCard.tsx).

Nuevas props opcionales:
```diff
+  horasFacturadas?: number;
+  horasTrabajadas?: number;
```

Total: `calcLineTotal({ cantidad, horas_facturadas: horasFacturadas, precio_hora_facturada: unitario })`

Tag de horas (solo `kind === "servicios"`, inspirado en líneas 66-78 de `WorkItemCard.tsx`):
- Muestra: `Fact: {horasFacturadas}h · Trab: {horasTrabajadas}h`
- Click → expande/colapsa panel interno
- Colores: `backgroundColor: COLOR.BACKGROUND.SUBTLE`, `border: COLOR.BORDER.SUBTLE`

Panel expandible (solo con `Permission.ArreglosPreciosView`, inspirado en líneas 113-148 de `WorkItemCard.tsx`):
```
┌─────────────────┬─────────────────┬─────────────────┐
│ Precio Facturado│ Costo M.O.      │ Diferencia      │
│ $30.000         │ $22.500         │ +$7.500 ✅      │
│ 2h × $15.000    │ 3h × $7.500/h   │ 1h a favor      │
└─────────────────┴─────────────────┴─────────────────┘
```
- **No muestra** `horasTrabajadas` ni `valorHoraEmpleado` al cliente — solo visible internamente
- Margen positivo: `COLOR.SEMANTIC.SUCCESS`; negativo: `COLOR.SEMANTIC.DANGER`
- Mini-cards bg: `COLOR.BACKGROUND.SUBTLE`, border: `COLOR.BORDER.SUBTLE`

### Exports

**[MODIFY] [whatsapp.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/lib/whatsapp.ts)**
- `calculateArregloTotals` usa `calcLineTotal(d)`
- `buildServiciosSectionLines`: mostrar horas en el ítem cuando `horas_facturadas !== 1` (ej. `"1 × 1.5hs - $45.000"`)
- **No** mostrar `horas_trabajadas`

**[MODIFY] [arregloPrintableInvoice.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/lib/arregloPrintableInvoice.ts)**
- `buildServiceLines` y `subtotalServicios` usan `calcLineTotal`
- Columna "Cant." muestra `cantidad × horasFacturadas` cuando `horasFacturadas !== 1`
- **No** mostrar `horas_trabajadas`

### ✅ Verificación Humana — Slice 2
- [ ] `npm run build` ✓ — `npm run test` ✓ — `npm run test:integration` ✓
- [ ] Los arreglos existentes siguen mostrando los mismos totales (default horas=1 es neutro)
- [ ] Al agregar una línea de mano de obra aparecen los inputs Hrs Facturadas y Hrs Trabajadas
- [ ] Los inputs de horas aceptan decimales (`1.5`, `0.75`) — no se truncan
- [ ] El total reactivo en el card de edición respeta la fórmula `cant × hrs × $/h`
- [ ] El card de solo lectura muestra el tag `Fact: Xh · Trab: Yh`
- [ ] Clic en el tag despliega el panel de margen con los 3 valores
- [ ] El margen positivo es verde, el negativo es rojo
- [ ] El mensaje de WhatsApp refleja las horas facturadas
- [ ] El PDF refleja las horas facturadas en la columna Cant.
- [ ] WhatsApp y PDF **no** muestran horas trabajadas
- [ ] Los repuestos no tienen cambios visibles (sin regresiones)
- [ ] No hay colores hexadecimales hardcodeados en los componentes nuevos/modificados

---

## Slice 3 — Valor Hora del Empleado por Línea

**Capacidad entregada**: Cada empleado tiene un valor hora configurado. Al asignarlo a una línea de mano de obra, el sistema precarga ese valor hora en un campo editable por línea (persiste independientemente). El perfil del empleado muestra el valor configurado.

```
DB: empleados.valor_hora (new)
    detalle_arreglo.valor_hora_empleado (new)
      └─ EmpleadoRow / EmpleadoDTO / Empleado (valorHora)
           └─ EmpleadoSelect — popover con lista + input valor hora
                ├─ ServicioEditableCard — campo valorHoraEmpleado
                ├─ ReadOnlyLineaCard — panel de margen usa valorHoraEmpleado
                ├─ EmpleadoFormFields — input "Valor Hora"
                ├─ EmpleadoEditModal — incluye valorHora en submit
                └─ empleados/[id]/page.tsx — muestra valorHora en perfil
```

### Base de Datos

```sql
-- Migración: supabase/migrations/20260920_slice3_valor_hora_empleado.sql
ALTER TABLE empleados
  ADD COLUMN valor_hora numeric(12,2)
    CHECK (valor_hora IS NULL OR valor_hora >= 0);

ALTER TABLE detalle_arreglo
  ADD COLUMN valor_hora_empleado numeric(12,2)
    CHECK (valor_hora_empleado IS NULL OR valor_hora_empleado >= 0);
```

Actualizar RPC `rpc_get_arreglo_detalle`: agregar `'valor_hora_empleado', d.valor_hora_empleado` al `jsonb_build_object` de `v_detalles`.

### Backend

**[MODIFY] [dtos.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/model/dtos.ts)**
```diff
+  valor_hora: number | null;
```

**[MODIFY] [contracts.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/api/empleados/contracts.ts)**
Agregar `valor_hora?: number | null` en `CreateEmpleadoRequest` y `UpdateEmpleadoRequest`.

**[MODIFY] [empleadosService.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/api/empleados/empleadosService.ts)**
Agregar `valor_hora: number | null` en `EmpleadoRow`. El service ya usa `select("*")`.

**[MODIFY] [EmpleadosProvider.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/providers/EmpleadosProvider.tsx)**
- Tipo `Empleado`: agregar `valorHora: number | null`
- `mapEmpleado`: `valorHora: dto.valor_hora ?? null`
- `CreateEmpleadoInput` / `UpdateEmpleadoInput`: agregar `valorHora?: number | null`
- `createEmpleado` / `updateEmpleado`: pasar `valor_hora` al client

**[MODIFY] [detalleArregloService.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/api/arreglos/detalleArregloService.ts)**
Agregar `valor_hora_empleado: number | null` en `DetalleArregloRow`, en `DETALLE_ARREGLO_SELECT`, y en el payload de `create`.

### UI — EmpleadoSelect

**[MODIFY] [EmpleadoSelect.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/components/arreglos/lineas/shared/EmpleadoSelect.tsx)**

Basado en [`EmployeeSelectDropdown.tsx`](file:///Users/matias/Documents/proyectos/B2Car/b2car-landing/trabajo-por-hora---ui-prototipos/src/components/EmployeeSelectDropdown.tsx).

Props extendidas:
```diff
 type Props = {
   value: string | null;
   onChange: (empleadoId: string | null) => void;
+  valorHora?: string;
+  onValorHoraChange?: (valorHora: string) => void;
   disabled?: boolean;
   placeholder?: string;
 };
```

Comportamiento del popover:
1. Abre con lista de empleados y el input `$ Valor hora` al tope
2. Al seleccionar empleado → si el `valorHora` prop actual es vacío/cero, precargar con `empleado.valorHora`; si ya tiene valor, conservarlo
3. El usuario puede editar el valor hora en el input (estado temporal `tempRate`)
4. "Confirmar" → `onChange(empleadoId)` + `onValorHoraChange(tempRate)` → cierra
5. "Cancelar" → descarta y cierra
6. Clic fuera → descarta y cierra

Colores (mapeo desde [`EmployeeSelectDropdown.tsx`](file:///Users/matias/Documents/proyectos/B2Car/b2car-landing/trabajo-por-hora---ui-prototipos/src/components/EmployeeSelectDropdown.tsx)):
| Elemento | Token del theme |
|---|---|
| Trigger con empleado (bg/border) | `WARNING_TINT` / `SEMANTIC.WARNING` |
| Avatar iniciales (bg) | `SEMANTIC.WARNING` |
| Trigger sin empleado (bg) | `BACKGROUND.SUBTLE` |
| Ítem seleccionado en lista | `BACKGROUND.INFO_TINT` + borde `ACCENT.PRIMARY` |
| Avatar seleccionado | `ACCENT.PRIMARY` + `TEXT.CONTRAST` |
| Botón "Confirmar" | `ACCENT.PRIMARY` bg + `TEXT.CONTRAST` |
| Botón "Cancelar" | `BACKGROUND.SECONDARY` bg + `TEXT.PRIMARY` |

### UI — ServicioEditableCard (extensión del Slice 2)

**[MODIFY] [ServicioEditableCard.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/components/arreglos/lineas/servicios/ServicioEditableCard.tsx)**

Agregar `valorHoraEmpleado: string` al draft y pasar los callbacks a `EmpleadoSelect`:
```typescript
<EmpleadoSelect
  value={draft.empleadoId}
  onChange={(id) => setDraft(p => ({ ...p, empleadoId: id }))}
  valorHora={draft.valorHoraEmpleado}
  onValorHoraChange={(v) => setDraft(p => ({ ...p, valorHoraEmpleado: v }))}
  disabled={!canInteract}
/>
```

### UI — ReadOnlyLineaCard (extensión del Slice 2)

**[MODIFY] [ReadOnlyLineaCard.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/components/arreglos/lineas/shared/ReadOnlyLineaCard.tsx)**

Agregar prop `valorHoraEmpleado?: number | null`. Usarla en el panel de margen para calcular "Costo Mano de Obra":
```
Costo = horasTrabajadas × valorHoraEmpleado
```
Visible solo con `Permission.ArreglosPreciosView`. **No** exponer en WhatsApp ni PDF.

### UI — Empleado Profile

**[MODIFY] [EmpleadoFormFields.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/components/empleados/EmpleadoFormFields.tsx)**
Agregar campo `Valor Hora ($/h)`, tipo number, nullable, `step="500"`.

**[MODIFY] [EmpleadoEditModal.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/components/empleados/EmpleadoEditModal.tsx)**
Incluir `valorHora` en `buildInitialValues` y en `handleSubmit → updateEmpleado`.

**[MODIFY] [empleados/[id]/page.tsx](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/(user)/empleados/[id]/page.tsx)**
Mostrar `Valor Hora: $X.XXX` en la tarjeta de info del empleado.

### ✅ Verificación Humana — Slice 3
- [ ] `npm run build` ✓ — `npm run test` ✓ — `npm run test:integration` ✓
- [ ] El modal de edición de empleado tiene el campo "Valor Hora"
- [ ] El valor hora del empleado se guarda y se muestra en su perfil
- [ ] Al agregar un empleado a una línea de arreglo: el selector abre un popover con lista y campo `$ hora`
- [ ] Si el empleado tiene valor hora configurado y la línea no tenía uno, se precarga
- [ ] Si la línea ya tenía un valor hora, se conserva al cambiar empleado
- [ ] "Confirmar" en el popover persiste el empleado y el valor hora
- [ ] "Cancelar" en el popover descarta los cambios
- [ ] El panel de margen en el card de solo lectura muestra "Costo M.O." correctamente
- [ ] `valor_hora_empleado` **no** aparece en WhatsApp ni en el PDF

---

## Slice 4 — Exports Completos (WhatsApp + PDF con fórmula final)

**Capacidad entregada**: Los mensajes de WhatsApp y los PDFs reflejan correctamente la nueva fórmula de horas, muestran la información pertinente al cliente (sin filtrar privacidad), y tienen tests automatizados actualizados.

> [!NOTE]
> Los Slices 2 y 3 ya actualizaron parcialmente `whatsapp.ts` y `arregloPrintableInvoice.ts`. Este slice hace el ajuste fino: actualiza los tests existentes que fallarán por el rename de `valor`, y agrega casos de prueba para las horas.

**[MODIFY] [whatsapp.test.ts](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/lib/whatsapp.test.ts)**
- Actualizar fixtures para usar `precio_hora_facturada` en vez de `valor`
- Agregar casos con `horas_facturadas: 1.5` y verificar que el total y el desglose sean correctos
- Verificar que `horas_trabajadas` y `valor_hora_empleado` no aparezcan en el output

**[MODIFY] tests de `arregloPrintableInvoice`**
- Actualizar fixtures de la misma forma
- Verificar totales con horas decimales

### ✅ Verificación Humana — Slice 4
- [ ] `npm run build` ✓ — `npm run test` ✓ — `npm run test:integration` ✓
- [ ] Todos los tests de `whatsapp.test.ts` pasan con la nueva fórmula
- [ ] Abrir modal de WhatsApp en un arreglo con líneas de horas → el total es correcto
- [ ] Imprimir un arreglo con líneas de horas → el PDF muestra el total correcto
- [ ] Ningún export revela horas trabajadas ni valor hora del empleado

---

## Resumen de Archivos por Slice

| Slice | Capacidad | Nuevos | Modificados |
|-------|-----------|--------|-------------|
| **1** | Precio hora del taller → config UI → precarga en arreglo | 3 | 6 |
| **2** | Horas facturadas/trabajadas → card edición → card lectura → WhatsApp → PDF | 2 | 8 |
| **3** | Valor hora empleado → popover selector → panel margen → perfil empleado | 1 | 8 |
| **4** | Tests de exports actualizados | 0 | 2 |
| **Total** | | **6 nuevos** | **24 modificados** |
