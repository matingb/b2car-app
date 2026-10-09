import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/supabase/server";
import { API_ERROR_MESSAGES } from "@/lib/apiErrorCodes";
import { normalizeUserRole, type UserRoleValue, type PermissionValue } from "@/lib/permissions";
import { normalizeSubscriptionPlan, type SubscriptionPlanValue } from "@/lib/subscription";
import { fetchEffectivePermissions } from "@/lib/permissions.server";
import { isValidUuid } from "@/lib/uuid";
import { ApiError } from "./apiError";

export type ApiActor = {
  userId: string;
  tenantId: string;
  role: UserRoleValue;
  plan: SubscriptionPlanValue;
};

export type ApiContext = {
  supabase: SupabaseClient;
  actor: ApiActor;
  permissions: readonly PermissionValue[];
  can(permission: PermissionValue): boolean;
};

export async function buildApiContext(): Promise<ApiContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const role = normalizeUserRole(claims?.user_role);
  const plan = normalizeSubscriptionPlan(claims?.plan_sub);
  const userId = claims?.sub;
  const tenantId = claims?.tenant_id;

  if (error || !role || !plan || !isValidUuid(userId) || !isValidUuid(tenantId)) {
    throw new ApiError(401, API_ERROR_MESSAGES.UNAUTHORIZED, "UNAUTHORIZED");
  }

  const permissions = await fetchEffectivePermissions(supabase, role, plan);
  const permissionSet = new Set(permissions);
  return {
    supabase,
    actor: { userId, tenantId, role, plan },
    permissions,
    can: (permission) => permissionSet.has(permission),
  };
}
