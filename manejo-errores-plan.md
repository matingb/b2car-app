# Plan de Implementación — Manejo de Errores en API Routes

**Objetivo**: que el usuario vea el motivo real de cada falla, y que cuando haya un error interno quede en Vercel un log completo que se pueda encontrar en segundos a partir de lo que ve el usuario.

**Base del relevamiento**: rama `dev`, commit `b88521d` (2026-09-30). Se revisaron las 57 API Routes (`src/app/api/**/route.ts`), sus services/repositories, los clients (`src/clients/`), los providers (`src/app/providers/`) y las funciones SQL vigentes (`supabase/migrations/`).

**Actualización (2026-10-01, commit `672f749`)**: la fase 1 está implementada. Se agrega la **fase 1b**: un handler común, `createApiHandler`, que pasa a ser el punto de entrada de las rutas en lugar de `withApiErrors`. El handler orquesta errores, contexto, logging, permisos y plan. La lectura y validación del input quedan explícitas en cada controller, usando helpers independientes. Las fases 2, 3, 4 y 7 se ajustaron para usarlo.

**Actualización (2026-10-01, commit `16924c7`)**: la fase 1b está implementada, con las dos rutas piloto. Lo que se decidió durante la implementación ya está volcado en el plan (ver [1b.7](#1b7-decisiones-tomadas-al-implementar)):
- los controllers usan `ctx` sin desestructurarlo;
- la validación del input queda en el controller, no en el handler;
- se eliminaron `withApiErrors`, `unauthorizedResponse` y `forbiddenResponse`;
- los pilotos no usan `errorBody`.

Cada fase es un PR independiente que deja el sistema estable. La fase 1b va antes de migrar rutas, porque la receta de la fase 2 se apoya en ella. Las fases 2.1 y 2.2 son las de más impacto para soporte. La fase 6 (base de datos) puede avanzar en paralelo.

---

## Reglas Transversales

> [!IMPORTANT]
> **Compatibilidad del contrato**: el campo `error` de la respuesta **sigue siendo un `string`** listo para mostrar. Hoy los ~83 `fetch` del frontend leen solamente `body.error`. Los campos nuevos (`code`, `errorId`) son aditivos, así que ningún client se rompe al migrar el backend.
>
> **Sin `data` en los errores**: las rutas migradas responden los errores solo con `{ error, code, errorId? }`. Los clients revisados (categorías, finanzas y arreglos) no dependen de `data` ni de `page` cuando `!res.ok`: si faltan, usan su propio valor por defecto. La opción `errorBody` del handler se usa solo si un client lee otro campo del body en un error.
>
> **Logging**: solamente con `logger` de `@/lib/logger` (ver `CLAUDE.md`). No loguear bodies completos de requests, credenciales, certificados, tokens ni datos personales innecesarios. Loguear ids (arreglo, operación, cuenta) y el error de la BD.
>
> **Qué se expone al usuario**:
> - **Sí** se expone el `message` de errores levantados con `RAISE EXCEPTION` en nuestras funciones SQL (códigos `22023`, `P0001`, `P0002`, `55000`, `55001`, `P1791`), porque los redactamos nosotros y están en español.
> - **Nunca** se expone el `message` crudo de errores de Postgres/PostgREST (`23xxx`, `42xxx`, `PGRSTxxx`, etc.), porque trae nombres de tablas y constraints, en inglés. Para esos casos se usa un mensaje mapeado.
> - En los 5xx se devuelve un mensaje genérico **más un `errorId`**, que también se escribe en el log.
>
> **Punto de entrada**: cada método de un Route Handler se exporta con `createApiHandler` (fase 1b). La sesión de Supabase la sigue gestionando el middleware de Next. Ver [Capas de un API Route](#capas-de-un-api-route).

## Gate de Verificación (al final de cada fase)

```bash
npm run lint
npm run build             # debe pasar sin errores TypeScript
npm run test              # tests unitarios
npm run test:integration  # obligatorio en la fase 6; recomendado en el resto
```

> [!CAUTION]
> Si cualquier comando falla, la fase **no está completa**. Corregir antes de pedir revisión.

---

## Capas de un API Route

```
Request /api/*
  │
  ▼
middleware de Next + updateSession()     → sesión: renueva tokens y cookies de Supabase,
  src/middleware.ts                         corta requests sin sesión (401 JSON en /api, fase 3)
  src/supabase/middleware.ts
  │
  ▼
createApiHandler(options, controller)    → errores, contexto (cliente + claims → actor),
  src/app/api/apiHandler.ts                 logging, permisos y plan
  │
  ▼
controller(ctx)                          → lectura y validación de input, lógica del endpoint
  │
  ▼
services / repositories / RPC            → acceso a datos; aislamiento por tenant con RLS
```

| Capa | Hace | No hace |
|---|---|---|
| Middleware (`middleware.ts` en Next 15; en Next 16 pasa a llamarse `proxy.ts`) | Renueva la sesión con `auth.getUser()` y escribe las cookies. Corta los requests sin sesión. | Permisos, plan, validación ni errores de negocio. |
| `createApiHandler` | Valida los claims y arma el contexto una sola vez por request. Corta con 401, 403 o 400. Convierte toda falla en el contrato JSON y la loguea. | Reemplazar al middleware en la gestión de la sesión. Tampoco reglas de negocio ni acceso a datos. |
| Controller | Lee y valida el input con helpers, llama a los services y arma la respuesta. Falla con `ctx.fail(…)` o `throw new ApiError(…)`. | Leer la sesión (`getSession`/`getClaims`), chequear permisos (`requirePermission`/`hasUserPermission`), armar un `status: 500` a mano ni usar `try/catch` genéricos. |

> [!NOTE]
> El handler valida los claims aunque el request ya haya pasado por el middleware. Es defensa en profundidad, y además cubre las rutas que hoy no están en el `matcher` del middleware (ver fase 3). El aislamiento por tenant sigue en la BD (RLS y RPCs que leen el `tenant_id` del JWT). `ctx.actor.tenantId` se usa para los logs y para las consultas que necesitan el tenant explícito.

---

## Diagnóstico (resumen)

El detalle de cada caso está en el [Anexo A](#anexo-a--casos-concretos-relevados).

1. **El error original se pierde en la capa de services.** `toServiceError()` ([serviceError.ts:22](src/app/api/serviceError.ts#L22)) convierte el `PostgrestError` en un enum y lo descarta. En general nadie lo loguea antes: por ejemplo, [arregloRepository.ts](src/app/api/arreglos/arregloRepository.ts) hace 14 conversiones sin ningún log. La ruta ya no tiene ni el mensaje ni el código, así que no aparece en la UI ni en Vercel.
2. **El mapeo de códigos es incompleto o incorrecto**:
   - `22023` (validaciones de negocio con mensaje claro), `23503`, `42501` y `28000` terminan como `Unknown`, o sea 500 genérico.
   - `P0001` se traduce a "Stock insuficiente", pero es el código por defecto de **cualquier** `RAISE EXCEPTION` sin `ERRCODE`. Hay **21 funciones vigentes con 73 raises** en esa situación. Ejemplo: borrar una venta facturada muestra "Stock insuficiente".
   - `rpcErrorMessage()` ([finanzasRouteUtils.ts:588](src/app/api/cuentas-financieras/finanzasRouteUtils.ts#L588)) le asigna 400 a `22023`, pero reemplaza el mensaje de la BD por el genérico.
3. **El patrón `error === ServiceError.NotFound || !data` devuelve 404 ante cualquier error de BD.** Aparece en 11 lugares.
4. **No hay un contrato común**. Hay strings genéricos, `error.message` crudo de Postgres, códigos en inglés (`Unauthorized`, `FORBIDDEN_INSUFFICIENT_PERMISSIONS`, `FEATURE_NOT_AVAILABLE_FOR_PLAN`, `Unknown`) y en turnos `error` es a veces un objeto y a veces un string.
5. **En el frontend** hay providers que se tragan errores, pantallas que muestran éxito aunque la operación falle, mensajes hardcodeados, y ningún manejo para respuestas que no son JSON. Además, el middleware redirige las `/api/*` sin sesión a `/login` con un 200 HTML.
6. **No hay un punto de entrada común** (relevado el 2026-10-01). Cada ruta resuelve la sesión y los permisos a su manera. Estos son los archivos que usan cada mecanismo (hay solapamientos):
   - `getSession()`: 6 archivos. En el servidor no valida el JWT.
   - `getClaims()` inline: 6.
   - `requirePermission()`: 21.
   - Los `requireTenant*` de facturación: 13.
   - `hasUserPermission()`: 8.

   Además, 13 archivos no tienen ningún chequeo de sesión en el `route.ts` y dependen solo del middleware y de RLS. Un mismo request llega a hacer varios `createClient()` y `getClaims()`: `GET /api/arreglos/[id]` hace 3 `getClaims()`. Y el `matcher` del middleware no incluye `/api/categorias-arreglo`, `/api/cuentas-financieras`, `/api/empleados`, `/api/gastos` ni `/api/fiscal/persona`.

---

## Fase 1 — Infraestructura común (helper, contrato y causa original) ✅ Implementada

**Estado**: implementada en `9d809b6` y `672f749`. Los tests de la fase pasan al 2026-10-01: 142 tests en `apiError`, `serviceError`, `finanzasRouteUtils` e `instrumentation`. Desde la fase 1b, las rutas usan `apiErrorResponse` a través de `createApiHandler`. Las rutas de finanzas que todavía no migraron aprovechan `mapDbError` a través de `rpcStatus`/`rpcErrorMessage`.

| Ítem | Estado | Dónde |
|---|---|---|
| 1.1 Códigos y mensajes compartidos (`ApiErrorCode`, `ApiErrorBody`, `API_ERROR_MESSAGES`), sin `server-only` | ✅ | [apiErrorCodes.ts](src/lib/apiErrorCodes.ts) |
| 1.2 `mapDbError`, `apiErrorResponse` y `ApiError` | ✅ `withApiErrors`, `unauthorizedResponse` y `forbiddenResponse` también se implementaron, pero se eliminaron en la fase 1b: su rol lo tomó `createApiHandler` y no tenían usos | [apiError.ts](src/app/api/apiError.ts) |
| 1.3 `cause` en `ServiceResult`, `serviceFailure`, y `P0001` como stock solo con `STOCK_INSUFICIENTE` | ✅ No se agregaron los valores opcionales `Validation`/`InUse`/`Forbidden` al enum, y no hacen falta: la decisión pasa por `cause` | [serviceError.ts](src/app/api/serviceError.ts) |
| 1.4 `rpcStatus`/`rpcErrorMessage` como wrappers de `mapDbError` (cubre `22023`, `P0001`, `P0002` y `28000` → 401) | ✅ | [finanzasRouteUtils.ts:568-577](src/app/api/cuentas-financieras/finanzasRouteUtils.ts#L568-L577) |
| 1.5 `onRequestError`, sin query string en el `path` | ✅ | [instrumentation.ts](src/instrumentation.ts) |

### Tabla de mapeo vigente (`mapDbError`)

| Código BD | Status | `code` | Mensaje al usuario |
|---|---|---|---|
| `PGRST116`, `P0002` | 404 | `NOT_FOUND` | `opts.notFoundMessage`. Para `P0002`, el mensaje de la BD si existe |
| `22023` | 400 | `VALIDATION` | **mensaje de la BD** |
| `P1791` | 400 | `VALIDATION` | mensaje de la BD |
| `22P02`, `22003`, `22007`, `23502`, `23514` | 400 | `VALIDATION` | `INVALID_FORMAT` |
| `23505` | 409 | `CONFLICT` | `opts.constraintMessages[constraint]` si matchea; si no, `CONFLICT` |
| `23503` con `details` "is still referenced" | 409 | `IN_USE` | `IN_USE` |
| `23503` (otro caso) | 400 | `VALIDATION` | `INVALID_REFERENCE` |
| `42501` | 403 | `FORBIDDEN` | `FORBIDDEN` |
| `28000`, `PGRST301`, `PGRST303` | 401 | `UNAUTHORIZED` | `UNAUTHORIZED` |
| `55000`, `55001` | 409 | `INMUTABLE` | mensaje de la BD |
| `57014` | 503 | `TIMEOUT` | `TIMEOUT` |
| `P0001` con `STOCK_INSUFICIENTE` en el mensaje | 409 | `STOCK_INSUFICIENTE` | `STOCK_INSUFICIENTE` |
| `P0001` con `JWT sin tenant_id` | 401 | `UNAUTHORIZED` | `UNAUTHORIZED` |
| `P0001` con `no encontrad` | 404 | `NOT_FOUND` | mensaje de la BD |
| `P0001` (resto) | 400 | `VALIDATION` | mensaje de la BD |
| cualquier otro | 500 | `INTERNAL` | `opts.fallback` + `errorId` |

Si el mensaje de la BD viene vacío en `22023`, `P1791` o `P0001`, se usa `opts.fallback`. En cualquier 5xx, salvo `TIMEOUT`, el mensaje al usuario es siempre `opts.fallback`, incluso para un `ApiError(500, …)` explícito.

> [!NOTE]
> Las reglas de `P0001` basadas en el texto del mensaje son transitorias. Cuando esté hecha la fase 6, todas las excepciones de negocio van a tener un `ERRCODE` explícito y esas reglas se pueden quitar, salvo la de `STOCK_INSUFICIENTE`.

**Mapeo de valores de `ServiceError`** (para rutas que todavía no tienen `cause`):
- `NotFound`/`NoClienteAsignado` → 404
- `Conflict` → 409
- `StockInsuficiente` → 409
- `ArregloFacturado`/`MovimientoFinancieroInmutable` → 409 `INMUTABLE`, con el mensaje que tenía `rpcErrorMessage`
- `HorasFacturadasInmutables` → 400
- `Unknown` → 500

**Logging**: en los 5xx, `logger.error` con el error original completo y su stack. En los 4xx, `logger.warn` con el mismo payload, sin stack. El `errorId` aparece en el texto del log para poder buscarlo en Vercel.

### Revisión a partir de la fase 1b

- **`withApiErrors` se eliminó** ✅. El `try/catch` que convierte excepciones en el contrato JSON quedó adentro de `createApiHandler`, y ninguna ruta lo usaba.
- **`apiErrorResponse` sumó dos opciones** ✅:
  - `errorId?: string`: si viene, se usa en lugar de generar uno. El handler le pasa su `requestId`, así la referencia que ve el usuario en un 5xx coincide con todas las líneas de log de ese request, no solo con la del error.
  - `mapError?: (error: unknown) => MappedApiError | null`: un mapeo propio de un dominio, que se evalúa antes del mapeo común. Lo usa facturación en la fase 4.
- **`unauthorizedResponse`/`forbiddenResponse` se eliminaron** ✅. El handler corta solo, con el `ApiError` que tiran `buildApiContext` y `assertPermission`. El adaptador de `requirePermission` de la fase 3 llama a `apiErrorResponse` directamente.
- **`ApiErrorStatus`** suma `422` cuando se migre facturación (fase 4).

### Criterios de aceptación
- [x] `apiError.ts` tiene tests table-driven que cubren **cada fila** de la tabla de mapeo, el mapeo de `ServiceError`, `constraintMessages`, la presencia y ausencia de `errorId`, y que en 5xx el `message` crudo nunca aparece en el body.
- [x] Una excepción no capturada devuelve JSON 500 con `errorId`. Primero lo cubría `withApiErrors`; desde la fase 1b lo cubre `apiHandler.test.ts`.
- [x] `toServiceError({ code: "P0001", message: "No se puede modificar una venta…" })` devuelve `Unknown`, no `StockInsuficiente`.

---

## Fase 1b — Handler genérico de API Routes (`createApiHandler`) ✅ Implementada

**Estado**: implementada en `16924c7`, con las dos rutas piloto. Al 2026-10-01:
- pasan 158 tests en los helpers, el handler, `logger`, `permissions.server` y los dos pilotos;
- `npm run build` pasa;
- `npm run lint` falla solo por 5 errores previos de `no-require-imports` en `scripts/importar_productos_tenant.js`, un archivo que esta fase no toca;
- `tsc --noEmit` falla solo por 4 errores previos en `ClienteFormFields.layout.test.tsx`.

**Entrega**: un punto de entrada único para los Route Handlers, que orquesta errores, contexto, logging, permisos y plan, con cada responsabilidad en un helper independiente. Cada controller lee y valida su input. Se migran dos rutas piloto para validar la API antes de la fase 2.
**Tamaño**: M

### 1b.1 Principios de diseño

- **Secuencia fija, no un framework de middlewares.** `createApiHandler` ejecuta siempre los mismos pasos en el mismo orden. No hay `use()`, ni registro dinámico, ni un array de middlewares. Cada paso es una función exportada desde su propio módulo, tiene sus propios tests y se puede llamar directo desde un controller si hace falta.
- **Permisos por opciones; input en el controller.** Sin `permission` no se exige ningún permiso. El handler nunca lee el body ni valida params o query. La carga de los permisos efectivos del actor se hace siempre (ver 1b.3). Se evaluó sumar opciones `body`/`params` con un parser y se descartó por ahora (ver 1b.7).
- **El handler solo orquesta.** `apiHandler.ts` no mapea errores, no consulta permisos y no valida campos: llama a los helpers. Si una función empieza a crecer adentro del handler, se mueve a su propio módulo.
- **Migrar no cambia la autorización.** Si una ruta hoy no exige un permiso, la migración no lo agrega. Agregarlo es una decisión de producto aparte.
- **Un paso nuevo entra cuando lo piden al menos dos rutas reales.** Hasta entonces, esa lógica vive en el controller. Por ahora quedan afuera:
  - rate limiting;
  - idempotencia genérica (finanzas ya la maneja con `idempotencyKey` en el body);
  - rutas públicas sin sesión (hoy no hay ninguna);
  - exigir rol admin (solo lo usa facturación).

### 1b.2 Pasos del handler

| # | Paso | Helper | Si falla |
|---|---|---|---|
| 1 | `requestId` y logger con scope | `createScopedLogger` en [logger.ts](src/lib/logger.ts) | — |
| 2 | Contexto: un cliente Supabase, los claims validados como `actor` y los permisos efectivos | `buildApiContext` en `apiContext.ts` | 401 `UNAUTHORIZED` |
| 3 | Permiso requerido y restricción de plan | `assertPermission` en `apiAccess.ts` | 403 `FORBIDDEN` o 403 `FEATURE_NOT_AVAILABLE_FOR_PLAN` |
| 4 | Resolver `segment.params` y pasarlos sin validar | — | excepción capturada por el handler |
| 5 | Controller: lee y valida su input, luego ejecuta la lógica del endpoint | `parseInput` y `readJsonBody` en `apiInput.ts` | 400 `VALIDATION` si falla el input; el resto según lo que devuelva o tire |
| 6 | Errores (envuelve los pasos 2 a 5) | `apiErrorResponse` en [apiError.ts](src/app/api/apiError.ts) | JSON con `code`; en 5xx, `errorId` igual al `requestId` |
| 7 | Log de acceso en nivel `debug`: método, ruta, status, duración y `requestId` | logger | — |

El orden es intencional: la sesión va antes que los permisos, y los permisos antes que leer el body. Así, un request sin acceso se rechaza sin procesar el input.

El log de acceso queda en `debug` porque Vercel ya registra cada request con su status y duración. Con el nivel `info` por defecto no agrega ruido.

### 1b.3 Archivos

Todos llevan `import "server-only"` y se ubican junto a `apiError.ts` y `serviceError.ts`.

**`src/app/api/apiContext.ts` (nuevo): contexto del request**

```ts
export type ApiActor = {
  userId: string;
  tenantId: string;
  role: UserRoleValue;
  plan: SubscriptionPlanValue;
};

export type ApiContext = {
  supabase: SupabaseClient;
  actor: ApiActor;
  permissions: readonly PermissionValue[];
  can(permission: PermissionValue): boolean;
};

export async function buildApiContext(): Promise<ApiContext>;
```

- Hace **un** `createClient()` y **un** `getClaims()` por request. `getClaims()` valida el JWT, a diferencia de `getSession()`.
- Valida y normaliza los claims `sub` y `tenant_id` (tienen que ser UUID válidos), `user_role` (con `normalizeUserRole`) y `plan_sub` (con `normalizeSubscriptionPlan`). Si alguno falta o no es válido, tira `ApiError(401, API_ERROR_MESSAGES.UNAUTHORIZED, "UNAUTHORIZED")`. Es el mismo criterio que hoy aplican `requirePermission` para el rol y el plan, y `mapDbError` para `JWT sin tenant_id`.
- Carga los permisos efectivos con `fetchEffectivePermissions`, que ya los cachea entre requests por rol y plan (`unstable_cache`). Se cargan siempre, por dos motivos:
  - `can()` pasa a ser síncrono.
  - Ningún chequeo de permisos queda para después de una mutación (caso 19 del Anexo A).

  Hoy, en cambio, `hasUserPermission()` repite el `getClaims()` en cada llamada.
- No reemplaza al middleware: la renovación de la sesión y las cookies siguen ahí. Tampoco consulta `tenant_members`, porque sería una query más en cada request. Facturación mantiene esa validación más estricta (fase 4).

**`src/app/api/apiAccess.ts` (nuevo): permisos y plan**

```ts
export async function assertPermission(
  ctx: ApiContext,
  required: PermissionValue | readonly PermissionValue[],
): Promise<void>;
```

- Exige todos los permisos indicados, igual que hoy `requireTenantPlanPermission`.
- Si falta uno, distingue el motivo según lo que otorga el plan. Para eso usa `fetchPlanPermissions`, una función nueva en [permissions.server.ts](src/lib/permissions.server.ts) que se cachea igual que `fetchEffectivePermissions` y solo se consulta en este camino:
  - Si el plan no otorga el permiso → 403 `FEATURE_NOT_AVAILABLE_FOR_PLAN`, con el mensaje `API_ERROR_MESSAGES.FEATURE_NOT_AVAILABLE_FOR_PLAN`.
  - Si el plan lo otorga, falta por el rol → 403 `FORBIDDEN`.
- `fetchPlanPermissions` comparte el tag `permissions` de la caché. `invalidatePermissionsCache(rol, plan)` invalida también los permisos de ese plan, para que el motivo de la denegación no salga de una caché vieja.
- Si falla la consulta de permisos, la excepción sigue de largo y termina en un 500 con `errorId`. Hoy `requirePermission` responde "Error al verificar permisos" sin referencia.
- **No hay una opción `plan` separada.** `plan_permissions` ya es la fuente de verdad del tiering, y una opción aparte duplicaría esa regla en el código. Si alguna vez una restricción de plan no se puede modelar como permiso, la opción se agrega en ese momento.

**`src/app/api/apiInput.ts` (nuevo): validación de input**

```ts
/** Mismo contrato que usan hoy los validators de finanzas. */
export type Validated<T> = { value?: T; error?: string };
export type Parser<T, Raw = unknown> = (raw: Raw) => Validated<T>;

export async function readJsonBody(req: Request): Promise<unknown>;      // JSON roto → 400 "JSON inválido"
export function parseInput<T, Raw>(parser: Parser<T, Raw>, raw: Raw): T;  // error → ApiError(400, error, "VALIDATION")
export function uuidParams<K extends string>(...keys: K[]): Parser<Record<K, string>, Record<string, string>>;
```

- `Validated<T>` se mueve desde [finanzasRouteUtils.ts:31](src/app/api/cuentas-financieras/finanzasRouteUtils.ts#L31), que lo reexporta. Los validators existentes (`validateCreateCuenta`, `validateCreateGasto`, etc.) se reutilizan con `parseInput` dentro del controller.
- No se agrega zod ni otra librería. Si más adelante se incorpora una, alcanza con un adaptador que convierta su resultado en `Validated<T>`.
- Cada controller decide si lee JSON con `readJsonBody(ctx.req)` o usa `formData()`, y valida antes de llamar a services o RPCs.
- Los filtros se leen desde `ctx.req.nextUrl.searchParams`; los parámetros de ruta llegan sin validar en `ctx.params`.
- `uuidParams` reemplaza a `validateUuid` de finanzas en las rutas con `[id]`: `const { id } = parseInput(uuidParams("id"), ctx.params)`. Todavía no lo usa ninguna ruta, porque ninguna ruta con `[id]` está migrada; por ahora solo lo usa su test.

**[logger.ts](src/lib/logger.ts) (ajuste)**

- `createScopedLogger(scope)` devuelve la misma API que `logger`, con un prefijo en cada línea, por ejemplo `[POST /api/cuentas-financieras req=1a2b3c4d]`. `logger.ts` sigue siendo el único archivo que escribe en `console.*`.

**`src/app/api/apiHandler.ts` (nuevo): orquestación**

```ts
type ApiHandlerOptions = {
  /** "POST /api/cuentas-financieras". Es el scope de los logs y el `context` de los errores. */
  route: string;
  /** Mensaje de los 5xx. Por defecto, API_ERROR_MESSAGES.INTERNAL. `ctx.fail(…, { fallback })` lo reemplaza en una rama. */
  fallback?: string;
  permission?: PermissionValue | readonly PermissionValue[];
  /** Campos que se agregan a toda respuesta de error. Solo si un client lee otro campo en el error; los pilotos no lo usan. */
  errorBody?: Record<string, unknown>;
  /** Mapeo propio de un dominio, antes del mapeo común (fase 4). */
  mapError?: (error: unknown) => MappedApiError | null;
};

type ApiHandlerContext = ApiContext & {
  req: NextRequest;
  params: Record<string, string>;
  requestId: string;
  log: ScopedLogger;
  /** `apiErrorResponse` con route, fallback, errorBody, requestId y actor ya cargados. */
  fail(error: unknown, opts?: DbErrorOptions & { extra?: Record<string, unknown> }): Response;
};

export function createApiHandler(
  options: ApiHandlerOptions,
  controller: (ctx: ApiHandlerContext) => Promise<Response>,
): (req: NextRequest, segment: { params: Promise<Record<string, string>> }) => Promise<Response>;
```

- `ctx.fail(…)` es para las ramas que devuelven el error de un service: `return ctx.fail(cause ?? error, { notFoundMessage })`. Para cortar desde una función auxiliar del controller se usa `throw new ApiError(…)`.
- `fallback` en `ctx.fail` va solo si el usuario tiene que ver un mensaje distinto al de la ruta. El texto del `Error` va al log; el `fallback`, a la respuesta.
- Los logs de error incluyen `requestId`, `userId` y `tenantId` en `extra`. Son ids, no datos personales.
- `segment.params` se resuelve con `await`, como pide Next 15, y se pasa sin validar al controller.
- El handler no tiene genéricos de input ni parsers configurables. TypeScript infiere el input validado a partir de las llamadas a `parseInput` dentro de cada controller.

### 1b.4 Ejemplo: antes y después

`POST /api/cuentas-financieras`, hoy (resumido):

```ts
export async function POST(req: Request) {
  const authError = await requirePermission(Permission.FinanzasEdit);
  if (authError) return authError;

  const supabase = await createClient();

  const parsed = validateCreateCuenta(await req.json().catch(() => null));
  if (parsed.error || !parsed.value) {
    return Response.json({ data: null, error: parsed.error ?? "JSON inválido" }, { status: 400 });
  }

  const input = parsed.value;
  const { data: created, error: createError } = await supabase.rpc("rpc_finanzas_crear_cuenta", { … });
  if (createError) {
    return Response.json({ data: null, error: "Error creando cuenta financiera" }, { status: rpcStatus(createError) });
  }
  // …
}
```

Con `createApiHandler` (así quedó el piloto):

```ts
export const POST = createApiHandler(
  {
    route: "POST /api/cuentas-financieras",
    fallback: "Error creando cuenta financiera",
    permission: Permission.FinanzasEdit,
  },
  async (ctx) => {
    const input = parseInput(validateCreateCuenta, await readJsonBody(ctx.req));
    const { data: created, error } = await ctx.supabase.rpc("rpc_finanzas_crear_cuenta", { … });
    if (error) return ctx.fail(error);
    // … resto sin cambios
  },
);
```

`GET /api/arreglos/[id]`, una vez que el service devuelva `cause` (fase 2.1). `can()` reemplaza a los dos `hasUserPermission()`:

```ts
export const GET = createApiHandler(
  { route: "GET /api/arreglos/[id]", fallback: "Error cargando arreglo" },
  async (ctx) => {
    const { data, error, cause } = await arregloCompletoService.getArregloDetalleCompleto(ctx.supabase, ctx.params.id);
    if (error) return ctx.fail(cause ?? error, { notFoundMessage: "Arreglo no encontrado" });
    if (!data) throw new ApiError(404, "Arreglo no encontrado", "NOT_FOUND");

    return Response.json({
      data: mapArregloDetalleCompleto(data, {
        hidePrices: !ctx.can(Permission.ArreglosPreciosView),
        hideEmployeeCosts: !ctx.can(Permission.EmpleadosView),
      }),
      error: null,
    } satisfies GetArregloByIdResponse);
  },
);
```

### 1b.5 Rutas piloto ✅

Se migraron el GET y el POST de dos rutas chicas para probar el handler y la validación explícita:
- [cuentas-financieras/route.ts](src/app/api/cuentas-financieras/route.ts):
  - `permission` en el POST;
  - lectura de JSON y validación con un validator existente (`validateCreateCuenta`) dentro del controller;
  - `ctx.can()` en el GET, en lugar de `hasUserPermission`, para ocultar saldos;
  - errores de RPC con `ctx.fail`.
- [categorias-arreglo/route.ts](src/app/api/categorias-arreglo/route.ts):
  - pasa de `getSession()` a claims validados, sin exigir un permiso nuevo;
  - el `list` del service conserva `cause` con `serviceFailure`, y el GET hace `ctx.fail(cause ?? error)`;
  - `constraintMessages: { uq_categorias_arreglo_tenant_nombre_lower: "Ya existe una categoría de arreglo con ese nombre" }` en el POST, en lugar de buscar el nombre del constraint en el texto del error;
  - `statsService.onDataChanged` recibe `ctx.actor.tenantId`, así no vuelve a leer la sesión después de la mutación.

Ninguno de los dos usa `errorBody`: sus errores responden `{ error, code, errorId? }`.

### 1b.6 Tests ✅

- `apiHandler.test.ts` (los controllers de prueba también usan `ctx`):
  - Sin claims válidos → 401. No se consultan permisos, no se lee el body y no se llama al controller.
  - Permiso faltante por rol → 403 `FORBIDDEN`. Faltante por plan → 403 `FEATURE_NOT_AVAILABLE_FOR_PLAN`.
  - JSON roto, o validator con error dentro del controller → 400 con ese mensaje, sin ejecutar services o RPCs.
  - El handler pasa el request original y los params sin validar; no lee el body por su cuenta.
  - Excepción en el controller → 500 JSON, con un `errorId` igual al `requestId` del log.
  - `ApiError` tirado por el controller → conserva su status y su mensaje.
  - `errorBody` aparece en los errores de cualquier paso.
  - `mapError` se evalúa antes del mapeo común.
  - Hay un solo `getClaims()` y un solo `fetchEffectivePermissions()` por request, aunque el controller llame varias veces a `can()`.
- `apiContext.test.ts`, `apiAccess.test.ts` y `apiInput.test.ts`: prueban cada helper por separado.
- `apiError.test.ts` se amplió con las opciones `errorId` y `mapError`, y perdió los tests de `withApiErrors`, `unauthorizedResponse` y `forbiddenResponse`.
- Helper para los tests de rutas en `src/tests/apiRoute.ts`: `mockApiSession({ role, plan, permissions, planPermissions, claims, claimsError })` configura los mocks de `createClient` (`getClaims`), `fetchEffectivePermissions` y `fetchPlanPermissions`. Los `route.test.ts` migrados ya no mockean `@/lib/requirePermission`.
- Los tests de los pilotos para 400, 409 y 500 verifican el body de error completo con `toEqual`, así fallan si vuelve a aparecer `data`.

### Criterios de aceptación
- [x] `apiHandler.ts` solo orquesta: no tiene tablas de mapeo, consultas de permisos ni validaciones propias.
- [x] Las dos rutas piloto están migradas y sus tests, actualizados. Los únicos cambios en las respuestas son los esperados: 401/403 con `code` y mensaje en español, errores de BD mapeados, y errores sin `data`.
- [x] Un request con sesión válida hace un solo `getClaims()` (test con spy).
- [x] `npm run build` pasa, o sea que la firma que devuelve `createApiHandler` cumple con el chequeo de tipos que Next 15 hace sobre los exports de `route.ts`.

### 1b.7 Decisiones tomadas al implementar

- **Los controllers usan `ctx` sin desestructurarlo**: `async (ctx) => { … ctx.supabase … ctx.fail(…) }`. Así queda claro qué viene del request autenticado, no hay choques con variables locales como `data`, `error` o `params`, y sigue funcionando si algún método del contexto pasa a depender de `this`. Vale también para los controllers de prueba. Los `it.each` siguen desestructurando sus casos, como es habitual en Vitest.
- **La validación del input queda fuera del handler.** Se evaluó sumar opciones `body: parser` y `params: parser`, con `ctx.body` tipado. Por ahora se sigue llamando a `parseInput` y `readJsonBody` dentro del controller, como dice 1b.1. Si se retoma: el handler solo debe leer el body si la ruta declara un parser (un GET no tiene body), cada opción recibe su parte cruda (body, params o query), y el controller ya no puede volver a leer `ctx.req.json()`.
- **Se eliminaron `withApiErrors`, `unauthorizedResponse` y `forbiddenResponse`** de `apiError.ts`, junto con sus tests. Solo se usaban en esos tests.
- **`errorBody` no se usa en los pilotos.** La opción sigue en el handler y está cubierta por `apiHandler.test.ts`; se borra en la fase 7 si ninguna ruta la necesita.
- **`fallback`**: es el mensaje para el usuario en los 5xx. Se resuelve en este orden: `ctx.fail(…, { fallback })`, después el `fallback` de la ruta, y por último `API_ERROR_MESSAGES.INTERNAL`.

---

## Fase 2 — Migración de rutas por módulo

**Entrega**: todas las rutas se exportan con `createApiHandler`, y todas sus ramas de error pasan por `ctx.fail`. Los services devuelven `cause`. Desaparecen los 404 falsos, los 500 sin log y los chequeos de sesión inline.
**Tamaño**: L (conviene un PR por módulo: 2.1 a 2.5)

### Receta para cada ruta

1. En los services y repositories del módulo, reemplazar `return { data: null, error: toServiceError(error) }` por `return { data: null, ...serviceFailure(error) }`.
2. Exportar cada método con `createApiHandler`, con el cuerpo actual como controller: `export const PUT = createApiHandler({ route: "PUT /api/…", fallback, … }, async (ctx) => { … })`. El controller usa `ctx` sin desestructurarlo (ver 1b.7).
3. Borrar del controller lo que ahora resuelve el handler:
   - `createClient()` → `ctx.supabase`.
   - `getSession()`/`getClaims()` y los `"Unauthorized"` inline → nada, porque lo valida el paso 2 del handler.
   - `requirePermission(X)` → opción `permission: X`.
   - `hasUserPermission(supabase, X)` → `ctx.can(X)`.
   - `try/catch` genéricos que solo loguean y devuelven 500 → nada.
4. Reemplazar cada rama del tipo `if (error) return Response.json({ error: "Error …" }, { status: 500 })` por `if (error) return ctx.fail(cause ?? error, { notFoundMessage })`.
5. Reemplazar `if (error === ServiceError.NotFound || !data)` por dos ramas separadas: `if (error) return ctx.fail(…)` y `if (!data)` con un 404.
6. No agregar permisos que la ruta hoy no exige.
7. Mantener las validaciones dentro del controller, antes de services o RPCs, reutilizando `parseInput`, `readJsonBody` y los validators existentes. En las rutas con `[id]`, `validateUuid` pasa a ser `parseInput(uuidParams("id"), ctx.params)`. Conservar los mensajes claros de las validaciones 400.
8. No pasar `errorBody` salvo que el client de la ruta lea otro campo además de `error` cuando `!res.ok`. Revisarlo en el client antes de migrar.
9. Actualizar el `route.test.ts` del módulo con `mockApiSession`. Las respuestas de error ya no traen `data`. Además, agregar un test por cada bug corregido que figura en el [Anexo A](#anexo-a--casos-concretos-relevados).

Las rutas de facturación (`*/factura`, `facturas/*`, `facturacion/*` y `fiscal/*`) se migran en la fase 4.

### 2.1 Arreglos

| Archivo | Cambio |
|---|---|
| [arregloRepository.ts](src/app/api/arreglos/arregloRepository.ts) | 14 `toServiceError` → `serviceFailure` |
| [detalleArregloService.ts](src/app/api/arreglos/detalleArregloService.ts), [arregloDescripcionService.ts](src/app/api/arreglos/arregloDescripcionService.ts), [arregloCompletoService.ts](src/app/api/arreglos/arregloCompletoService.ts), [arregloFormularioService.ts](src/app/api/arreglos/arregloFormularioService.ts), [formularioService.ts](src/app/api/arreglos/formularios/formularioService.ts) | `serviceFailure` |
| [arregloMutationService.ts](src/app/api/arreglos/arregloMutationService.ts) | Agregar `cause?: unknown` a `MutationResult` y propagarlo en `:36-40`, `:177-181`, `:193-197` y `:274-292`. En `:225-243` (`rpc_activar_presupuesto`), usar `mapDbError(activationError)` en lugar de las heurísticas por texto, y conservar `cause`. Con esto, los errores `55001`/`P1791` del update dejan de ser un 500 "Error actualizando arreglo" |
| [arreglos/route.ts](src/app/api/arreglos/route.ts) | GET `:71-79`. No hace falta `errorBody`: [arreglosClient.ts:112-117](src/clients/arreglosClient.ts#L112-L117) ya usa `{ hasMore: false }` cuando el error no trae `page`. POST `:247-249` y `:436-438`. En `:413-428`, conservar los casos específicos (stock, código duplicado, cuenta requerida) y reemplazar el fallback "No se pudieron guardar los repuestos." por `ctx.fail(rpcError, …)` |
| [arreglos/[id]/route.ts](src/app/api/arreglos/[id]/route.ts) | GET `:48-51` (sacar `\|\| !data`). Los 3 `getClaims()` del GET (el inline y los de los dos `hasUserPermission`) pasan a `ctx.can`; ver el ejemplo de 1b.4. PUT/DELETE: si `result.cause`, usar `ctx.fail` |
| [arreglos/[id]/cobro/route.ts](src/app/api/arreglos/[id]/cobro/route.ts) | `:137-140` y `:175-177`. Hoy **todo** error de RPC es 400 con el `message` crudo, incluso los internos. Pasar a `ctx.fail(rpcError, …)` |
| [arreglos/[id]/detalles/route.ts](src/app/api/arreglos/[id]/detalles/route.ts) | `:112-117` (hoy no loguea y responde "Error creando detalle del arreglo" aunque el arreglo esté facturado) |
| [arreglos/[id]/detalles/[detalleId]/route.ts](src/app/api/arreglos/[id]/detalles/[detalleId]/route.ts) | `:141-151` y `:180-184` |
| [arreglos/[id]/repuestos/route.ts](src/app/api/arreglos/[id]/repuestos/route.ts) | `upsertRepuestoPendiente` `:102-107` (no loguea). En `mapInlineRpcError`/`mapExistingRepuestoRpcError`, el fallback `raw` expone el mensaje crudo en los 500: reemplazar por `mapDbError` |
| [arreglos/[id]/repuestos/[lineaId]/route.ts](src/app/api/arreglos/[id]/repuestos/[lineaId]/route.ts) | `:54-57` (no loguea). Reemplazar `isUnauthorizedSupabaseError` por el mapeo común |
| [arreglos/formularios/route.ts](src/app/api/arreglos/formularios/route.ts) | `:23-29` |

### 2.2 Operaciones

| Archivo | Cambio |
|---|---|
| [operacionesService.ts](src/app/api/operaciones/operacionesService.ts) | `serviceFailure` en list, getById, create, update, delete y stats (`:160`, `:171`, `:197`, `:227`, `:272`, `:288`, `:307`, `:337`) |
| [operaciones/route.ts](src/app/api/operaciones/route.ts) | GET `:112-118`. **POST `:152-159`**: hoy devuelve `error?.toString()`, así que el usuario ve **"Unknown"** |
| [operaciones/[id]/route.ts](src/app/api/operaciones/[id]/route.ts) | GET `:64-69`, PUT `:106-112`, DELETE `:142-163` (el `switch` por enum pasa a `ctx.fail(cause)`) |
| [operaciones/stats/route.ts](src/app/api/operaciones/stats/route.ts) | `:33-40` |

### 2.3 Finanzas (cuentas financieras y gastos)

| Archivo | Cambio |
|---|---|
| [cuentas-financieras/route.ts](src/app/api/cuentas-financieras/route.ts) | ✅ **Migrada como piloto en la fase 1b** (ver 1b.5) |
| [cuentas-financieras/[id]/route.ts](src/app/api/cuentas-financieras/[id]/route.ts) | GET `:40-46`, PUT `:73-78`, DELETE `:106-112` (por ejemplo, borrar una cuenta con movimientos) |
| [cuentas-financieras/[id]/movimientos/route.ts](src/app/api/cuentas-financieras/[id]/movimientos/route.ts) | `:39-44` |
| [cuentas-financieras/ingresos/route.ts](src/app/api/cuentas-financieras/ingresos/route.ts) | `:31-40`. Hoy loguea solamente `{ code }` |
| [cuentas-financieras/transferencias/route.ts](src/app/api/cuentas-financieras/transferencias/route.ts) | `:42-48` expone el `message` crudo. Además, `:21` y `:43` loguean el `rawBody`/`input` completos: reducirlos a ids e importes |
| [cuentas-financieras/transferencias/[id]/route.ts](src/app/api/cuentas-financieras/transferencias/[id]/route.ts) | `:49-57`, `:91-99`, y el mismo ajuste de payload en los logs |
| [gastos/route.ts](src/app/api/gastos/route.ts) | GET `:42-47` y POST `:80-86` |
| [gastos/[id]/route.ts](src/app/api/gastos/[id]/route.ts) | GET `:47-53`. PUT `:72-78`: cualquier error al leer el gasto devuelve 404; separar ese caso. También `:89-95` y DELETE `:124-130` |

### 2.4 Empleados, productos, stocks y categorías

| Archivo | Cambio |
|---|---|
| [empleadosService.ts](src/app/api/empleados/empleadosService.ts), [productosService.ts](src/app/api/productos/productosService.ts), [stocksService.ts](src/app/api/stocks/stocksService.ts) | `serviceFailure`. En los métodos que devuelven el error crudo (create, update, delete), devolver también `cause` |
| [empleados/route.ts](src/app/api/empleados/route.ts) | GET `:61-66` y `:73-78`. POST `:186-191`: un DNI duplicado debe dar 409, hoy da 500 |
| [empleados/[id]/route.ts](src/app/api/empleados/[id]/route.ts) | `\|\| !data` en `:66`, `:193`, `:211` y `:304` (los `if (error)` de `:199` y `:217` hoy son código muerto). DELETE `:311-317`: un empleado en uso debe dar 409 `IN_USE` |
| [empleados/[id]/salarios/route.ts](src/app/api/empleados/[id]/salarios/route.ts) | `:22-28` |
| [productos/route.ts](src/app/api/productos/route.ts) | GET `:57-60` y POST `:97-100` |
| [productos/[id]/route.ts](src/app/api/productos/[id]/route.ts) | `\|\| !data` en `:53` y `:102` (un código duplicado en PUT hoy da 404). DELETE `:128-130` → 409 `IN_USE` |
| [stocks/route.ts](src/app/api/stocks/route.ts) | `:104` (`\|\| !data`). `:122-125`: hoy loguea solo el enum ("Error creating stock: Conflict") |
| [stocks/[id]/route.ts](src/app/api/stocks/[id]/route.ts) | `\|\| !data` en `:54` y `:81`. DELETE `:101-103` |
| [categorias-arreglo/route.ts](src/app/api/categorias-arreglo/route.ts) | ✅ **Migrada como piloto en la fase 1b** (ver 1b.5) |
| [categorias-arreglo/[id]/route.ts](src/app/api/categorias-arreglo/[id]/route.ts) | **PUT `:64-76`**: un nombre duplicado hoy da 404 "no encontrada"; usar `constraintMessages`. DELETE `:99-105`: una categoría en uso debe dar 409 |

### 2.5 Clientes, vehículos, tenant, turnos y dashboard

Estas rutas tienen el problema inverso: exponen el `error.message` crudo de Postgres, en inglés y con nombres de constraints, y muchas veces no lo loguean. Como ya reciben el `PostgrestError` completo, alcanza con `ctx.fail(error, …)`.

La mayoría de estas rutas tampoco tiene un chequeo de sesión en el `route.ts`: dependen del middleware y de RLS. Al migrarlas, el handler pasa a validar los claims, sin agregar permisos.

| Archivo | Cambio |
|---|---|
| [clientes/route.ts](src/app/api/clientes/route.ts) | `:46-55` |
| [clientes/[id]/cuenta-corriente/route.ts](src/app/api/clientes/[id]/cuenta-corriente/route.ts), [clientes/[id]/resumen-financiero/route.ts](src/app/api/clientes/[id]/resumen-financiero/route.ts) | `:35-37` / `:28-30` |
| [clientes/empresas/route.ts](src/app/api/clientes/empresas/route.ts) | `:51-54`. `:47` usa `logger.error` para un caso esperado: pasarlo a `warn` |
| [clientes/empresas/[id]/route.ts](src/app/api/clientes/empresas/[id]/route.ts) | `:48-51` y `:73-76` (**`console.error`, que viola `CLAUDE.md`**). DELETE `:90-92` → `IN_USE` |
| [clientes/empresas/[id]/representantes/route.ts](src/app/api/clientes/empresas/[id]/representantes/route.ts) | `:17-19`, `:66-68`, `:92-94` |
| [clientes/particulares/route.ts](src/app/api/clientes/particulares/route.ts), [clientes/particulares/[id]/route.ts](src/app/api/clientes/particulares/[id]/route.ts) | Conservar el 409 por DNI/CUIL mediante `constraintMessages` o un override de `23505`. Resto de ramas: `:40-44`, `:71-77`, `:91-93` |
| [vehiculos/route.ts](src/app/api/vehiculos/route.ts), [vehiculos/[id]/route.ts](src/app/api/vehiculos/[id]/route.ts), [vehiculos/[id]/cliente/route.ts](src/app/api/vehiculos/[id]/cliente/route.ts) | Conservar el 409 por patente. Reemplazar las ramas que devuelven `error.message` (`[id]/route.ts:66-68` y `:80-81`, `[id]/cliente/route.ts:84`) |
| [tenant/taller/route.ts](src/app/api/tenant/taller/route.ts), [tenant/taller/[id]/route.ts](src/app/api/tenant/taller/[id]/route.ts), [tallerService.ts](src/app/api/tenant/tallerService.ts) | El service tiene que devolver el `PostgrestError`, no solamente `message`. En la ruta GET, tanto la respuesta de éxito como la de error usan `new Response(JSON.stringify(…))` sin `Content-Type`: pasar a `Response.json` |
| [turnos/route.ts](src/app/api/turnos/route.ts), [turnos/[id]/route.ts](src/app/api/turnos/[id]/route.ts) | **Normalizar `error` a string** en POST, PUT y DELETE. Hoy es un objeto `{ message, code, details }`. Los mensajes de `23505`/`23502`/`23503` pasan a `constraintMessages` u overrides. Dejar de interpolar `insertError.message` en el texto de `23503` (`route.ts:137`). Esto se coordina con el cambio de client de la fase 5.3 y **va en el mismo PR** |
| [dashboard/stats/route.ts](src/app/api/dashboard/stats/route.ts) | `:34-45`: hoy loguea solamente `err.message` y pierde el stack. Además devuelve el `message` crudo |

### Criterios de aceptación (por módulo)
- [ ] No queda ningún `status: 500` armado a mano en el módulo. `grep -n "status: 500" src/app/api/<modulo>` solamente debe encontrar `apiError.ts`.
- [ ] No queda ningún `=== ServiceError.NotFound || !`.
- [ ] No quedan `createClient()`, `getSession()`, `getClaims()`, `requirePermission(` ni `hasUserPermission(` en los `route.ts` del módulo.
- [ ] Cada bug del [Anexo A](#anexo-a--casos-concretos-relevados) que corresponde al módulo tiene su test.

---

## Fase 3 — Autenticación, permisos y contrato uniforme

**Entrega**: los errores de sesión y permisos de las rutas que todavía no migraron llegan en español y con `code`, y ninguna `/api/*` devuelve HTML. La sesión sigue resuelta en el middleware, y el handler no lo reemplaza.
**Tamaño**: S

| Archivo | Cambio |
|---|---|
| [requirePermission.ts](src/lib/requirePermission.ts) | Reimplementarlo como un adaptador de `buildApiContext` + `assertPermission` que devuelve `Response \| null` mediante `apiErrorResponse`. Así, las rutas que todavía no migraron reciben el contrato nuevo, incluida la distinción por plan, sin tocarlas. Actualizar [requirePermission.test.ts:69](src/lib/requirePermission.test.ts#L69). Se elimina en la fase 7 |
| [serverAuth.ts:135](src/lib/facturacion/serverAuth.ts#L135) | `{ error: error.code ?? error.message }` → `{ error: error.message, code: error.code }`. Hoy el usuario ve el texto `FEATURE_NOT_AVAILABLE_FOR_PLAN`. Actualizar [serverAuth.test.ts:154](src/lib/facturacion/serverAuth.test.ts#L154) |
| [supabase/middleware.ts:58-68](src/supabase/middleware.ts#L58-L68) | Si `pathname.startsWith("/api/")` y no hay usuario, responder `NextResponse.json({ error: API_ERROR_MESSAGES.UNAUTHORIZED, code: "UNAUTHORIZED" }, { status: 401 })` en lugar de redirigir a `/login` |
| [middleware.ts](src/middleware.ts) `matcher` | Reemplazar la lista de prefijos `/api/…` por `'/api/:path*'`. Hoy quedan afuera `/api/categorias-arreglo`, `/api/cuentas-financieras`, `/api/empleados`, `/api/gastos` y `/api/fiscal/persona`: esas rutas no renuevan la sesión en el middleware y, sin sesión, no reciben el 401 uniforme. Ninguna API Route es pública hoy |
| [middleware.ts:7-13](src/middleware.ts#L7-L13) | Con `LOG_EVERY_REQUEST=true` se loguean el body completo y la URL con su query string, lo que contradice la regla de logging. Sacar el `body` y la query. El log de acceso `debug` del handler cubre el resto |

Los 11 `"Unauthorized"` inline que figuraban en esta fase se resuelven al migrar cada ruta a `createApiHandler`, en los pilotos de la fase 1b y en la fase 2. No hay paso intermedio: `unauthorizedResponse()` se eliminó en la fase 1b.

> [!NOTE]
> Se verificó que ningún client ni componente compara contra los strings `FORBIDDEN_INSUFFICIENT_PERMISSIONS` o `FEATURE_NOT_AVAILABLE_FOR_PLAN`. Solo aparecen en tests, así que el cambio no rompe lógica del frontend.

### Criterios de aceptación
- [ ] `fetch("/api/arreglos")` sin sesión devuelve 401 JSON, no un 200 HTML.
- [ ] `fetch("/api/gastos")` sin sesión devuelve el mismo 401 JSON. Es una de las rutas que hoy no pasan por el middleware.
- [ ] Un usuario BASE que abre facturación ve "La funcionalidad no está disponible en el plan actual."

---

## Fase 4 — Facturación electrónica

**Entrega**: las rutas de facturación usan `createApiHandler`, los errores internos conservan la causa de Supabase o ARCA en el log, y el usuario recibe un `errorId`.
**Tamaño**: M (antes S: ahora incluye migrar las 13 rutas de facturación al handler)

- **Migrar las 13 rutas** (`arreglos/[id]/factura`, `operaciones/[id]/factura`, `facturas/*`, `facturacion/configuracion/*` y `fiscal/*`) a `createApiHandler` con `mapError: mapFacturacionError`.
  - `facturacionErrorResponse` ([serverAuth.ts:133](src/lib/facturacion/serverAuth.ts#L133)) pasa a ser `mapFacturacionError(error): MappedApiError | null`, con los casos actuales:
    - `FacturacionHttpError` → su status y su mensaje;
    - `FacturacionValidationError` → 422 `VALIDATION`;
    - `FceMipymeQueryError` → 503;
    - error de relación entre el CUIT y el certificado → 422.

    Lo que no matchea sigue al mapeo común: 500 con `errorId`, y un log con la `cause`.
  - Esto absorbe el bloque `FacturacionValidationError` + `FceMipymeRequiredError` repetido 4 veces en [arreglos/[id]/factura/route.ts](src/app/api/arreglos/[id]/factura/route.ts) y [operaciones/[id]/factura/route.ts](src/app/api/operaciones/[id]/factura/route.ts).
  - `ApiErrorStatus` suma `422`.
- **Permisos y membresía**:
  - `requireTenantBillingActor`/`requireTenantPlanPermission` pasan a ser la opción `permission: Permission.FacturasView` del handler. La distinción por plan ahora es automática (fase 1b).
  - `requireTenantActor` y `requireTenantAdmin` reciben el `ctx`, para reutilizar `ctx.supabase` y `ctx.actor` en lugar de repetir `createClient()` y `getClaims()`. Siguen validando la membresía en `tenant_members` y el rol admin, que solo usa facturación.
- **Encadenar la causa** en los 30 `throw new Error("No se pudo …")`:
  - [facturacionService.ts](src/lib/facturacion/facturacionService.ts) (22);
  - [credentialStorage.ts](src/lib/facturacion/credentialStorage.ts) (5);
  - [afipGateway.ts](src/lib/facturacion/afipGateway.ts) (2);
  - [arcaCredentialRequest.ts](src/lib/facturacion/arcaCredentialRequest.ts) (1).

  Esos `throw` pasan a usar una clase propia: `throw new FacturacionInternalError("No se pudo cargar la configuración fiscal", { cause: error })`. El `lib: ["esnext"]` del `tsconfig` ya incluye `ErrorOptions`.
- **Mensajes**: los textos de esos `throw` ya están en español y son descriptivos (por ejemplo "ARCA autorizó el documento pero no se pudo persistir"), así que conviene mostrarlos en lugar de "No se pudo completar la operación de facturación". `mapFacturacionError` los devuelve como 500 `INTERNAL` con su mensaje, **solo** para `FacturacionInternalError`. Cualquier otra excepción, por ejemplo de una librería, sigue mostrando el fallback.

> [!CAUTION]
> `credentialStorage.ts` maneja certificados y claves privadas. Antes de loguear una `cause` que venga de ahí, revisar que el objeto no incluya el contenido del archivo.

---

## Fase 5 — Frontend

**Entrega**: el usuario ve el mensaje real, con el código de referencia en los 5xx. No hay errores silenciosos ni éxitos falsos.
**Tamaño**: M

### 5.1 Helper HTTP — `src/clients/http.ts` (nuevo)

```ts
import type { ApiErrorCode } from "@/lib/apiErrorCodes";
import { API_ERROR_MESSAGES } from "@/lib/apiErrorCodes";

export type ClientResult<T> = {
  data: T | null;
  error: string | null;       // listo para mostrar (incluye la referencia si hay errorId)
  code?: ApiErrorCode;
  errorId?: string;
  status?: number;
};

export async function requestJson<T>(input: string, init: RequestInit | undefined, fallback: string): Promise<ClientResult<T>>;
export async function readApiError(res: Response, fallback: string): Promise<Omit<ClientResult<never>, "data">>;
export function withErrorReference(message: string, errorId?: string): string; // "… (código de referencia: 1a2b3c4d)"
```

`readApiError` tiene que contemplar estos casos:
- `res.redirected` hacia `/login` → `UNAUTHORIZED`. Es una defensa por si la fase 3 no está desplegada.
- `Content-Type` distinto de JSON → `${fallback} (HTTP ${status})`.
- `body.error` como string, que es el contrato nuevo.
- `body.error.message`, por compatibilidad con turnos mientras dure la migración.
- Body vacío → fallback.

### 5.2 Migrar los clients

Hay unos 68 `fetch` en 13 archivos de `src/clients/` y cada uno repite su propio try/catch. Hay que migrarlos a `requestJson` **manteniendo la firma pública** `{ data, error }`, para que los providers no cambien. El orden sugerido sigue el de la fase 2: `arreglosClient`, `operacionesClient`, `finanzasClient` (unificar su `request`/`remove` con el helper), `empleadosClient`, `productosClient`, `stocksClient`, `categoriasArregloClient`, `clientes/*`, `vehiculoClient`, `representantesClient`, `tenantClient` y `turnosClient`.

**Casos puntuales:**
- `vehiculoClient.ts:97-101` (`getClienteForVehiculo`) no lee el body.
- Los 15 `fetch` directos en componentes y páginas pasan a usar `requestJson` o `readApiError`:
  - `DashboardProvider.tsx:87`
  - `FormulariosProvider.tsx:29`
  - `GenerarClaveModal.tsx:56`
  - `FacturaElectronicaModal.tsx:130,272`
  - `arreglos/[id]/page.tsx:86`
  - `facturacion/[id]/page.tsx:47,67,85`
  - `facturacion/page.tsx:52`
  - `configuracion/facturacion/page.tsx:56,96,138`
  - `useArcaPadronLookup.ts:72`
  - `useArcaInscriptionLookup.ts:49`
- `arreglos/[id]/page.tsx:87` hace `if (!response.ok) return;` y el error queda silencioso.

### 5.3 Turnos

Va en el mismo PR que el cambio de backend de la fase 2.5.
- `turnosClient.ts`: cambiar `error: SupabaseError` por `error: string | null`.
- [TurnosProvider.tsx:45](src/app/providers/TurnosProvider.tsx#L45) y `:70`: `throw new Error(data.error.message)` pasa a `throw new Error(data.error)`. **Hoy los errores al cargar la lista de turnos no se ven**, porque el GET devuelve un string y `.message` queda `undefined`.

### 5.4 Providers que se tragan errores

Los providers tienen que exponer el error: un campo `error` en el contexto, o devolver `{ data, error }` en lugar de `null`/`boolean`.
- `EmpleadosProvider.tsx:116-117,132`
- `ProductosProvider.tsx:95-96,119,162,173-175,213,222`
- `CategoriasArregloProvider.tsx:51-52`
- `InventarioProvider.tsx:147-149,160`
- `ClientesProvider.tsx:52-64,80-91,122-141,277-279`
- `CuentasFinancierasProvider.tsx:129-139`
- `ArreglosProvider.tsx:99-106` (`fetchById`). Hoy [arreglos/[id]/page.tsx:108-110](src/app/(user)/arreglos/[id]/page.tsx#L108-L110) muestra "no encontrado" también ante un 403 o un 500.

Hay promesas rechazadas que nadie captura: `ArreglosProvider.fetchAll` (`:85-96`, llamado con `void` desde `arreglos/page.tsx:73`), `VehiculosProvider.tsx:117`, `TenantProvider.tsx:70` y `FormulariosProvider.tsx:46`. Para cada una, capturar el error y exponerlo en el contexto.

### 5.5 Éxitos falsos y mensajes hardcodeados

| Archivo | Problema | Cambio |
|---|---|---|
| [productos/[id]/page.tsx:165-166](src/app/(user)/productos/[id]/page.tsx#L165-L166) | `removeProducto` ignora el resultado y se muestra "Producto eliminado" siempre | Devolver `{ error }` desde el provider y mostrar `toast.error` cuando falle |
| [productos/[id]/page.tsx:173-183](src/app/(user)/productos/[id]/page.tsx#L173-L183) | Se muestra "Producto actualizado" aunque `updated` sea `null` | Lo mismo |
| `productos/[id]/page.tsx:140,220` | Textos fijos; el provider devuelve un `boolean` | Propagar el mensaje |
| `EditVehiculoModal.tsx:71-73` | Descarta el mensaje y **cierra el modal** | Mostrar el mensaje y dejar el modal abierto |
| `ArregloSummaryCard.tsx:132-134`, `ArregloEstadoBadge.tsx:157-158` | Título y descripción fijos | Usar `error("No se pudo …", err.message)` |
| `ParticularDetails.tsx:37`, `EmpresaDetails.tsx:45,74`, `CobroArregloModal.tsx:127`, `ServicioLineasCustomSection.tsx:574`, `productos/[id]/page.tsx:200,230` | Catches que solo loguean o están vacíos | Mostrar el error |

**Convención para la UI**: `toast.error("<Acción que falló>", error)`, donde el título describe la acción ("No se pudo registrar el cobro") y la descripción es el mensaje del servidor, que ya incluye la referencia si hay `errorId`.

### Criterios de aceptación
- [ ] `grep -rn "Error \${res.status}" src/clients` no encuentra nada fuera de `http.ts`.
- [ ] Los tests de clients existentes pasan (`clientesClient`, `empresaClient`, `particularClient`, `vehiculoClient`), y los providers con tests (`ClientesProvider`, `CuentasFinancierasProvider`, `InventarioProvider`, `OperacionesProvider`) cubren el caso de error.

---

## Fase 6 — Base de datos: `ERRCODE` explícitos

**Entrega**: toda excepción de negocio de las funciones vigentes tiene un código explícito, así el backend deja de depender de heurísticas sobre el texto.
**Tamaño**: M (puede avanzar en paralelo desde la fase 1)

Crear la migración `supabase/migrations/<timestamp>_errcodes_excepciones_negocio.sql` que haga `CREATE OR REPLACE` de las 21 funciones de abajo, **copiando el cuerpo exacto de su última definición** y agregando solamente `USING ERRCODE = '…'`. Hay que mantener los `REVOKE`/`GRANT` explícitos, como en el resto de las migraciones.

**Reglas de asignación:**

| Tipo de mensaje | `ERRCODE` |
|---|---|
| `JWT sin tenant_id`, `Sesion sin tenant activo`, `sesión autenticada requerida` | `28000` |
| `permiso … requerido` | `42501` |
| `… requerido`, `… inválido`, `… obligatorios`, mensajes de validación | `22023` |
| `… no encontrado` | `P0002` |
| Mutaciones bloqueadas por facturación (`No se puede modificar una venta con comprobante fiscal autorizado`, etc.) | `55001` |
| `STOCK_INSUFICIENTE …` | se mantiene `P0001` |

**Funciones vigentes con `RAISE EXCEPTION` sin `ERRCODE`**, con la migración que tiene su última definición:

| Función | Raises sin código | Última definición |
|---|---|---|
| `rpc_set_asignacion_arreglo_linea` | 12/12 | `20260719120000_v1.10.0-categorias-schema.sql` |
| `rpc_crear_producto_inline_para_arreglo` | 8/8 | `20260719120000_v1.10.0-categorias-schema.sql` |
| `rpc_facturacion_preparar_documento` | 8/8 | `20260905100901_facturacion_rls_authenticated.sql` |
| `rpc_asignar_repuesto_existente_con_compra` | 7/8 | `20260828150113_fix_arreglo_inline_stock_rpc_contract.sql` |
| `rpc_crear_arreglo_completo` | 6/10 | `20260828220000_restriccion_pago_presupuestos.sql` |
| `rpc_revertir_operacion_linea` | 5/6 | `20260205001750_v1.5.5-borrar-operaciones.sql` |
| `rpc_delete_asignacion_arreglo_linea` | 3/3 | `20260201090000_v1.5.1-operaciones-lineas-stock-id.sql` |
| `facturacion_bloquear_snapshot_autorizado` | 3/3 | `20260905100859_facturacion_arca_robusta.sql` |
| `rpc_get_arreglo_detalle` | 2/2 | `20260930100000_arreglo_numero_orden_autoincremental.sql` |
| `_lock_arreglo_del_tenant` | 2/2 | `20260512120000_v1.8.1-refactor-rpc-arreglo-helpers.sql` |
| `_insert_detalles_arreglo` | 2/2 | `20260927020000_slice2_horas_detalle.sql` |
| `_insert_detalle_form_custom` | 2/2 | `20260512120000_v1.8.1-refactor-rpc-arreglo-helpers.sql` |
| `rpc_facturacion_adquirir_lease` | 2/2 | `20260905100901_facturacion_rls_authenticated.sql` |
| `_snapshot_detalle_arreglo_valores` | 2/3 | `20260930120000_b2c_188_snapshot_costo_service_role.sql` |
| `rpc_listar_empleados_valor_hora` | 2/2 | `20260927040000_b2c_179_horas_y_costos_mano_obra.sql` |
| `set_arreglo_numero_orden` | 2/2 | `20260930100000_arreglo_numero_orden_autoincremental.sql` |
| `_check_codigo_no_existe_en_productos` | 1/2 | `20260512120000_v1.8.1-refactor-rpc-arreglo-helpers.sql` |
| `_crear_producto_y_stock` | 1/1 | `20260512120000_v1.8.1-refactor-rpc-arreglo-helpers.sql` |
| `_insert_arreglo_base` | 1/1 | `20260719120000_v1.10.0-categorias-schema.sql` |
| `dashboard_costo_por_empleado` | 1/1 | `20260719120000_v1.10.0-categorias-schema.sql` |
| `facturacion_bloquear_mutacion_operacion_facturada` | 1/1 | `20260906150000_fix_triggers_delete_operaciones_lineas.sql` |

> [!WARNING]
> Este listado sale de un análisis estático de `CREATE OR REPLACE FUNCTION` en las migraciones. Antes de escribir la migración, confirmar la definición vigente de cada función contra la BD con `pg_get_functiondef('public.<fn>'::regproc)`. Si una función se redefinió con `CREATE FUNCTION` sin `OR REPLACE`, o desde un snippet fuera de `migrations/`, el script pudo no detectarla.

**Después de aplicar la migración:**
- Simplificar en `mapDbError` las reglas de `P0001` basadas en el texto del mensaje (se mantiene la de `STOCK_INSUFICIENTE`).
- Opcional: reescribir en lenguaje de usuario los mensajes más técnicos (`arreglo_id requerido`, `línea de stock inválida`, `p_from y p_to son obligatorios`). Esos casos los atrapa la validación del backend antes de llegar a la BD, así que rara vez los ve un usuario.

### Criterios de aceptación
- [ ] `npm run test:integration` pasa.
- [ ] Hay un test de integración nuevo: borrar o editar una venta facturada devuelve 409 `INMUTABLE` con el mensaje "No se puede modificar una venta con comprobante fiscal autorizado".

---

## Fase 7 — Limpieza y guardrails

**Tamaño**: S

- **Encoding roto** en los mensajes: [arreglos/route.ts:219](src/app/api/arreglos/route.ts#L219), [arreglos/[id]/detalles/route.ts:88](src/app/api/arreglos/[id]/detalles/route.ts#L88) y `:91`, [empleados/route.ts:147](src/app/api/empleados/route.ts#L147) y [empleados/[id]/route.ts:149](src/app/api/empleados/[id]/route.ts#L149). Hoy muestran "invÃ¡lido", "tenÃ©s" y "nÃºmero".
- **Guardrail SQL**: agregar `scripts/check-sql-errcodes.mjs`, que reporte las funciones vigentes con `RAISE EXCEPTION` sin `ERRCODE`, y correrlo en CI o como test. El análisis de la fase 6 se hizo con un script equivalente.
- **Guardrail de rutas**: una regla de ESLint (`no-restricted-imports`) para `src/app/api/**/route.ts` que prohíba importar `@/supabase/server`, `@/lib/requirePermission` y `hasUserPermission` de `@/lib/permissions.server`. El cliente y los permisos llegan por `ctx`.
- **Eliminar lo que quedó sin uso**: `requirePermission.ts` y `hasUserPermission`. Si ninguna ruta la usa, también la opción `errorBody` de `createApiHandler` y `body` de `ApiErrorOptions`. (`withApiErrors` ya se eliminó en la fase 1b.)
- **Documentar la convención** en `AGENTS.md`/`CLAUDE.md`, con una sección "Errores en API Routes":
  - Cada método se exporta con `createApiHandler`. Los controllers no leen la sesión ni chequean permisos por su cuenta.
  - Los controllers usan `ctx` sin desestructurarlo, y validan su input con `parseInput`.
  - La sesión la gestiona el middleware; el handler valida los claims y arma el contexto.
  - Las ramas de error usan `ctx.fail` (o `apiErrorResponse` fuera de un handler).
  - Los services devuelven `cause`.
  - Las funciones SQL nuevas siempre levantan excepciones con `USING ERRCODE`.
  - Los clients usan `requestJson`.
- **Actualizar [docs/tiering.md](docs/tiering.md)**: menciona `featureForPath()` y `useTenant().hasFeature()`, que no existen en el código. Documentar que la restricción por plan se modela en `plan_permissions` y se exige con la opción `permission` de `createApiHandler`.

---

## Plan de pruebas

### Unitarios
- `src/app/api/apiError.test.ts` (fase 1, ya existe): una fila por cada código de la tabla de mapeo; que en 5xx no aparezca el mensaje crudo; `errorId` presente solo en 5xx; `constraintMessages`; mapeo de `ServiceError`. En la fase 1b se amplió con `errorId` y `mapError` ✅.
- `src/app/api/apiHandler.test.ts`, `apiContext.test.ts`, `apiAccess.test.ts` y `apiInput.test.ts` (fase 1b) ✅: ver 1b.6.
- `src/tests/apiRoute.ts` (fase 1b) ✅: helper `mockApiSession` para los tests de rutas migradas.
- `src/clients/http.test.ts` (nuevo): body string, body objeto (turnos legacy), HTML, redirect a `/login`, body vacío, `errorId`.
- Actualizar los tests que hoy afirman los mensajes o status viejos. Los que más aserciones tienen:
  - `arregloMutationService.test.ts` (9)
  - `arregloRepository.test.ts` (8)
  - `operacionesService.test.ts` (6)
  - `arreglos/[id]/repuestos/[lineaId]/route.test.ts` (6)
  - `tenant/taller/[id]/route.test.ts` (5)
  - `tallerService.test.ts` (4)
  - `cuentas-financieras/[id]/route.test.ts` (4)
  - `arreglos/[id]/route.test.ts` (4)
  - `requirePermission.test.ts` (3)
  - `serverAuth.test.ts` (2)

### QA manual (reproducir cada caso del Anexo A)
Para cada caso: verificar el mensaje que ve el usuario, el status, y que en Vercel exista una línea de log con el contexto de la ruta y el código de BD. Para los 5xx, además, buscar el `errorId` en Vercel y confirmar que aparece el error completo, junto con las demás líneas del mismo request.

---

## Orden sugerido y riesgos

**Orden**:
1. Fase 1 ✅
2. Fase 1b, con las dos rutas piloto ✅
3. Fase 2.1 (arreglos) y fase 2.2 (operaciones): el mayor volumen de soporte.
4. Fase 3.
5. Fases 2.3 a 2.5.
6. Fase 4.
7. Fase 5.
8. Fase 7.

La fase 6 corre en paralelo. Conviene aplicar su migración **antes** de simplificar las heurísticas de `P0001`.

**Riesgos**:
- **Cambios de status** (500 → 400/409, 404 → 500, 403 → 401 para `28000`): revisar que ningún componente decida en base a `status`. En el relevamiento no se encontró ninguno. Casi todos miran `!res.ok || body.error`.
- **Mensajes técnicos visibles**: hasta que se complete la fase 6, algunos `RAISE` técnicos pueden llegar a la UI. Es preferible a un "Error" genérico, y el `code` permite filtrarlos si hace falta.
- **Volumen de logs**: los 4xx pasan a loguearse como `warn`. Si generan ruido, se puede bajar a `info` los `VALIDATION` que ya valida el frontend.
- **Que `createApiHandler` termine siendo un framework**: lo contienen la regla de sumar un paso solo cuando lo piden dos rutas reales y el criterio de aceptación de que `apiHandler.ts` solo orquesta. Si una opción la usa una sola ruta, va en el controller.
- **Chequeo de tipos de Next 15 sobre `export const GET = …`**: Next valida la firma de los exports de `route.ts` durante el build. ✅ Verificado en la fase 1b: el build pasa con las rutas piloto.
- **Caché de permisos**: `fetchEffectivePermissions` cachea por 1 hora con la clave (rol, plan), sin distinguir usuario ni tenant. Es correcto porque `role_permissions` y `plan_permissions` son catálogos globales con RLS `using (true)`. Hay dos limitaciones:
  - Hoy nadie llama a `invalidatePermissionsCache`, así que un cambio en esas tablas puede tardar hasta una hora en verse.
  - El closure de `unstable_cache` usa el cliente del primer usuario que no encuentra la entrada. Si algún día hay permisos por tenant o una RLS más restrictiva, la clave tiene que incluir el `tenantId`.
- **Validación de sesión más estricta**: las rutas que hoy usan `getSession()` o no chequean nada pasan a validar los claims. Un token inválido que antes llegaba hasta RLS ahora recibe un 401 antes. Es el comportamiento buscado, pero en QA conviene confirmar que no aparezcan 401 espurios justo después de que se renueva la sesión.
- **Carga de permisos en todas las rutas**: las rutas que hoy no consultan permisos (turnos, vehículos) pasan a hacerlo. El costo es bajo, porque `fetchEffectivePermissions` cachea por rol y plan, pero si esa consulta falla la ruta responde 500 en lugar de funcionar.

## Fuera de alcance
- Reescribir las ~246 validaciones 400 existentes: ya devuelven mensajes claros.
- i18n de mensajes.
- Integrar una herramienta de error tracking (Sentry o similar). `onRequestError` y `errorId` dejan la base preparada para sumarla después.
- Agregar permisos a rutas que hoy no los exigen.
- Un pipeline de middlewares configurable o un sistema de plugins para el handler.

---

## Anexo A — Casos concretos relevados

| # | Caso | Qué ve hoy el usuario | Causa | Fase |
|---|---|---|---|---|
| 1 | `POST /api/operaciones` con una validación `22023` (por ejemplo "cuenta financiera requerida para compras y ventas") | **"Unknown"** (500) | `error?.toString()` sobre el enum ([operaciones/route.ts:158](src/app/api/operaciones/route.ts#L158)) | 2.2 |
| 2 | Borrar o editar una venta con comprobante autorizado | **"Stock insuficiente"** | El trigger lanza `P0001` sin `ERRCODE` y `toServiceError` lo trataba como stock | 1.3 ✅ / 6 |
| 3 | `PUT /api/arreglos/[id]` falla en el update (por ejemplo, el arreglo está facturado) | "Error actualizando arreglo", sin log en ninguna capa | `arregloRepository` y `arregloMutationService` descartan la causa | 2.1 |
| 4 | Falla la activación de un presupuesto | Uno de 3 textos genéricos; el mensaje de la RPC no se loguea | Heurísticas por texto ([arregloMutationService.ts:225-243](src/app/api/arreglos/arregloMutationService.ts#L225-L243)) | 2.1 |
| 5 | Crear, editar o borrar un detalle de arreglo | "Error creando/actualizando detalle…", sin log | Enum sin causa | 2.1 |
| 6 | Ingresos, gastos y transferencias con una validación de la RPC (por ejemplo "Las cuentas de origen y destino deben ser distintas") | Mensaje genérico con 400 | `rpcErrorMessage` ignoraba `22023` | 1.4 ✅ |
| 7 | CRUD de cuentas financieras (por ejemplo, borrar una cuenta con movimientos) | "Error eliminando cuenta financiera", sin log | No hay logging | 1b ✅ (`route.ts`) / 2.3 (`[id]/route.ts`) |
| 8 | Renombrar una categoría con un nombre existente | **404 "Categoría de arreglo no encontrada"** | `\|\| !data` antes del chequeo de duplicado | 2.4 |
| 9 | PUT de un producto con código duplicado, PUT de stock, GET/PUT de empleado con error de BD | 404 "no encontrado" | `\|\| !data` | 2.4 |
| 10 | Crear un empleado con DNI duplicado; borrar un empleado, producto, stock o categoría en uso | 500 genérico sin log | `23505`/`23503` → `Unknown` | 2.4 |
| 11 | Error al cargar la lista de turnos | **Nada** | `error` string vs. objeto ([TurnosProvider.tsx:45](src/app/providers/TurnosProvider.tsx#L45)) | 2.5 / 5.3 |
| 12 | Un usuario de plan BASE entra a facturación | `FEATURE_NOT_AVAILABLE_FOR_PLAN` | [serverAuth.ts:135](src/lib/facturacion/serverAuth.ts#L135) | 3 / 4 |
| 13 | Rutas protegidas con `requirePermission` (21 rutas) | `FORBIDDEN_INSUFFICIENT_PERMISSIONS` / `Unauthorized` | [requirePermission.ts:36-51](src/lib/requirePermission.ts#L36-L51) | 1b ✅ (pilotos) / 2 / 3 |
| 14 | Sesión expirada llamando a `/api/*` | `SyntaxError` ("Unexpected token '<'") o nada | El middleware redirige a `/login` y devuelve 200 HTML | 3 / 5.1 |
| 15 | Error interno de facturación | "No se pudo completar la operación de facturación"; en Vercel no aparece la causa de Supabase | `throw new Error(…)` sin `cause` | 4 |
| 16 | Errores de clientes, empresas, representantes y vehículos | Mensaje crudo de Postgres en inglés (por ejemplo "violates foreign key constraint…"), muchas veces sin log | Se devuelve `error.message` tal cual | 2.5 |
| 17 | Eliminar o editar un producto que falla | **Toast de éxito** | El provider ignora el resultado | 5.5 |
| 18 | Abrir un arreglo sin permiso o con un error de servidor | "Arreglo no encontrado" | `ArreglosProvider.fetchById` devuelve `null` | 5.4 |
| 19 | Una excepción no capturada en un handler (por ejemplo, falla la consulta de permisos después de guardar) | Error genérico aunque la operación se haya guardado; 500 HTML | No hay try/catch ni `onRequestError`, y los permisos se consultan después de la mutación | 1.2 ✅ / 1.5 ✅ / 1b ✅ (en las rutas migradas, los permisos se cargan antes del controller) |
