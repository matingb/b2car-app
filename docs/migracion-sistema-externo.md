# Migración desde un sistema externo (B2C-188)

`scripts/migrar_sistema_externo_tenant.py` migra, a **un tenant y un taller**,
los clientes, vehículos, operarios, órdenes de trabajo (arreglos), tareas
(detalles de arreglo) y repuestos (productos, stock y repuestos del arreglo)
exportados por el sistema anterior en seis CSV.

Los IDs del sistema anterior se usan solo para cruzar los archivos. Nunca son
PK de B2Car: los IDs nuevos se generan con `uuid4`. La única excepción es la
operación de repuestos de cada arreglo, cuyo ID deriva del ID del arreglo
(`uuid5`) para poder borrarla en una recuperación.

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

# Repuestos como líneas de mano de obra, sin crear productos (en todas las ejecuciones):
python scripts/migrar_sistema_externo_tenant.py scripts/data/b2c188 --repuestos detalle --dry-run
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

El orden de migración es: clientes, vehículos, operarios, categorías, productos
(con su stock, solo en modo `productos`) y, por último, las OTs con sus tareas y
repuestos.

| Argumento | Uso |
| --- | --- |
| `directorio_csv` | Carpeta con `clientes.csv`, `vehiculos.csv`, `operarios.csv`, `ordenesTrabajo.csv`, `tareasEnOT.csv` y `repuestosEnOT.csv`. Los nombres no distinguen mayúsculas. |
| `--repuestos` | `productos` (por defecto): crea los productos con su stock y los asigna al arreglo como repuestos. `detalle`: agrega cada repuesto como una línea de mano de obra del arreglo, sin crear productos ni stock. Ver "repuestosEnOT.csv". No se pueden mezclar modos en un tenant. |
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
  muestra los contadores (tareas de ajuste, OTs con centavos de redondeo
  absorbidos, repuestos agrupados o con cantidad fraccionaria, productos con
  código generado o costo tomado del precio, operarios con DNI ficticio, etc.),
  los `IdDeposito` distintos y el importe total migrado.
- **Estado** (JSON): mapa `ID origen → ID B2Car` por entidad (clientes,
  vehículos por patente, operarios, categorías, productos y OTs). Solo contiene
  IDs y claves de producto (código o descripción normalizada).
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
{"migracion": {"origen": "sistema-externo", "id_ot": "1", "modo_repuestos": "productos", "id_cliente": "7", "id_vehiculo": "3",
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

### repuestosEnOT.csv

El argumento `--repuestos` decide el destino. En los dos modos aplican las mismas
reglas de filas (`Estado`, IDs, errores que hacen fallar la OT) y de importes.

#### Modo `detalle` → `detalle_arreglo`

Cada fila utilizada es una línea de mano de obra del arreglo. No se crean
productos, stock ni operaciones.

| Destino | Valor |
| --- | --- |
| `descripcion` | `Descripcion` (o `Codigo` si falta). Si `Cantidad` no es 1, se agrega ` x <cantidad>` (`Aceite 10 W 40 (Suelto) x 3,5`), así que las cantidades fraccionarias se conservan. |
| `cantidad`, `horas_facturadas` | 1 y 1. |
| `precio_hora_facturada` | `PrecioTotal × 1,21`: el importe exacto de la fila, sin precio unitario que redondear. |
| `horas_trabajadas`, `valor_hora_empleado` | 1 y `CostoReal × Cantidad`. Sin `CostoReal`, el costo es lo cobrado (contador `repuestos_costo_desde_precio`). |
| `empleado_id`, `categoria_arreglo_id` | `NULL`. |
| `created_at` | Después de las tareas, en orden de `IdRenglon`. |

Las filas repetidas no se agrupan: cada una es su propia línea. La descripción
del arreglo sigue siendo la de las tareas; si alguien edita el arreglo, la app la
recalcula con todas las líneas, incluidos los repuestos.

Con el export de B2C-188, este modo deja 10.031 OTs exactas, 89 con hasta $0,50
de diferencia y 6 tareas de ajuste (las OTs del export sin líneas y una diferencia
real).

#### Modo `productos` → `productos` + `stocks` + repuestos del arreglo

En B2Car un repuesto del arreglo es una línea de `operaciones_lineas` dentro de
una operación `ASIGNACION_ARREGLO` vinculada al arreglo por
`operaciones_asignacion_arreglo`. Las RPC de la app no se pueden usar con
`service_role`, así que el script inserta las filas directamente, con los mismos
valores que usa `rpc_set_asignacion_arreglo_linea`.

| Origen | Destino | Regla |
| --- | --- | --- |
| `Estado` | — | Solo se importan los `Utilizado`: son los que forman el `Total` de la OT. El resto (`Requerido`, `Cancelado`) se omite con warning `REPUESTO_NO_UTILIZADO`. |
| `IdOT` + `IdRenglon` | Reporte (`id_origen = IdOT-IdRenglon`) | Obligatorio y único. Si la OT no está en `ordenesTrabajo.csv`, error. |
| `Codigo` | `productos.codigo` | Identifica el producto (sin distinguir mayúsculas); se guarda en mayúsculas. |
| `Descripcion` | `productos.nombre` | Sin `Codigo`, la descripción normalizada (sin tildes ni mayúsculas) identifica el producto. El nombre es la descripción de la aparición más reciente. |
| `Cantidad` | `operaciones_lineas.cantidad` | Debe ser > 0. B2Car solo admite enteros: se redondea (mínimo 1) con warning `REPUESTO_CANTIDAD_FRACCIONARIA` y el precio unitario se ajusta para conservar el importe. |
| `PrecioTotal` | `operaciones_lineas.monto_unitario` | Ver "Reglas de importes". `PrecioUnitario` siempre viene en 0 y no se usa. |
| `CostoReal` | `productos.costo_unitario` | Costo por unidad. Ver "Productos". |
| `IdRepuesto` | Código generado | Solo para los productos sin `Codigo`. No identifica el producto: el sistema anterior reutiliza el mismo `IdRepuesto` para productos distintos. |
| `Marca`, `Tipo`, `Precio1..3`, `*Presup`, `MargenGanancia`, `CostoTotal`, `CodigoAlter`, resto | — | Sin destino. `Marca` es un ID de un catálogo no provisto. |

**Productos.** Se crea un producto por código (o por descripción, si no hay
código) con:

- `codigo`: el de origen o, si no hay, `MIG-<IdRepuesto>` de la primera
  aparición (`MIG-31`, `MIG-31-2`… si se repite);
- `precio_unitario` y `costo_unitario` de la aparición más reciente que tenga
  precio o costo, para que ambos sean del mismo momento. Si esa fila no trae
  `CostoReal`, el costo es el precio cobrado (contador
  `productos_costo_desde_precio`);
- `show_in_stock = false` (producto esporádico, como los que se crean desde un
  arreglo), `categorias = {}`, sin marca ni proveedor.

Un producto del tenant con el mismo código (sin distinguir mayúsculas ni
espacios) se reutiliza sin modificarlo. Si hay más de uno, error
`PRODUCTO_AMBIGUO` y las OTs que lo usan no se importan.

**Stock.** Cada producto tiene un `stocks` en `TALLER_ID` con `cantidad`,
`stock_minimo` y `stock_maximo` en 0. Si ya existe, se reutiliza. La migración
no registra compras ni descuenta stock.

**Líneas del arreglo.** Una operación por arreglo (`fecha` = la del arreglo) y una
línea por producto: la app admite una sola línea por producto y operación, así
que las filas repetidas de la OT se suman con warning `REPUESTO_AGRUPADO`. Cada
línea lleva `delta_cantidad = -cantidad` (la convención de la app, que calcula
el movimiento de stock de una edición con ese valor), sin categoría ni empleado
(`IdOperario` viene en 0). La descripción del arreglo no incluye los repuestos,
igual que en la app.

Un repuesto con error (cantidad inválida, importe negativo, ID repetido, sin
código ni descripción o producto no creado) hace fallar **su OT completa**, igual
que una tarea.

## Reglas de importes

Todos los cálculos usan decimales exactos con redondeo *half up* a 2 decimales.
**Nunca** se usan tarifas actuales del operario ni del taller para valorizar el
historial.

**IVA.** En el sistema anterior los importes de tareas y repuestos son **netos**
y el `Total` de la OT es `(Σ tareas + Σ repuestos utilizados) × 1,21` (así
cierran 10.130 de las 10.503 OTs del export de B2C-188, con hasta 3 centavos de
diferencia; 364 más tienen todo en 0). En B2Car las líneas del arreglo incluyen
IVA (`precio_sin_iva = precio_final / 1,21`), así que **los importes de venta de
tareas y repuestos se multiplican por 1,21** (`IVA_ORIGEN`). Los costos (de
operario y `CostoReal`) se conservan como vienen.

**Venta (por tarea).** La columna de total tiene prioridad:

1. Si `ImporteHorasVenta > 0`: `horas = CantHorasVenta` (o `1` si es 0) y
   `precio_hora = ImporteHorasVenta × 1,21 / horas`. Si `PrecioHoraVenta × horas`
   difiere del importe (ambos netos) en más de $0,50, hay warning y manda el importe.
2. Si no, con `PrecioHoraVenta > 0` y `CantHorasVenta > 0`, se usan esos valores
   (`precio_hora = PrecioHoraVenta × 1,21`).
3. Si no, subtotal 0 (`precio_hora = 0`, nunca `NULL`) con warning
   `TAREA_SIN_IMPORTE_VENTA`.

**Venta (por repuesto).** `importe = PrecioTotal × 1,21`, redondeado. En modo
`detalle` ese es el precio de la línea. En modo `productos`, las filas del mismo
producto en la OT se suman, y
`monto_unitario = Σ importe / cantidad`, **truncado** a centavos para que
`cantidad × monto_unitario` nunca supere lo cobrado (con gas cobrado por gramo,
por ejemplo, 800 g × $6,655 no entra en centavos). `PrecioTotal` en 0 da subtotal
0 con warning `REPUESTO_SIN_IMPORTE_VENTA`.

**Costo (por tarea).** `horas_trabajadas = CantHorasCosto` (o `0`).

1. Si `ImporteCosto > 0`: `valor_hora_empleado = ImporteCosto / horas` (si las
   horas son 0, pasan a 1 con warning).
2. Si no, `PrecioHoraCosto` si es > 0.
3. Si no, `NULL`: costo histórico desconocido.

**Límites.** Horas de 0 a 9999,99 (con más decimales, se redondean con warning).
Precios hasta 9.999.999.999,99. Fuera de rango o negativo, la tarea o el repuesto
da error.

**Total de la OT.** Se replica `calcular_precio_final_arreglo`
(`Σ horas × cantidad × precio` de las tareas + `Σ cantidad × monto_unitario` de
los repuestos):

- Llevar cada línea a final y a precio unitario deja centavos de diferencia con
  `Total`. Si la diferencia es de hasta $0,50, se suma a la primera línea con
  cantidad 1 (repuesto) u horas 1 (tarea) para que el arreglo cierre exacto
  (contador `ots_centavos_de_redondeo_absorbidos`). Si no hay una línea así,
  queda la diferencia.
- `Total` mayor que la suma por más de $0,50: se agrega una tarea de ajuste
  `"Diferencia con el total de la OT del sistema anterior"` (1 hora, precio = la
  diferencia, sin empleado, sin categoría y sin costo). Se registra el warning
  `OT_AJUSTE_TOTAL_GENERADO` con la suma de tareas y repuestos, el total y la
  diferencia. Suele ser el resto del precio unitario truncado o una OT del export
  sin sus líneas.
- `Total` menor que la suma por más de $0,50: se ignora `Total` con warning
  `OT_TOTAL_MENOR_QUE_TAREAS`.
- `Total` en 0: `precio_final` es la suma.
- Una OT sin líneas con `Total > 0` recibe solo la tarea de ajuste. Con `Total = 0`
  queda en $0 sin detalles.

Con el export de B2C-188, el dry-run en modo `productos` deja 9.862 OTs exactas,
258 con hasta $0,50 de diferencia, 327 tareas de ajuste (320 de hasta $10) y 1 OT
con `Total` menor. En modo `detalle`: 10.031 exactas, 89 con hasta $0,50, 6
tareas de ajuste y la misma OT con `Total` menor.

**Cobro.** Los arreglos quedan **saldados sin movimientos**:
`total_cobrado = precio_final` y `precio_sin_iva = precio_final / 1,21`. No se
crean cobros ni movimientos financieros (las únicas operaciones son las de
asignación de repuestos, que no mueven cuentas). Por eso:

- no generan deuda en el resumen financiero del cliente;
- `rpc_cliente_cuenta_corriente` lista el cargo sin un cobro que lo compense;
- los ingresos del dashboard (`SUM(total_cobrado)`) incluyen el historial en sus
  fechas originales;
- un arreglo en $0 queda con `esta_pago = false`, como uno en $0 creado desde la
  app.

`IVA_RATE` es `0.21`, el default de `src/lib/ivaRate.ts`. Si producción define
otra alícuota, alinear la constante del script. `IVA_ORIGEN` es la alícuota con
la que el sistema anterior calculó `Total` y no depende de B2Car.

**Costo de los repuestos.** B2Car no guarda costo por línea: los dashboards y el
detalle del arreglo calculan `cantidad × productos.costo_unitario` con el costo
**actual** del producto. Para el historial ese costo es el de la aparición más
reciente, así que el margen de una OT antigua no refleja el costo de su época.

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
  - un arreglo sin tareas cuando se esperaban tareas, o sin repuestos cuando se
    esperaban repuestos, se borra (con su operación de repuestos) y se vuelve a
    crear.
- **Sin archivo de estado** se usan claves naturales: CUIT/DNI/CUIL para clientes,
  patente para vehículos, DNI (real o ficticio) y luego nombre para operarios,
  nombre para categorías, código para productos (también el generado `MIG-…`),
  `(taller, producto)` para stocks y el marcador `extra_data->migracion->>id_ot`
  (con `origen = 'sistema-externo'`) para arreglos.
- **Modo de repuestos:** el estado guarda el `--repuestos` usado (después de
  confirmar que lo ya migrado es compatible) y cada arreglo lo guarda en
  `extra_data.migracion.modo_repuestos`. Si el estado o un arreglo migrado tienen
  otro modo, o si en modo `detalle` algún arreglo migrado ya tiene repuestos
  asignados (también los migrados por una versión del script que no guardaba el
  modo), el script se detiene antes de escribir. Para cambiar de modo, limpiar lo
  migrado (ver "Verificación") y borrar el archivo de estado.
- **Códigos generados:** `MIG-<IdRepuesto>` depende de la primera aparición de
  cada descripción. Es estable mientras el CSV solo sume OTs nuevas; si se
  re-exporta con otro contenido y sin el estado, un código puede apuntar a otro
  producto. Un producto del tenant que ya tenga un código `MIG-…` se reutiliza.
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
`OT_DETALLES_FALLARON`. Los repuestos se insertan después, en tres requests
(operaciones, vínculos y líneas, en ese orden porque los triggers de las líneas
buscan el arreglo por el vínculo). Si alguno falla, se borran las operaciones del
paquete antes de dividirlo; si falla una OT aislada, se borra también su arreglo
y se informa `OT_REPUESTOS_FALLARON`. Si una compensación falla, el script se
detiene e informa los UUID para borrarlos a mano.

**Verificación.** Después de cada lote se relee cada arreglo, sus detalles y sus
líneas de repuestos:

- Si `precio_final` difiere del esperado, se iguala `total_cobrado` al valor de la
  base, con warning, para que el arreglo siga saldado.
- Si `valor_hora_empleado` difiere, la migración de base no está aplicada: el
  script se detiene. Lo ya insertado queda en el estado; aplicar la migración y
  re-ejecutar.
- Si una línea de repuesto no está o cambió su stock, cantidad o monto, un
  trigger no contemplado la modificó: el script se detiene.

Para limpiar los arreglos creados (las operaciones de repuestos primero, porque
no caen en cascada con el arreglo):

```sql
delete from operaciones o
using operaciones_asignacion_arreglo oaa, arreglos a
where oaa.operacion_id = o.id
  and a.id = oaa.arreglo_id
  and a.tenant_id = '<tenant>'
  and a.extra_data->'migracion'->>'origen' = 'sistema-externo';

delete from arreglos
where tenant_id = '<tenant>'
  and extra_data->'migracion'->>'origen' = 'sistema-externo';
```

Los productos creados son los de la sección `productos` del estado (los de
código generado empiezan con `MIG-`); al borrarlos caen sus stocks.

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
- **Repuestos en modo `productos`:**
  - el costo es uno por producto (el más reciente), no por línea: el margen de
    las OTs antiguas usa ese costo (ver "Reglas de importes");
  - las cantidades fraccionarias (aceite suelto, líquido de freno, sellador) se
    redondean a enteros, mínimo 1. El importe se conserva, pero el costo del
    dashboard (`cantidad × costo_unitario`) usa la cantidad redondeada;
  - con código de origen, el producto toma la descripción más reciente; las OTs
    antiguas muestran ese nombre aunque su descripción haya sido otra;
  - el stock queda en 0. Los repuestos migrados no descuentan stock, pero sus
    líneas tienen `delta_cantidad = -cantidad`: si se borra una de esas líneas
    desde la app, la cantidad vuelve al stock;
  - los productos de OTs que fallan se crean igual, como las categorías.
- **Repuestos en modo `detalle`:** no hay productos ni stock, así que el
  inventario no los conoce. Se ven como mano de obra: su costo queda como costo de
  mano de obra sin empleado (1 hora trabajada a `CostoReal × Cantidad`) y suman a
  los totales por categoría como "sin categoría".
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

select p.codigo, p.nombre, ol.cantidad, ol.monto_unitario, ol.delta_cantidad, p.costo_unitario
from operaciones_asignacion_arreglo oaa
join operaciones_lineas ol on ol.operacion_id = oaa.operacion_id
join stocks s on s.id = ol.stock_id
join productos p on p.id = s.producto_id
where oaa.arreglo_id = '<uuid>' order by ol.created_at;
```

En la UI, verificar:

- que la ficha de un cliente migrado muestre saldo 0;
- que el detalle de un arreglo muestre líneas, horas, empleado, categoría y total;
- que los repuestos del arreglo muestren producto, cantidad y precio, y que el
  total coincida con el `Total` de la OT del sistema anterior;
- que un arreglo migrado se pueda editar y guardar sin error y conserve
  `extra_data.migracion`, también sin tocar sus repuestos (stock en 0);
- que los productos migrados aparezcan en inventario con el filtro de esporádicos.
