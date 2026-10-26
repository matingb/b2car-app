# Backend API Instructions

This file guides development for backend endpoints, services, repositories, and error handling located under `src/app/api/`.

## Architecture (Routes, Services, Repositories)

Follow a layered architecture for API endpoints:

1. **Routes (`route.ts`)**:
   - **Responsibility**: HTTP transport layer and request lifecycle.
   - Receive incoming HTTP requests, parse parameters, and validate input payloads (body, query params, URL segments).
   - Check authentication and authorization (e.g. `requirePermission(...)` from `@/lib/requirePermission`).
   - Delegate business logic execution directly to the corresponding service.
   - Format and return HTTP responses with appropriate status codes (e.g., 200, 201, 400, 404, 500) satisfying typed contracts (e.g. `satisfies CreateItemResponse`).
   - **Do not** write business rules, domain calculations, or direct database queries in route handlers.

2. **Services (`*Service.ts`)**:
   - **Responsibility**: Business and domain logic.
   - Contain business rules, domain calculations, workflow orchestration, and domain-level error handling.
   - Access the database exclusively through repositories.
   - Accept repository interfaces via dependency injection (defaulting to the concrete repository instance) to allow straightforward unit testing without real database access:
     ```ts
     export function createItemService(repo: ItemRepository = supabaseItemRepository) {
       return {
         async list(supabase: SupabaseClient, filters?: Filters) {
           const { data, error } = await repo.list(supabase, filters);
           if (error) return { data: [], error: toServiceError(error) };
           return { data, error: null };
         },
       };
     }
     ```
   - **Do not** handle HTTP primitives (`Request`, `Response`, status codes, headers).

3. **Repositories (`*Repository.ts`)**:
   - **Responsibility**: Data access and database communication.
   - Execute queries, filters, joins, inserts, updates, and deletes directly against Supabase via `SupabaseClient`.
   - Return raw database rows/entities and database errors (`PostgrestError`).
   - Define TypeScript row types and the repository interface (`*Repository`).
   - **Do not** enforce business rules or handle HTTP concerns.

## Error Handling

- Use `ServiceError` and `toServiceError(...)` from `@/app/api/serviceError` to standardize domain errors across services and routes.
- Map `ServiceError` values to appropriate HTTP status codes in routes:
  - `ServiceError.NotFound` -> 404
  - `ServiceError.Conflict` -> 409
  - `ServiceError.Forbidden` -> 403
  - Other errors -> 500

## Testing

- Colocate unit tests alongside their respective code (`*.test.ts`).
- Services should be tested with mock repositories.
- Repositories should be tested with mock Supabase clients.
