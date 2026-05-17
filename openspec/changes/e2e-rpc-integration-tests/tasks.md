# Implementation Tasks: Tests de integracion E2E para RPCs

**Change ID:** `e2e-rpc-integration-tests`

---

## Phase 1: Infraestructura de testing

- [ ] 1.1 Crear `vitest.integration.config.ts` con `environment: 'node'`, `include: ['src/**/*.integration.test.ts']`, `testTimeout: 30_000`, `fileParallelism: false`
- [ ] 1.2 Crear `src/tests/integration/supabaseTestClient.ts` con `createTestClient()` usando `@supabase/supabase-js` + service_role key desde env vars
- [ ] 1.3 Crear constantes de seed data (IDs de vehiculos, talleres, stocks, tenant) en el mismo helper
- [ ] 1.4 Agregar funcion `cleanupArreglo(supabase, arregloId)` para borrar arreglo y datos relacionados despues de cada test
- [ ] 1.5 Agregar script `"test:integration": "vitest run --config vitest.integration.config.ts"` a `package.json`

**Quality Gate:**
- [ ] `npm run test:integration` ejecuta sin errores (0 tests encontrados pero no falla)
- [ ] El helper se conecta correctamente a Supabase local (`supabase start`)

---

## Phase 2: Tests de creacion de arreglo

- [ ] 2.1 Test: crear arreglo basico (sin detalles, sin repuestos) - verificar que retorna UUID y el arreglo existe en `arreglos`
- [ ] 2.2 Test: crear arreglo con servicios (detalles) - verificar que se crean las lineas en `arreglo_detalles`
- [ ] 2.3 Test: crear arreglo con repuestos existentes - verificar que descuenta stock correctamente
- [ ] 2.4 Test: crear arreglo con repuestos nuevos (inline) - verificar que crea producto, stock y asignacion
- [ ] 2.5 Test: error por stock insuficiente - verificar que lanza `STOCK_INSUFICIENTE`
- [ ] 2.6 Test: error por codigo de producto duplicado - verificar que lanza `PRODUCTO_CODIGO_DUPLICADO`

**Quality Gate:**
- [ ] Todos los tests pasan contra `supabase start` local
- [ ] Cada test limpia sus datos (la DB queda en el mismo estado que empezo)

---

## Phase 3: CI / Pipeline

- [ ] 3.1 Crear o actualizar `.github/workflows/test.yml` para agregar un job de integration tests que: instale Supabase CLI, ejecute `supabase start`, exporte env vars, corra `npm run test:integration`
- [ ] 3.2 Verificar que el workflow pasa en un PR de prueba
- [ ] 3.3 Documentar en README como correr integration tests localmente (`supabase start` + `npm run test:integration`)

**Quality Gate:**
- [ ] CI pasa con integration tests en un PR
- [ ] Instrucciones de ejecucion local documentadas

---

## Completion Checklist

- [ ] All phases complete
- [ ] All quality gates passed
- [ ] Tests deterministas y aislados
- [ ] CI corriendo integration tests automaticamente
- [ ] Ready for `/openspec-archive`
