import { normalizeSubscriptionPlan } from "@/lib/subscription";
import type { TelemetryIdentity, TelemetryAttributes } from "./types";

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function compact<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as T;
}

export function buildTelemetryAttributes(identity: TelemetryIdentity): TelemetryAttributes {
  const userId = toNonEmptyString(identity.user.id);
  const attrs: TelemetryAttributes = {};
  if (userId) attrs["user.id"] = userId;

  const email = toNonEmptyString(identity.user.email);
  const role = toNonEmptyString(identity.user.role);
  if (email) attrs["user.email"] = email;
  if (role) attrs["user.role"] = role;

  if (identity.account) {
    const tenantId = toNonEmptyString(identity.account.id);
    const tenantName = toNonEmptyString(identity.account.name);
    const tenantPlan = toNonEmptyString(identity.account.plan);
    if (tenantId) attrs["tenant.id"] = tenantId;
    if (tenantName) attrs["tenant.name"] = tenantName;
    if (tenantPlan) attrs["tenant.plan"] = tenantPlan;
  }
  return attrs;
}

export function identityFromClaims(claims?: Record<string, unknown> | null): TelemetryIdentity | null {
  const userId = toNonEmptyString(claims?.sub);
  if (!userId) return null;

  const user = compact({
    id: userId,
    role: toNonEmptyString(claims?.user_role),
    email: toNonEmptyString(claims?.email),
  });
  const tenantId = toNonEmptyString(claims?.tenant_id);
  const account = tenantId
    ? compact({
      id: tenantId,
      name: toNonEmptyString(claims?.tenant_name),
      plan: normalizeSubscriptionPlan(claims?.plan_sub) || undefined,
    })
    : undefined;

  return { user, account };
}
