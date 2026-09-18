import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionValue } from "@/lib/permissions";

export const PERMISSIONS_CACHE_TAG = "permissions";

export function permissionsTag(userRole: string, planSub: string): string {
  return `${PERMISSIONS_CACHE_TAG}:${userRole}:${planSub}`;
}

/**
 * Invalida la caché de permisos de Next.js.
 * Si se especifican rol y plan, invalida ese par específico; de lo contrario invalida todo el catálogo.
 */
export function invalidatePermissionsCache(userRole?: string, planSub?: string): void {
  try {
    if (userRole && planSub) {
      revalidateTag(permissionsTag(userRole, planSub));
    } else {
      revalidateTag(PERMISSIONS_CACHE_TAG);
    }
  } catch {
    // ignore
  }
}

/**
 * Consulta en la base de datos los permisos efectivos de un rol y plan.
 */
export async function queryEffectivePermissions(
  supabase: SupabaseClient,
  userRole: string,
  planSub: string,
): Promise<PermissionValue[]> {
  const [{ data: rolePerms, error: roleError }, { data: planPerms, error: planError }] =
    await Promise.all([
      supabase
        .from("role_permissions")
        .select("permission")
        .eq("role", userRole)
        .eq("granted", true),
      supabase
        .from("plan_permissions")
        .select("permission")
        .eq("plan", planSub)
        .eq("granted", true),
    ]);

  if (roleError || planError) {
    throw new Error(
      `Error al obtener permisos: ${roleError?.message ?? planError?.message}`,
    );
  }

  const planSet = new Set(planPerms?.map((p) => p.permission) ?? []);
  return (rolePerms ?? [])
    .map((r) => r.permission as PermissionValue)
    .filter((p) => planSet.has(p));
}

/**
 * Calcula los permisos efectivos del usuario intersectando role_permissions
 * y plan_permissions en la BD, utilizando la caché de Next.js (`unstable_cache`).
 *
 * @param supabase - Cliente autenticado de Supabase (server-side).
 * @param userRole - Slug del rol del usuario (ej: 'admin', 'operativo').
 * @param planSub  - Slug del plan del tenant (ej: 'BASE', 'PRO').
 * @returns Array con los permisos efectivos del usuario.
 */
export async function fetchEffectivePermissions(
  supabase: SupabaseClient,
  userRole: string,
  planSub: string,
): Promise<PermissionValue[]> {
  const getCached = unstable_cache(
    async () => queryEffectivePermissions(supabase, userRole, planSub),
    ["effective-permissions", userRole, planSub],
    {
      revalidate: 3600,
      tags: [PERMISSIONS_CACHE_TAG, permissionsTag(userRole, planSub)],
    },
  );

  return await getCached();
}
