---
id: stock-vehiculos-descubrimiento
module: stock-vehiculos
status: PARTIAL
verification: static
ux_verified: false
observed_at: 2026-10-13
version: pending
environment: pending
role: pending
plan: pending
tenant: pending
sources: [src/clients/stocksClient.ts, src/clients/vehiculoClient.ts, src/model/stock.ts, src/model/types.ts, src/app/(user)/stock/page.tsx, src/app/(user)/stock/[id]/page.tsx, src/app/(user)/vehiculos/page.tsx, src/app/api/vehiculos/route.ts, supabase/schemas/public/tables/stocks.sql, supabase/schemas/public/tables/productos.sql, supabase/schemas/public/tables/vehiculos.sql]
---
# Descubrimiento funcional: stock y vehículos

## Alcance y estado
Inspección estática del checkout /home/openclaw/b2car-app. No se ejecutó la aplicación ni se verificaron URL/entorno, versión desplegada, rol, plan o tenant. PARTIAL: comprobada estructura, contratos de cliente y esquema; comportamiento runtime y UX no verificados. Revisé docs/product/clientes-empleados.md como antecedente; no identifiqué aquí decisión aprobada específica.

## Stock
### Observaciones de código
- Rutas src/app/(user)/stock/page.tsx y [id]/page.tsx; la raíz redirige a /productos (sin verificación navegador).
- stocksClient expone GET lista, GET por taller (trim de tallerId), GET por id, POST upsert, PUT update y DELETE en /api/stocks[/{id}]. Mapea respuestas HTTP/red a errores; escrituras no probadas.
- StockItem incluye producto/taller, cantidades actual/mínima/máxima, costo/precio, proveedor, categorías, visibilidad e historial. StockMovement tipa entrada/salida, fecha, cantidad y motivo.
- Supabase stocks: cantidad/min/max enteras no negativas; unicidad taller+producto; FK a talleres/productos con cascade; tenant_id, RLS y tenant_access mediante current_tenant_id(). Productos se modela por separado con código/nombre/precios/costo/proveedor/categorías/show_in_stock y unicidad tenant+código.
### UX y límites
Flujo visual, estados vacíos/error, validaciones, efectos de movimientos y permisos no comprobados. Pendiente inspeccionar handlers/API de stock y componentes; tipos y esquema no prueban UX ni reglas aprobadas.

## Vehículos
### Observaciones de código
- /vehiculos consume VehiculosProvider, ofrece búsqueda por valores del objeto, spinner, tarjetas, botón Crear vehiculo que abre CreateVehiculoModal; tarjeta navega a /vehiculos/[id]. Inferido estáticamente, no probado navegador.
- vehiculoClient expone GET colección/detalle y cliente, POST alta, PUT edición, DELETE y PUT reasignación del propietario.
- POST API rechaza JSON inválido o falta cliente_id/patente (400); normaliza chasis/motor a mayúsculas y default de otros campos a cadena vacía. SQL 23505 produce 409 por patente existente; otros errores de inserción 500; éxito 201 y notificación a stats. Requests no ejecutados.
- Modelo Vehiculo enlaza cliente y patente/marca/modelo/fecha/chasis, con internos/color/motor opcionales. Esquema vehiculos tiene FK a clientes ON DELETE CASCADE, patente única por tenant, tenant_id y RLS tenant_access. Triggers en cambio cliente_id bloquean mutación según función de facturación y sincronizan arreglos; condición efectiva pendiente de inspección, no inferir regla de reasignación.
### UX y límites
Sin prueba de modal, detalle, búsqueda, errores, permisos o efectos. Revisar provider, modal, página detalle, handlers restantes y funciones referidas por triggers.

## Reglas aprobadas
UNKNOWN: no se identificó fuente aprobada específica; lo descrito es evidencia de código/esquema, no decisión funcional.

## Preguntas y próxima verificación
Falta revisar reporte de tarjeta 8cfbf6ba-b38d-4084-baf7-dd2848ec0a5e y tickets/decisiones específicos. Para prueba dinámica hacen falta URL de pruebas, tenant/cuenta sintéticos, rol, plan y versión desplegada. Luego verificar estados, validaciones, conflicto de patente, reasignación y permisos con datos sintéticos autorizados; no borrar ni mutar datos reales ni hacer acciones irreversibles. No se navegaron entornos ni se cambiaron datos.

## Fuentes
Checkout /home/openclaw/b2car-app: src/clients/stocksClient.ts; src/clients/vehiculoClient.ts; src/model/stock.ts; src/model/types.ts; src/app/(user)/stock/page.tsx; src/app/(user)/vehiculos/page.tsx; src/app/api/vehiculos/route.ts; supabase/schemas/public/tables/{stocks,productos,vehiculos}.sql. Sin capturas; UX pendiente.
