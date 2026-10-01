import "server-only";

import { API_ERROR_MESSAGES } from "@/lib/apiErrorCodes";
import type { PermissionValue } from "@/lib/permissions";
import { fetchPlanPermissions } from "@/lib/permissions.server";
import type { ApiContext } from "./apiContext";
import { ApiError } from "./apiError";

export async function assertPermission(
  ctx: ApiContext,
  required: PermissionValue | readonly PermissionValue[],
): Promise<void> {
  const permissions = typeof required === "string" ? [required] : required;
  const missing = permissions.filter((permission) => !ctx.can(permission));
  if (!missing.length) return;

  const planPermissions = await fetchPlanPermissions(ctx.supabase, ctx.actor.plan);
  if (missing.some((permission) => !planPermissions.includes(permission))) {
    throw new ApiError(403, API_ERROR_MESSAGES.FEATURE_NOT_AVAILABLE_FOR_PLAN, "FEATURE_NOT_AVAILABLE_FOR_PLAN");
  }
  throw new ApiError(403, API_ERROR_MESSAGES.FORBIDDEN, "FORBIDDEN");
}
