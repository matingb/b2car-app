# Design

## Context

Ver `proposal.md` para la motivación. El flujo observado es `POST /api/arreglos` → `rpc_crear_arreglo_completo` → `_asignar_repuestos_existentes_a_arreglo` → `rpc_asignar_repuesto_existente_con_compra` → `_crear_operacion_con_stock`.

La variante de cinco argumentos del helper transmite la misma clave a cada línea. El creador de operaciones busca esa clave en `operaciones_movimiento_cuenta` y retorna anticipadamente si ya existe. El índice único es por tenant y clave, no por tipo de operación. El cobro inicial consulta la misma tabla con la clave original. Los presupuestos ya generan claves por línea y no usan este helper al activarse; el alta inline de productos nuevos tampoco recibe la clave raíz desde este flujo.

La fuente declarativa presente en este checkout es `supabase/database/schemas/`, aunque las instrucciones de base mencionan `supabase/schemas/`. Ambos son de solo lectura para agentes. Las modificaciones de funciones se entregan exclusivamente como migración.

## Goals / Non-Goals

**Goals:** resolver las colisiones con un cambio localizado, derivación estable, compatibilidad de firmas y comprobación de stock y finanzas contra PostgreSQL.

**Non-Goals:** hacer idempotente todo el alta, agrupar compras, cambiar la semántica de stocks repetidos, modificar cobros individuales o presupuestos, agregar una extensión o reparar movimientos históricos.

## Decisions

### 1. Derivar la clave dentro del helper de cinco argumentos

Recorrer `p_repuestos` con `WITH ORDINALITY` y orden explícito por posición. La posición es la del array original, empezando en 1; incluye también los elementos que no requieren compra. Convertir `stock_id` a UUID antes de serializar para normalizar su representación.

Si la clave raíz es nula, transmitir `NULL`. Si existe, calcular conceptualmente:

```sql
md5(format(
  'arreglo-compra:v1:%s:%s:%s',
  p_idempotency_key,
  v_stock_id,
  v_ordinal
))::uuid
```

El prefijo separa el propósito y fija una versión del contrato. El stock identifica el producto; la posición distingue apariciones repetidas sin alterar cómo se asignan hoy. La clave se calcula por elemento, no con un contador de compras que dependa del stock disponible. Conservar el orden del payload es parte de la estabilidad; un payload reordenado no representa el mismo reintento.

Se utiliza `md5(text)::uuid` como identificador determinístico interno de 128 bits, no como UUIDv4 ni UUIDv5. PostgreSQL ofrece [md5 en hexadecimal](https://www.postgresql.org/docs/current/functions-string.html) y acepta [UUID sin guiones](https://www.postgresql.org/docs/current/datatype-uuid.html), sin extensiones adicionales. No se usa para secretos ni autorización.

Alternativas descartadas: UUID aleatorio por ejecución, porque se acordó estabilidad derivada; stock como único componente adicional, porque no distingue posiciones repetidas; una compra agrupada, porque amplía el cambio de comportamiento y orquestación.

### 2. Conservar la clave original para el cobro

No modificar `rpc_crear_arreglo_completo`, el frontend ni los RPCs de compra individual y cobro. El helper pasa exclusivamente la clave derivada a `rpc_asignar_repuesto_existente_con_compra`. El cobro recibe la raíz como hasta ahora y no encuentra los pagos de compra bajo esa clave.

Mantener la variante legacy de tres argumentos, los parámetros por defecto, los permisos y la validación actual de cuentas y costos. No se persiste una clave nueva cuando el llamador omite la raíz.

### 3. Verificar comportamiento mediante API y SQL

Ampliar `src/tests/integration/arreglos/crearArregloRepuestos.integration.test.ts` para cubrir los escenarios de la spec con cuenta de saldo conocido y productos únicos por fixture. Comprobar cantidades efectivamente compradas, asignaciones, pagos, claves persistidas y saldo; no limitarse al status HTTP.

Usar un fixture nuevo `supabase/tests/arreglo_compras_idempotencia.sql`, con transacción y rollback, para llamadas directas sin clave y para verificar el contrato de derivación usando el helper real. El fixture puede ejercer un aumento de cantidad del mismo stock en posiciones sucesivas para comprobar que cada compra recibe su propia clave, conservando la semántica actual de cantidad final asignada. Validar las claves persistidas contra valores esperados y que una misma entrada produce el mismo resultado; evitar agregar una función pública solo para probar el hash.

El caso de rollback debe fallar después de una compra válida por una condición aceptada por la route y rechazada en el RPC, como faltar `precio_compra` en el segundo faltante. Comparar documentos, movimientos, asientos y saldos antes/después, sin asumir un status de validación nuevo.

## Risks / Trade-offs

- **Reintento del alta completa:** el RPC inserta un arreglo nuevo antes de procesar compras. Reutilizar la raíz después de un alta exitosa no ofrece idempotencia global; este cambio no incorpora esa garantía ni debe probarla como si existiera.
- **Orden y payload:** la posición es parte de la identidad. Cambiar el orden, cantidades o intención requiere una solicitud nueva; no se modifica el contrato de reintentos de los RPCs individuales.
- **Derivación por hash:** no existe garantía matemática de ausencia de colisiones de 128 bits. Se conserva el índice único existente y se prueba la separación de los casos representativos.
- **Entorno de pruebas:** `src/tests/integration/setup.ts` ejecuta `TRUNCATE auth.users CASCADE` antes de cada prueba. Ejecutar únicamente con autorización para resetear una base local descartable, verificando el destino tanto de `DATABASE_URL` como de `testClient`; no apuntar a bases con datos que se deban conservar.

## Migration Plan

1. Crear la migración con el CLI de Supabase y `CREATE OR REPLACE FUNCTION` sobre la firma de cinco argumentos, sin tocar datos, grants, índices ni schemas generados.
2. Obtener evidencia del fallo con las regresiones antes del cambio en una base descartable autorizada; aplicar allí la migración y repetirlas.
3. Ejecutar las suites relacionadas y el fixture SQL. Reportar por separado validaciones estáticas y de PostgreSQL.
4. Entregar la migración para el despliegue habitual. La aplicación a una base remota requiere una solicitud de despliegue posterior; no forma parte de esta planificación.
5. Si se requiere revertir el código, crear una migración compensatoria que restituya la definición previa del helper; eso reintroduce el bug. No revertir ni borrar pagos históricos como parte de ese rollback.
