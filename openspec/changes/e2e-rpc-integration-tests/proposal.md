# Proposal: Tests de integracion E2E para RPCs de Supabase

**Change ID:** `e2e-rpc-integration-tests`
**Created:** 2026-05-13
**Status:** Draft

---

## Problem Statement

- Actualmente los 68 archivos de test usan mocks del cliente Supabase. No hay ningun test que valide que los RPCs de PostgreSQL funcionen correctamente contra una base de datos real.
- Las funciones RPC como `rpc_crear_arreglo_completo` contienen logica de negocio critica (transacciones, validaciones de stock, creacion de productos inline) que solo se puede verificar contra Postgres.
- Errores en migraciones SQL o cambios en la firma de RPCs pasan desapercibidos hasta produccion.
- El core del sistema (crear arreglo con servicios, repuestos existentes y repuestos nuevos) no tiene cobertura end-to-end.

## Proposed Solution

Agregar tests de integracion usando **Vitest** (el framework que ya usa el proyecto) con una config separada que:

1. Usa `environment: 'node'` (sin jsdom) para llamar directamente a `supabase.rpc(...)` con `@supabase/supabase-js`.
2. Se conecta a una instancia real de Supabase (local via Docker o cloud via env vars).
3. Usa `service_role` key para bypassear RLS y simplificar el setup.
4. Cada test crea datos, los valida y los limpia.

### Flujo de ejecucion

```
Vitest (node) → supabase.rpc("rpc_crear_arreglo_completo", {...}) → PostgREST → PostgreSQL
                                                                                    ↓
                                        ← resultado / error ← PostgREST ← PostgreSQL
```

### Entornos soportados

| Entorno | Supabase | Como |
|---------|----------|------|
| Local (dev) | `supabase start` (Docker) | URL `http://127.0.0.1:54321`, key del CLI output |
| GitHub Actions | `supabase start` en el workflow | Docker disponible en `ubuntu-latest` |
| Vercel pipeline | Proyecto Supabase Cloud de staging | Credenciales en env vars de Vercel |

Los tests leen `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del entorno, lo que los hace agnosticos al backend.

## Scope

### In Scope

- Config de Vitest separada para integration tests (`vitest.integration.config.ts`)
- Helper para crear cliente Supabase de testing con service_role key
- Tests de integracion para `rpc_crear_arreglo_completo` (caso basico, con servicios, con repuestos existentes, con repuestos nuevos, errores de stock, errores de codigo duplicado)
- Script `test:integration` en package.json
- Workflow de GitHub Actions para correr los integration tests con `supabase start`

### Out of Scope

- Tests E2E de browser (Playwright/Cypress) - no se necesitan para validar RPCs
- Tests de integracion para otros RPCs (se pueden agregar incrementalmente)
- Proyecto Supabase Cloud de staging (el usuario lo configura por su cuenta)
- Tests de las API routes HTTP de Next.js (ya cubiertos por los unit tests con mocks)
- Cambios en los RPCs o migraciones SQL

## Impact Analysis

| Component | Change Required | Details |
|-----------|-----------------|---------|
| Database | No | Se usa la DB existente (local o cloud) con seed data |
| API | No | No se tocan las API routes |
| State | No | No se toca el frontend |
| UI | No | No se toca el frontend |
| Testing infra | Si | Nueva config de Vitest + helpers + workflow CI |

## Architecture Considerations

- **Patron existente**: Los unit tests mockean `createClient()` de `@/supabase/server`. Los integration tests usan `createClient()` de `@supabase/supabase-js` directamente (sin SSR/cookies).
- **No se introduce un nuevo framework**: Se reutiliza Vitest con una config separada, manteniendo la coherencia del proyecto.
- **Seed data**: Los tests aprovechan los datos existentes en `supabase/seed.sql` (vehiculos, talleres, stocks con IDs conocidos).
- **Aislamiento**: `fileParallelism: false` en la config de integracion para evitar conflictos en la DB. Cada test limpia lo que crea.

## Success Criteria

- [ ] `npm run test:integration` corre exitosamente contra `supabase start` local
- [ ] El test de `rpc_crear_arreglo_completo` basico crea un arreglo y lo verifica en la tabla `arreglos`
- [ ] Los tests de error (stock insuficiente, codigo duplicado) validan los mensajes esperados
- [ ] El workflow de CI corre los integration tests automaticamente en PRs
- [ ] Los tests son deterministas (no fallan por estado previo de la DB)

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Seed data cambia y rompe tests | Media | Media | Usar constantes con los IDs del seed en un helper centralizado |
| Docker no disponible en CI | Baja | Alta | GitHub Actions soporta Docker nativamente; para Vercel usar proyecto Cloud |
| Tests lentos por I/O real | Media | Baja | Timeout de 30s por test; correr solo en CI, no en pre-commit |
| Conflictos de estado entre tests | Media | Media | `fileParallelism: false` + cleanup en afterEach |
| Service role key expuesta | Baja | Alta | Solo en env vars de CI (nunca hardcodeada); proyecto de staging aislado |
