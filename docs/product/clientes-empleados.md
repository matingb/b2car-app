---
id: clientes-empleados-descubrimiento
module: clientes-empleados
status: PARTIAL
observed_at: 2026-10-12
version: 427760a
environment: not-verified (static analysis only)
role: pending
plan: pending
sources: [src/clients/clientes/clientesClient.ts, src/clients/clientes/particularClient.ts, src/clients/clientes/empresaClient.ts, src/clients/empleadosClient.ts, src/app/(user)/clientes/page.tsx, src/app/(user)/empleados/page.tsx, src/app/api/clientes/route.ts, src/app/api/empleados/route.ts]
---
# Descubrimiento: clientes y empleados

## Alcance
Inspección estática del checkout /home/openclaw/b2car-app, commit 427760a (2026-10-12). No se navegó la aplicación ni se verificaron URL de pruebas, rol, plan o tenant; UX no comprobada. Estado PARTIAL. No se identificó en esta inspección una decisión/ticket aprobado, por lo que no se atribuyen reglas normativas.

## Clientes
Rutas: /clientes (listado/alta) y /clientes/[id] (detalle, tabs/componentes de perfil, cuenta corriente, vehículos y arreglos). Listado muestra búsqueda, filtros por tipo (particular/empresa) y saldo (PENDIENTE/AL_DIA/A_FAVOR), botón Crear cliente. El código aplica debounce de 250 ms y solicita lotes de 50; API /api/clientes acepta search/tipo/saldo/limit y normaliza tipos/saldos inválidos a ausencia. Clientes API clients contemplan alta/edición/borrado de particulares y empresas, representantes, resumen financiero y cuenta corriente. Evidencia de código, no de persistencia efectiva ni validaciones UX.

Permisos: no se observó guard explícito de permisos en GET /api/clientes revisado; middleware/RLS/servicios no auditados integralmente. No inferir acceso público.

## Empleados
/empleados redirige a ROUTES.configuracionEmpleados; gestión en /configuracion/empleados, también existe /empleados/[id]. empleadosClient ofrece listado (filtro tallerId), detalle, alta/edición, historial salarial y borrado en /api/empleados. Handler GET requiere claims (401 si faltan) y oculta salario/valor hora si falta EmpleadosView; POST requiere EmpleadosEdit y valida JSON, taller_id y nombre al menos parcialmente. Son evidencias estáticas, sin prueba interactiva ni extensión de permisos a otros métodos.

## Estado por capacidad
- Clientes listado/búsqueda/filtros: PARTIAL (código sí, UX no).
- Clientes CRUD/detalle: PARTIAL; efectos/validaciones runtime UNKNOWN.
- Empleados gestión: PARTIAL; UX/perfiles no probados.
- Control EmpleadosView/EmpleadosEdit: PARTIAL (handlers; sin entorno probado).
- Reglas aprobadas: UNKNOWN.

## No explorado / preguntas
Bloqueo para completar: no consta URL/tenant de homologación, usuario/rol/plan ni versión desplegada. ¿Qué entorno y cuentas sintéticas usar? ¿Qué decisión/ticket aprobado define campos obligatorios, unicidad, borrado/desactivación y visibilidad salarial? No se probaron errores runtime, RLS/middleware completo ni operaciones de escritura. Una vez habilitado entorno: verificar rutas, filtros, validaciones con datos sintéticos y permisos; evitar borrados y efectos fiscales/financieros reales.

## Evidencia
Fuentes estáticas: src/clients/clientes/{clientesClient,particularClient,empresaClient}.ts; src/clients/empleadosClient.ts; src/app/(user)/clientes/page.tsx; src/app/(user)/empleados/page.tsx; src/app/api/clientes/route.ts; src/app/api/empleados/route.ts. Sin capturas: no se verificó entorno de pruebas.