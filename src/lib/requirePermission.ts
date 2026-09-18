import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/supabase/server";
import { normalizeUserRole, type PermissionValue } from "@/lib/permissions";
import { normalizeSubscriptionPlan } from "@/lib/subscription";
import { fetchEffectivePermissions } from "@/lib/permissions.server";
import { logger } from "@/lib/logger";

/**
 * Valida que la sesión actual tenga el permiso requerido en base a la BD
 * (intersección de role_permissions y plan_permissions).
 *
 * Si no está autorizado o no tiene el permiso concedido, retorna un `Response`
 * para ser devuelto directamente por el Route Handler:
 * - 401 si no hay sesión o claims válidos
 * - 403 si el rol/plan no tiene el permiso
 * - 500 si ocurre un error de BD
 *
 * Si la autorización es exitosa, retorna `null`.
 *
 * @example
 * ```ts
 * const authError = await requirePermission(Permission.DashboardView);
 * if (authError) return authError;
 * ```
 */
export async function requirePermission(
  permission: PermissionValue,
  existingSupabase?: SupabaseClient,
): Promise<Response | null> {
  const supabase = existingSupabase ?? (await createClient());
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const claims = data.claims as Record<string, unknown>;
  const role = normalizeUserRole(claims.user_role);
  const plan = normalizeSubscriptionPlan(claims.plan_sub);

  if (!role || !plan) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const perms = await fetchEffectivePermissions(supabase, role, plan);
    if (!perms.includes(permission)) {
      return Response.json(
        { error: "FORBIDDEN_INSUFFICIENT_PERMISSIONS" },
        { status: 403 },
      );
    }
  } catch (err) {
    logger.error("Error al verificar permisos en requirePermission:", err);
    return Response.json(
      { error: "Error al verificar permisos" },
      { status: 500 },
    );
  }

  return null;
}
