import { normalizeSubscriptionPlan } from "@/lib/subscription";
import type { TelemetryIdentity } from "./types";

export function compact<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as T;
}

export function identityFromClaims(claims?: Record<string, unknown> | null): TelemetryIdentity | null {
  if (!claims?.sub) return null;
  const user = compact({
    id: String(claims.sub),
    role: claims.user_role ? String(claims.user_role) : undefined,
    email: claims.email ? String(claims.email) : undefined,
  });
  const account = claims.tenant_id
    ? compact({
      id: String(claims.tenant_id),
      name: claims.tenant_name ? String(claims.tenant_name) : undefined,
      plan: normalizeSubscriptionPlan(claims.plan_sub) || undefined,
    })
    : undefined;

  return { user, account };
}
