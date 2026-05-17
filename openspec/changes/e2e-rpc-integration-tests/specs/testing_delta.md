# Delta: Testing Infrastructure

**Change ID:** `e2e-rpc-integration-tests`
**Affects:** vitest config, package.json scripts, CI workflow, test helpers

---

## ADDED

### Requirement: Vitest Integration Config

Configuracion separada de Vitest para tests de integracion que corren contra una DB real.

#### Scenario: Correr integration tests localmente
- GIVEN que `supabase start` esta corriendo y las env vars `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` estan definidas
- WHEN el usuario ejecuta `npm run test:integration`
- THEN Vitest corre todos los archivos `*.integration.test.ts` en environment `node`
- AND los tests se ejecutan secuencialmente (`fileParallelism: false`)
- AND el timeout por test es de 30 segundos

#### Scenario: Correr integration tests en CI
- GIVEN que el workflow de GitHub Actions levanta `supabase start`
- WHEN se hace push o PR a `main`
- THEN el job de integration tests instala Supabase CLI, ejecuta `supabase start`, y corre `npm run test:integration`
- AND el job reporta pass/fail independientemente del job de unit tests

### Requirement: Supabase Test Client Helper

Helper que provee un cliente Supabase configurado con service_role key para tests de integracion.

#### Scenario: Crear cliente de test
- GIVEN que las env vars estan definidas
- WHEN un test llama a `createTestClient()`
- THEN retorna un `SupabaseClient` conectado a la instancia configurada con service_role key
- AND el cliente bypassea RLS

#### Scenario: Env vars no definidas
- GIVEN que `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` no estan definidas
- WHEN un test intenta crear el cliente
- THEN falla con un mensaje claro indicando que faltan las env vars

### Requirement: Tests de rpc_crear_arreglo_completo

Validacion end-to-end del RPC principal de creacion de arreglos.

#### Scenario: Crear arreglo basico
- GIVEN vehiculo y taller existentes en la DB (seed data)
- WHEN se llama a `rpc_crear_arreglo_completo` con datos minimos (vehiculo_id, taller_id, fecha, estado)
- THEN retorna un UUID valido
- AND el arreglo existe en la tabla `arreglos` con los datos correctos

#### Scenario: Crear arreglo con servicios
- GIVEN vehiculo y taller existentes
- WHEN se llama al RPC con `p_detalles` conteniendo servicios (descripcion, cantidad, valor)
- THEN el arreglo se crea correctamente
- AND existen registros en `arreglo_detalles` vinculados al arreglo

#### Scenario: Crear arreglo con repuestos existentes
- GIVEN vehiculo, taller y stock con cantidad conocida (ej: 45 unidades de Aceite 5W30)
- WHEN se llama al RPC con `p_repuestos` referenciando el stock_id
- THEN el arreglo se crea correctamente
- AND el stock se descuenta en la cantidad indicada
- AND existe una operacion de tipo `ASIGNACION_ARREGLO` vinculada

#### Scenario: Crear arreglo con repuestos nuevos (inline)
- GIVEN vehiculo y taller existentes
- WHEN se llama al RPC con `p_repuestos_nuevos` conteniendo codigo, nombre, precios y cantidad
- THEN se crea un nuevo producto en `productos`
- AND se crea un registro de stock en `stocks`
- AND el arreglo queda vinculado al nuevo repuesto

#### Scenario: Error por stock insuficiente
- GIVEN un stock con cantidad conocida (ej: 8 unidades de Bateria)
- WHEN se llama al RPC pidiendo mas unidades de las disponibles
- THEN el RPC falla con un error que contiene `STOCK_INSUFICIENTE`
- AND no se crea ningun arreglo (transaccion rollback)

#### Scenario: Error por codigo de producto duplicado
- GIVEN un producto existente con codigo `ACE-5W30`
- WHEN se llama al RPC con `p_repuestos_nuevos` usando el mismo codigo
- THEN el RPC falla con un error que contiene `PRODUCTO_CODIGO_DUPLICADO`
- AND no se crea ningun arreglo (transaccion rollback)

---

## MODIFIED

(None)

---

## REMOVED

(None)
