# Migración desde un sistema externo (B2C-188)

`scripts/migrar_sistema_externo_tenant.py` migra, a **un tenant y un taller**,
los clientes, vehículos, operarios, órdenes de trabajo (arreglos) y tareas
(detalles de arreglo) exportados por el sistema anterior en cinco CSV.

Los IDs del sistema anterior se usan solo para cruzar los archivos. Nunca son
PK de B2Car: todos los IDs nuevos se generan con `uuid4`.

## Requisitos previos

1. Aplicar en la base destino la migración
   `supabase/migrations/20260930120000_b2c_188_snapshot_costo_service_role.sql`.
   Sin ella, el trigger `_snapshot_detalle_arreglo_valores` reemplaza el costo
   hora histórico de cada tarea por el valor hora actual del empleado. El script
   lo detecta después del primer lote de tareas y se detiene con un error fatal.
2. Tomar un backup o asegurar PITR de la base.
3. Instalar las dependencias:
   `python -m pip install -r scripts/requirements-importar-clientes.txt`.
4. Configurar en el script `TENANT_ID` y `TALLER_ID`. Los valores commiteados son
   placeholders inválidos: el script no corre hasta que se reemplazan. **No
   commitear los valores reales.**
5. Copiar los CSV a `scripts/data/<carpeta>/` (ignorado por git). Nunca commitear
   esos archivos, el estado ni el reporte.

## Ejecución

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"

python scripts/migrar_sistema_externo_tenant.py scripts/data/b2c188 --dry-run
python scripts/migrar_sistema_externo_tenant.py scripts/data/b2c188
python scripts/migrar_sistema_externo_tenant.py scripts/data/b2c188   # control: 0 creados
```

Orden recomendado:

1. Aplicar la migración.
2. Hacer un dry-run y revisar el reporte y el resumen.
3. Hacer la ejecución real, antes de que el tenant opere con esos datos o en un
   momento sin uso.
4. Hacer una re-ejecución de control, que debe dar 0 creados.

Al iniciar, el script muestra el nombre del tenant y del taller y las cantidades
actuales de clientes, vehículos y arreglos del tenant. Sirve para detectar un
tenant equivocado.

| Argumento | Uso |
| --- | --- |
| `directorio_csv` | Carpeta con `clientes.csv`, `vehiculos.csv`, `operarios.csv`, `ordenesTrabajo.csv` y `tareasEnOT.csv`. Los nombres no distinguen mayúsculas. |
| `--dry-run` | Valida, consulta existentes y calcula importes. No escribe en la base ni en el estado. |
| `--estado-path` | Por defecto: `<directorio_csv>/migracion_estado_<TENANT_ID>.json`. |
| `--reporte-path` | Por defecto: `<directorio_csv>/reporte_migracion.csv` (o `reporte_migracion_dry_run.csv`). |
| `--encoding` | Por defecto `utf-8-sig`. Si falla la lectura, reintentar con `--encoding cp1252`. |
| `--batch-size`, `--request-timeout`, `--verbose` | Igual que en `importar_vehiculos_tenant.py`. |

El script detecta el delimitador de cada archivo (`;`, `,`, tab o `|`) y
normaliza los encabezados: ignora tildes, mayúsculas, guiones bajos y BOM. Si
falta un archivo o una columna requerida, se detiene antes de conectarse.

## Salidas

- **Reporte** (`;`): `nivel;codigo;entidad;archivo;linea_csv;id_origen;referencias;motivo`.
  - `error`: el registro no se importó.
  - `warning`: el registro se importó con un dato omitido, derivado o resuelto
    por una alternativa.
  - El reporte no incluye nombres, documentos, teléfonos ni emails. Los errores
    de la base se informan sin su detalle, que puede traer valores de la fila.
- **Resumen** en consola: una línea por entidad con `leidos`, `creados` (`a_crear`
  en dry-run), `reutilizados`, `ya_migrados`, `fallidos` y `warnings`. Además
  muestra los contadores (tareas de ajuste, operarios con DNI ficticio, tareas
  sin costo, etc.), los `IdDeposito` distintos y el importe total migrado.
- **Estado** (JSON): mapa `ID origen → ID B2Car` por entidad (clientes,
  vehículos por patente, operarios, categorías y OTs). Solo contiene IDs.
- **Código de salida**: `1` si hubo algún error por registro o un error fatal;
  `0` si solo hubo warnings.

Solo detienen la ejecución los errores sistémicos: configuración inválida, CSV
ilegible, esquema o migración faltante, estado de otro tenant o fallo de
compensación. Cualquier otro error afecta solo al registro.

## Mapeo

### clientes.csv → `clientes` + `particulares` / `empresas`

| Origen | Destino | Regla |
| --- | --- | --- |
| `IdCliente` | Estado | Obligatorio. Si se repite, todas esas filas dan error. |
| `Razon_Social` | `nombre` | Si falta, se usa `NombreFantasia` con warning. En particulares, `apellido = ""` (el origen no separa el apellido). |
| `Nro_CUIT` | `empresas.cuit` / `particulares.dni_cuil` | 11 dígitos con dígito verificador válido: prefijo 30/33/34 → empresa; 20/23/24/27 → particular con CUIL. Otro valor → warning `CUIT_INVALIDO`. |
| `NroDocumento` | `particulares.dni_cuil` | Si no hubo CUIT válido: 11 dígitos se evalúan como CUIT/CUIL; 7-8 dígitos son DNI. Si no, el particular queda sin documento. |
| `Calle`, `Calle_Nro`, `Piso`, `Depto`, `localidad`, `Provincia` | `direccion` | Texto compuesto. `0` es ausencia. |
| `DireccionEmail` | `email` | Sin `@` se omite con warning. |
| `Telefono_Movil` / `Telefono_Fijo` | `telefono` | Móvil primero. `codigo_pais = NULL`. |
| `IdCodPostal`, `IdLocalidad`, `IdMoneda`, `Observaciones` | — | Sin columna destino. `IdCodPostal`/`IdLocalidad` son IDs de catálogos no provistos. |

Todas las tablas reciben `tenant_id` explícito. Un documento que ya existe en el
tenant reutiliza ese cliente, sin modificarlo. Dos filas de origen con el mismo
documento generan un solo cliente, con warning.

### vehiculos.csv → `vehiculos`

Esquema real: `Patente | Marca | Modelo | Version | Anio | Color | Cliente | IdCliente | Chasis | Motor`.
No trae `IdVehiculo`, así que **la patente normalizada es la identidad del vehículo**.

| Origen | Destino | Regla |
| --- | --- | --- |
| `Patente` | `patente` | Alfanumérico en mayúsculas. Vacía → error. Si no tiene un formato argentino de auto (`AAA999`, `AA999AA`) ni de moto (`999AAA`, `A999AAA`), se importa tal cual con warning `VEHICULO_PATENTE_NO_ESTANDAR`. |
| `IdCliente` | `cliente_id` | Sin cliente resuelto → error. |
| `Marca` | `marca` | `""` si falta. |
| `Modelo` + `Version` | `modelo` | `"Modelo Version"`. |
| `Anio` | `fecha_patente` | Año de 4 dígitos entre 1900 y el año siguiente. Otro valor → `NULL` con warning. |
| `Color`, `Chasis`, `Motor` | `color`, `numero_chasis`, `numero_motor` | Chasis y motor en mayúsculas; `""` si faltan. |
| `Cliente` | — | Nombre informativo, no se usa. |

- Si la patente ya existe en el tenant y es del mismo cliente, se reutiliza. Si es
  de otro cliente, da error: no hay reasignación silenciosa.
- Si la patente se repite en el CSV con el mismo cliente, se crea un único
  vehículo, con warning; los campos se toman de la primera fila que los trae.
- Si se repite con distintos clientes, todas esas filas dan error
  `VEHICULO_PATENTE_CONFLICTO`, y sus OTs también.

### operarios.csv → `empleados` (del `TALLER_ID`)

| Origen | Destino | Regla |
| --- | --- | --- |
| `IdOperario` | Estado | Obligatorio y único. |
| `Nombre` | `nombre` + `apellido` | Se separa por el último espacio (`"Juan Carlos Perez"` → `"Juan Carlos"` / `"Perez"`). Con una sola palabra, `apellido = " "` (un espacio) con warning. |
| Columna de DNI (opcional) | `dni` | Si existe y tiene 7-8 dígitos, se usa. Si no, se asigna un DNI ficticio. |
| `telefono` | `telefono` | Normalizado. |
| `ImporteHoraCosto` | `valor_hora` | Costo hora actual para trabajos futuros. `NULL` si es 0. |
| `ImporteHoraVenta` | — | En B2Car el precio hora de venta es del taller (`talleres.valor_hora`). No se sobrescribe ni se usa para valorizar el historial. |
| `Domicilio`, `Observaciones` | — | `empleados` no tiene esas columnas. |

**DNI ficticio.** `empleados.dni` es obligatorio y `operarios.csv` no lo trae.
El DNI ficticio es `99` + `IdOperario` con ceros a la izquierda hasta 6 dígitos
(`4` → `99000004`). Es determinístico, único y fácil de identificar: el RENAPER
no asigna ese rango. Si `IdOperario` no es numérico o es ≥ 1.000.000, se asigna
el primer número libre de `99000000`–`99999999`, en orden de `IdOperario`, con
warning `OPERARIO_DNI_FICTICIO_NO_DERIVABLE`. Para encontrarlos y reemplazarlos:

```sql
select id, nombre, apellido, dni
from empleados
where tenant_id = '<tenant>' and dni like '99______';
```

**Reutilización:** primero el estado; después, un empleado del taller con el mismo
DNI (real o ficticio); después, uno con el mismo nombre y apellido (sin tildes ni
mayúsculas), con warning. Si hay más de una coincidencia, da error
`OPERARIO_AMBIGUO` y sus tareas quedan sin empleado. Nunca se modifica un
empleado existente.

### Categorías (`GrupoTarea`) → `categorias_arreglo`

Se comparan sin tildes ni mayúsculas contra las categorías del tenant. Las que no
existen se crean con el primer texto visto.

### ordenesTrabajo.csv → `arreglos`

| Origen | Destino | Regla |
| --- | --- | --- |
| `IdOT` | Estado + `extra_data.migracion.id_ot` | Obligatorio y único. |
| `Patente` | `vehiculo_id` | Relación principal (ver "Resolución del vehículo"). |
| `IdVehiculo` | `extra_data` | Control de consistencia y alternativa cuando la OT no trae patente. |
| `IdCliente` | `cliente_id` | Ver "Resolución del cliente". |
| `FechaIngreso_S` | `fecha` | Si falta o es inválida, se usa la menor `FechaRealizado_S` de sus tareas, con warning. Si tampoco hay, error. |
| `Kilometraje` | `kilometraje_leido` | Entero > 0. Si no, el mayor kilometraje de sus tareas. |
| `Total` | `precio_final` | Ver "Reglas de importes". |
| `SolicitudCliente`, `ManoObra`, `Ampliacion`, `Otros`, `RefACliente` | `observaciones` | Bloques rotulados (`Solicitud del cliente: …`), uno por línea. |
| `Facturado`, `IdFactura`, `IdClienteFactura`, `ImporteaFacturar`, `IdDeposito`, `IdTipoVehiculo`, `IdMarca`, `IdModelo`, `Version`, `Anio` | `extra_data.migracion` | Solo trazabilidad. Las facturas de B2Car son comprobantes ARCA: no hay destino compatible. |

Valores fijos: `estado = 'TERMINADO'`, `es_facturable = false`,
`combustible_leido = NULL`, `taller_id = TALLER_ID`.

`descripcion` es la unión con `" | "` de las descripciones de las tareas. Si no
hay tareas, se usa `SolicitudCliente` y, si tampoco hay, `"Arreglo registrado
sin detalle específico"`. La app la recalcula si alguien edita las líneas (y
entonces incluye la tarea de ajuste).

`extra_data`:

```json
{"migracion": {"origen": "sistema-externo", "id_ot": "1", "id_cliente": "7", "id_vehiculo": "3",
  "patente": "HUF763", "id_deposito": "1", "id_tipo_vehiculo": "7", "id_marca": "10", "id_modelo": "277",
  "version": null, "anio": "8", "total": "0.00", "facturado": false, "id_factura": null,
  "id_cliente_factura": null, "importe_a_facturar": "0.00", "migrado_at": "<ISO>"}}
```

Los importes se guardan como texto para no perder decimales. Un ID `0` se guarda
como `null`.

**Resolución del vehículo:**

1. Si la patente existe entre los vehículos importados o los que ya tenía el
   tenant, se usa ese vehículo. Si su vehículo falló en `vehiculos.csv`, la OT da
   error con la referencia a esa incidencia.
2. Si la patente no existe (suele ser un error de tipeo en la OT, p. ej. `ETS585`
   por `ETS565`) o la OT no trae patente, se usa la única patente **existente** que
   otras OTs asocian a su `IdVehiculo`, con warning
   `OT_VEHICULO_RESUELTO_POR_ID_VEHICULO`. La patente original queda en
   `extra_data.migracion.patente`.
3. Si no hay una única alternativa, o la alternativa falló en `vehiculos.csv`, error
   `OT_VEHICULO_NO_RESUELTO` (o `OT_SIN_PATENTE` si la OT no trae patente). **No se
   crean vehículos desde las OTs**, porque `IdMarca`/`IdModelo` no tienen catálogo.
4. Si un `IdVehiculo` aparece con varias patentes, o una patente con varios
   `IdVehiculo`, hay warning y la patente de cada OT manda (salvo en el caso 2).

**Resolución del cliente:** si `IdCliente` resuelve y difiere del dueño actual del
vehículo, se conserva el de la OT (dueño histórico) con warning. Si es `0` o no
resuelve, `cliente_id` queda `NULL` y el trigger `trg_sync_arreglo_cliente_id`
usa el dueño del vehículo. `trg_sync_vehiculo_cliente_id_to_arreglos` reasigna
estos arreglos si en el futuro cambia el dueño del vehículo.

### tareasEnOT.csv → `detalle_arreglo`

| Origen | Destino | Regla |
| --- | --- | --- |
| `IdTareaEnOT` | Orden y reporte | Obligatorio y único. |
| `IdOT` | `arreglo_id` | Si la OT no está en `ordenesTrabajo.csv`, la tarea da error: no se crean arreglos desde tareas. |
| `DescripcionTarea` | `descripcion` | Si falta, `GrupoTarea`; si tampoco hay, `"Tarea sin descripción"`. En ambos casos, warning. |
| `CantHorasVenta`, `PrecioHoraVenta`, `ImporteHorasVenta` | `horas_facturadas`, `precio_hora_facturada` | Ver "Reglas de importes". |
| `CantHorasCosto`, `PrecioHoraCosto`, `ImporteCosto` | `horas_trabajadas`, `valor_hora_empleado` | Ver "Reglas de importes". |
| `IdOperario` | `empleado_id` | `0` o vacío → sin empleado. Si no resuelve, sin empleado y con warning. |
| `GrupoTarea` | `categoria_arreglo_id` | Por nombre normalizado. |
| `FechaRealizado_S` | `created_at` | Si falta, la fecha de la OT. Se suma un microsegundo por posición para conservar el orden `(fecha, IdTareaEnOT)`. |
| `Kilometraje` | — | Solo es alternativa del kilometraje de la OT. |
| `CantHorasStd` | — | Sin columna destino. |

`cantidad = 1`. Una tarea con error (ID vacío o repetido, importe negativo, fuera
de rango) hace fallar **su OT completa**: no se crean arreglos con importes
incompletos.

## Reglas de importes

Todos los cálculos usan decimales exactos con redondeo *half up* a 2 decimales.
**Nunca** se usan tarifas actuales del operario ni del taller para valorizar el
historial.

**Venta (por tarea).** La columna de total tiene prioridad:

1. Si `ImporteHorasVenta > 0`: `horas = CantHorasVenta` (o `1` si es 0) y
   `precio_hora = ImporteHorasVenta / horas`. Si `PrecioHoraVenta × horas` difiere
   del importe en más de $0,50, hay warning y manda el importe.
2. Si no, con `PrecioHoraVenta > 0` y `CantHorasVenta > 0`, se usan esos valores.
3. Si no, subtotal 0 (`precio_hora = 0`, nunca `NULL`) con warning
   `TAREA_SIN_IMPORTE_VENTA`.

**Costo (por tarea).** `horas_trabajadas = CantHorasCosto` (o `0`).

1. Si `ImporteCosto > 0`: `valor_hora_empleado = ImporteCosto / horas` (si las
   horas son 0, pasan a 1 con warning).
2. Si no, `PrecioHoraCosto` si es > 0.
3. Si no, `NULL`: costo histórico desconocido.

**Límites.** Horas de 0 a 9999,99 (con más decimales, se redondean con warning).
Precios hasta 9.999.999.999,99. Fuera de rango o negativo, la tarea da error.

**Total de la OT.** Se replica `calcular_precio_final_arreglo`
(`Σ horas × cantidad × precio`):

- `Total` mayor que la suma por más de $0,50: se agrega una tarea de ajuste
  `"Diferencia con el total de la OT del sistema anterior"` (1 hora, precio = la
  diferencia, sin empleado, sin categoría y sin costo).
- `Total` menor que la suma por más de $0,50: se ignora `Total` con warning
  `OT_TOTAL_MENOR_QUE_TAREAS`.
- Dentro de la tolerancia, o `Total` en 0: `precio_final` es la suma.
- Una OT sin tareas con `Total > 0` recibe solo la tarea de ajuste. Con `Total = 0`
  queda en $0 sin detalles.

**Cobro.** Los arreglos quedan **saldados sin movimientos**:
`total_cobrado = precio_final` y `precio_sin_iva = precio_final / 1,21`. No se
crean operaciones, cobros ni movimientos financieros. Por eso:

- no generan deuda en el resumen financiero del cliente;
- `rpc_cliente_cuenta_corriente` lista el cargo sin un cobro que lo compense;
- los ingresos del dashboard (`SUM(total_cobrado)`) incluyen el historial en sus
  fechas originales;
- un arreglo en $0 queda con `esta_pago = false`, como uno en $0 creado desde la
  app.

`IVA_RATE` es `0.21`, el default de `src/lib/ivaRate.ts`. Si producción define
otra alícuota, alinear la constante del script.

## Fechas

Las fechas sin zona horaria se interpretan como hora de Argentina con offset fijo
`-03:00`. Argentina no aplica horario de verano desde 2009, y el offset fijo evita
depender de `tzdata` en Windows. Formatos aceptados: `YYYY-MM-DD HH:MM:SS[.fff]`,
`YYYY-MM-DD` y `DD/MM/YYYY[ HH:MM[:SS]]`. Una fecha anterior a 1900, la centinela
`1900-01-01` o una posterior a mañana se tratan como inválidas.

## Idempotencia y recuperación

- **Archivo de estado.** Antes de cada lote se guardan los IDs planificados. Si
  el lote falla, se quitan. Si el proceso se corta entre el INSERT y la
  confirmación, la próxima ejecución encuentra esos IDs en la base y los
  reutiliza.
- **Al cargar el estado**:
  - si `tenant_id`, `taller_id` u `origen` no coinciden, es error fatal;
  - los IDs que ya no existen se descartan con warning;
  - un cliente base sin particular/empresa (corte a mitad de inserción) se borra
    y se vuelve a crear;
  - un arreglo sin tareas cuando se esperaban tareas se borra y se vuelve a crear.
- **Sin archivo de estado** se usan claves naturales: CUIT/DNI/CUIL para clientes,
  patente para vehículos, DNI (real o ficticio) y luego nombre para operarios,
  nombre para categorías y el marcador `extra_data->migracion->>id_ot` (con
  `origen = 'sistema-externo'`) para arreglos.
- **Riesgo residual:** sin archivo de estado, los clientes **sin documento** se
  duplican, y sus vehículos fallan con `VEHICULO_PATENTE_DE_OTRO_CLIENTE` porque
  la patente ya pertenece al cliente creado en la ejecución anterior. Las OTs
  igual se detectan como ya migradas por el marcador. Conservar el archivo de
  estado junto con los CSV.
- Lo ya migrado no se actualiza. Las tareas nuevas de una OT ya migrada se cuentan
  como "ya migradas" y no se agregan.

**Inserción.** Cada request a PostgREST es atómico. Los lotes que fallan se
dividen por bisección hasta aislar el registro. Los detalles de una OT nunca se
dividen entre requests. Si fallan, se borra su arreglo y la OT se informa con
`OT_DETALLES_FALLARON`. Si esa compensación falla, el script se detiene e informa
el UUID del arreglo para borrarlo a mano.

**Verificación.** Después de cada lote se relee cada arreglo y sus detalles:

- Si `precio_final` difiere del esperado, se iguala `total_cobrado` al valor de la
  base, con warning, para que el arreglo siga saldado.
- Si `valor_hora_empleado` difiere, la migración de base no está aplicada: el
  script se detiene. Lo ya insertado queda en el estado; aplicar la migración y
  re-ejecutar. Para limpiar lo creado:

  ```sql
  delete from arreglos
  where tenant_id = '<tenant>'
    and extra_data->'migracion'->>'origen' = 'sistema-externo';
  ```

## Limitaciones conocidas

- **Clientes sin documento:** se crean como particulares sin `dni_cuil` y se
  duplican si se pierde el archivo de estado (ver "Idempotencia y recuperación").
- **Empleados:**
  - DNI ficticio `99xxxxxx` en todos los operarios (el CSV no trae DNI);
  - `apellido = " "` cuando el nombre es una sola palabra. El formulario de
    empleados y la API validan con `trim()`, así que al editar ese empleado desde
    la UI se va a pedir el apellido.
- **Patentes fuera de formato** (`2006`, `6`): se importan tal cual. Revisar en el
  reporte que el cruce con las OTs sea correcto.
- **OTs sin vehículo resoluble:** fallan con `OT_VEHICULO_NO_RESUELTO` u
  `OT_SIN_PATENTE`. No se crean vehículos mínimos desde las OTs.
- **OTs resueltas por `IdVehiculo`:** se asume que la patente de la OT es un error
  de tipeo. El motivo del warning `OT_VEHICULO_RESUELTO_POR_ID_VEHICULO` muestra
  ambas patentes para revisarlas.
- **Cuenta corriente:** muestra los cargos históricos sin cobros asociados.
- **Datos del sistema anterior sin destino:** los de la OT quedan en
  `extra_data.migracion`; los de otras entidades se omiten (ver las tablas de
  mapeo).
- **Script de vehículos anterior:** `importar_vehiculos_tenant.py` no envía
  `tenant_id` a `particulares`/`empresas`, y esas inserciones fallan con
  `service_role` desde `20260921235106_tenant_identity_constraints.sql`. Este
  script sí lo envía. Corregir el anterior queda para un ticket aparte.

## Verificación manual sugerida

```sql
select count(*) from arreglos where extra_data->'migracion'->>'origen' = 'sistema-externo';

select id, precio_final, total_cobrado, esta_pago, es_facturable, estado, cliente_id, taller_id
from arreglos where extra_data->'migracion'->>'id_ot' = '<IdOT>';

select descripcion, horas_facturadas, precio_hora_facturada, horas_trabajadas,
       valor_hora_empleado, empleado_id, categoria_arreglo_id, created_at
from detalle_arreglo where arreglo_id = '<uuid>' order by created_at;
```

En la UI, verificar:

- que la ficha de un cliente migrado muestre saldo 0;
- que el detalle de un arreglo muestre líneas, horas, empleado, categoría y total;
- que un arreglo migrado se pueda editar y guardar sin error y conserve
  `extra_data.migracion`.
