# Ensayos locales del rediseño

Usar únicamente una instancia local descartable. No ejecutar el fixture ni el reset en producción.

## Migración desde el esquema anterior

1. `npx supabase db reset --local --version 20261017100000 --no-seed`
2. Ejecutar `fixture_previa.sql` con `psql -v ON_ERROR_STOP=1` sobre `127.0.0.1:54322/postgres`.
3. `npx supabase migration up --local`
4. Ejecutar `verificar_fixture.sql` y `diagnostico.sql` en esa misma base.

El fixture cubre favorita distinta de la primera cuenta, fallback sin favorita, exclusión de cuentas inactivas, neto cero, ajustes de ambos signos y el gasto histórico con varias ediciones de igual monto. `verificar_fixture.sql` también edita y anula ese gasto, con rollback.

## Diagnóstico de la copia migrada

`diagnostico.sql` solo lee datos. La primera consulta debe devolver cero filas y el validador de documentos no debe lanzar errores. Comprueba saldos, pagos, originales financieros vigentes, cumplimiento, reservas, cantidades de stock, tipo obsoleto e integridad de las hijas y sus tenants.

Comparar además cuentas y stocks contra sus valores anteriores a las migraciones. No alcanza con que el saldo coincida con el ledger: ambos podrían haber cambiado juntos.

`finanzas_historicas.sql` comprueba edición y anulación del gasto auditado de producción sobre la copia local, siempre con rollback. Requiere ese documento concreto; para una base ficticia usar `verificar_fixture.sql`.

## Notas de crédito y uso normal

Ejecutar `notas_credito.sql` en una base migrada con al menos un usuario local; puede prepararse con `supabase/seed.sql`. Revierte todos sus datos. Cubre siete casos: crédito total con devolución parcial o sin devolución, venta sin entrega, factura simplificada, créditos parciales y descuento inferior a una unidad. También verifica el rechazo antes de autorizar de devoluciones superiores a lo entregado, la repetición idempotente de la finalización y el saldo físico.

`npm run test:integration` cubre permisos, rechazo de escrituras directas, cliente/proveedor opcionales, referencias de otro tenant, edición de un pago parcial, compras de repuestos del rol operativo y reservas simultáneas. Configurar las variables del harness exclusivamente para Supabase local: `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL` en `http://127.0.0.1:54321`, `DATABASE_URL` en `postgresql://postgres:postgres@127.0.0.1:54322/postgres` y las claves locales habituales.

El harness trunca y vuelve a cargar el seed antes de cada test: la copia de producción debe verificarse antes de correr integración.
