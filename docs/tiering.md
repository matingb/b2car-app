# Tiering por tenant

Cada tenant tiene `public.tenants.plan_sub` con uno de estos valores:

- `BASE`: no incluye facturación electrónica ni su configuración fiscal.
- `PRO`: habilita ambas funcionalidades.

En `BASE`, el formulario de creacion de arreglos no muestra la opcion
"Arreglo facturable" y las altas se guardan siempre con `es_facturable = false`.

## Cambio operativo de plan

El plan no se modifica desde B2Car. Un administrador de la base debe ejecutar, por ejemplo:

```sql
UPDATE public.tenants
SET plan_sub = 'PRO' -- usar 'BASE' para degradar
WHERE id = '<tenant-uuid>';
```

Para degradar, se ejecuta la misma sentencia con `plan_sub = 'BASE'`.

El cambio entra en vigencia cuando Supabase emite el siguiente access token (refresh de sesión o próximo inicio de sesión). No hay revocación inmediata de tokens existentes.

## Nueva feature exclusiva de PRO

1. Agregar la feature al catálogo de `src/lib/subscription.ts` y marcarla como `false` para `BASE` y `true` para `PRO`.
2. Asociar páginas y APIs en `featureForPath()` con coincidencia por segmento de ruta.
3. Ocultar sus accesos en la UI con `useTenant().hasFeature()` y validar la feature en el handler de servidor.
4. Agregar casos BASE, PRO, claim inválido y rutas hijas a las pruebas.

## Límite actual

La protección cubre la UI y las API Routes de B2Car. Las políticas RLS y grants fiscales existentes siguen permitiendo acceso por tenant a la Data API de Supabase; el tiering a nivel de datos queda fuera de esta primera versión.
