import { normalizeSubscriptionPlan } from "@/lib/subscription";
import type { TelemetryIdentity, TelemetryAttributes } from "./types";

export function compact<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as T;
}

export function buildTelemetryAttributes(identity: TelemetryIdentity): TelemetryAttributes {
  const attrs: TelemetryAttributes = {
    "user.id": identity.user.id,
  };
  if (identity.user.email) attrs["user.email"] = String(identity.user.email);
  if (identity.user.role) attrs["user.role"] = String(identity.user.role);
  if (identity.user.name) attrs["user.name"] = String(identity.user.name);

  if (identity.account) {
    attrs["tenant.id"] = String(identity.account.id);
    if (identity.account.name) attrs["tenant.name"] = String(identity.account.name);
    if (identity.account.plan) attrs["tenant.plan"] = String(identity.account.plan);
  }
  return attrs;
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

