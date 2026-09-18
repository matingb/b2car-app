import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionValue } from "@/lib/permissions";

/**
 * Calcula los permisos efectivos del usuario intersectando role_permissions
 * y plan_permissions en la BD.
 *
 * Un permiso se concede si y solo si está en `granted = true` tanto en la
 * tabla de permisos del rol como en la del plan de suscripción.
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
