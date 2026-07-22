# Delta: Arreglos / Detalle de arreglo

**Change ID:** `detalle-arreglo-tipo-empleado`
**Affects:** `arreglos`, `detalle_arreglo`, `operaciones_lineas`, `tipos_arreglo` (nueva), `formularios`, `empleados` (referenciada, sin cambios propios)

---

## ADDED

### Requirement: Catalogo de tipos de arreglo

El sistema debe mantener un catalogo de tipos de arreglo (`tipos_arreglo`) por tenant, reemplazando el texto libre anterior. Cada tipo tiene nombre unico (case-insensitive) por tenant y puede estar activo o inactivo.

#### Scenario: Crear un tipo nuevo al vuelo desde el selector
- GIVEN un usuario esta cargando un detalle de arreglo y escribe un nombre de tipo que no existe en el catalogo
- WHEN confirma la carga del detalle
- THEN se crea un nuevo registro en `tipos_arreglo` para el tenant actual y el detalle queda asociado a ese tipo

#### Scenario: Desactivar un tipo no elimina el historico
- GIVEN un tipo de arreglo tiene detalles asociados
- WHEN se desactiva (o se elimina) ese tipo del catalogo
- THEN los detalles que lo usaban conservan `tipo_arreglo_id = NULL` (o quedan marcados como "Sin tipo" en las vistas) sin perder el resto de sus datos

---

### Requirement: Tipo y empleado asignables por detalle de arreglo

Cada linea de `detalle_arreglo` puede tener su propio `tipo_arreglo_id` y `empleado_id`, independientes de los de otras lineas del mismo arreglo. Ambos campos son opcionales (nullable).

#### Scenario: Asignar tipo y empleado distintos por linea
- GIVEN un arreglo con dos detalles
- WHEN el usuario asigna "Mecanica"/"Juan" al primer detalle y "Electricidad"/"Ana" al segundo
- THEN cada detalle persiste su propia combinacion de tipo y empleado, sin afectar al otro

#### Scenario: Default al agregar un detalle nuevo
- GIVEN el usuario ya cargo un detalle con tipo "Mecanica" y empleado "Juan" en la sesion de edicion actual
- WHEN agrega un nuevo detalle
- THEN el formulario de carga pre-completa tipo "Mecanica" y empleado "Juan", pudiendo cambiarse antes de guardar

#### Scenario: Detalle sin tipo ni empleado asignado
- GIVEN un detalle de arreglo se crea sin elegir tipo ni empleado
- WHEN se guarda
- THEN el detalle persiste con `tipo_arreglo_id = NULL` y `empleado_id = NULL` sin error de validacion

---

### Requirement: Tipo y empleado asignables por linea de repuesto asignado a un arreglo

Cada linea de `operaciones_lineas` que representa un repuesto asignado a un arreglo (operacion de tipo `ASIGNACION_ARREGLO`) puede tener su propio `tipo_arreglo_id` y `empleado_id`, con el mismo comportamiento que en `detalle_arreglo`: opcionales, independientes por linea, y con el mismo default de "ultimo usado" compartido con las lineas de mano de obra dentro de la misma sesion de edicion del arreglo. Lineas de `operaciones_lineas` que no pertenecen a una asignacion de arreglo (`COMPRA`, `VENTA`, `AJUSTE`) no completan estos campos.

#### Scenario: Asignar tipo y empleado a un repuesto
- GIVEN un arreglo con un repuesto asignado (una pastilla de freno)
- WHEN el usuario le asigna tipo "Mecanica" y empleado "Juan"
- THEN esa linea de `operaciones_lineas` persiste `tipo_arreglo_id`/`empleado_id`, sin afectar otras lineas de repuestos u otros detalles del mismo arreglo

#### Scenario: El default de "ultimo usado" se comparte entre mano de obra y repuestos
- GIVEN el usuario cargo un detalle de mano de obra con tipo "Mecanica" y empleado "Juan"
- WHEN a continuacion agrega un repuesto en el mismo arreglo
- THEN el formulario del repuesto pre-completa tipo "Mecanica" y empleado "Juan"

---

### Requirement: Listas derivadas de tipos y empleados en el arreglo

Cada arreglo mantiene, de forma materializada, el conjunto unico de ids de tipo (`tipos`) e ids de empleado (`empleados`) usados tanto por sus detalles de mano de obra (`detalle_arreglo`) como por sus repuestos asignados (`operaciones_lineas`), actualizado automaticamente cuando cambia cualquiera de los dos.

#### Scenario: Agregar un detalle actualiza la lista derivada
- GIVEN un arreglo cuyo `tipos` es `[]`
- WHEN se agrega un detalle con `tipo_arreglo_id = X`
- THEN `arreglos.tipos` pasa a contener `X`

#### Scenario: Agregar un repuesto tambien actualiza la lista derivada
- GIVEN un arreglo cuyo `empleados` es `[]`
- WHEN se asigna un repuesto con `empleado_id = Y`
- THEN `arreglos.empleados` pasa a contener `Y`

#### Scenario: Eliminar el ultimo uso de un tipo lo saca de la lista derivada
- GIVEN un arreglo con un detalle de tipo `X` y un repuesto tambien de tipo `X`, ademas de un detalle de tipo `Y`
- WHEN se eliminan el detalle y el repuesto de tipo `X`
- THEN `arreglos.tipos` pasa a contener solo `Y`

#### Scenario: Lectura de la lista derivada no requiere joins
- GIVEN se necesita mostrar los tipos/empleados involucrados en un arreglo (ej. listado de arreglos)
- WHEN se consulta la fila del arreglo
- THEN `tipos`/`empleados` estan disponibles directamente como arrays de uuid, sin necesidad de consultar `detalle_arreglo` ni `operaciones_lineas`

---

## MODIFIED

### Requirement: Seleccion de tipo en el encabezado del arreglo

El selector de "Tipo" en el alta/edicion del arreglo deja de ser texto libre y pasa a seleccionar un `tipo_arreglo_id` del catalogo `tipos_arreglo`. Esta seleccion sigue disparando el formulario custom asociado (via `formularios.tipo_arreglo_id`) y sirve como valor inicial sugerido para el primer detalle.

#### Scenario: Seleccionar un tipo con formulario custom asociado
- GIVEN existe un `formulario` con `tipo_arreglo_id` igual al tipo "Revision tecnica"
- WHEN el usuario selecciona "Revision tecnica" como tipo del arreglo
- THEN se muestra la seccion de formulario custom correspondiente, igual que antes con el matching por texto

---

### Requirement: Filtro de tipo en el listado de arreglos

El filtro de tipo en `GET /api/arreglos` deja de ser una busqueda de texto libre (`ilike`) y pasa a ser una seleccion exacta de un tipo del catalogo, evaluada contra `arreglos.tipos`.

#### Scenario: Filtrar arreglos por un tipo del catalogo
- GIVEN un tipo "Mecanica" con id `X` y arreglos cuyos detalles usan ese tipo
- WHEN se filtra el listado por `tipo_arreglo_id = X`
- THEN se devuelven todos los arreglos cuyo `tipos` contiene `X`

---

### Requirement: Descripcion generada del arreglo

`buildArregloDescripcion` deja de usar `arreglos.tipo` (eliminado) y arma la descripcion a partir de los tipos usados en los detalles del arreglo (resueltos contra el catalogo).

#### Scenario: Descripcion refleja los tipos de los detalles
- GIVEN un arreglo con detalles de tipo "Mecanica" y "Electricidad"
- WHEN se recalcula la descripcion (`syncArregloDescripcion`)
- THEN el texto generado menciona ambos tipos en vez de un unico tipo de encabezado

---

## REMOVED

### Requirement: Campo de texto libre `arreglos.tipo`

Se elimina la columna `tipo` (varchar) de la tabla `arreglos` una vez migrados todos sus usos al catalogo `tipos_arreglo` y verificada la Fase 5 de `tasks.md`. Cualquier funcionalidad que dependia de este texto libre (filtro, descripcion, matching de formularios) queda re-implementada sobre el catalogo segun los requerimientos MODIFIED de este documento.
