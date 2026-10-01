import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/supabase/server";
import { fetchEffectivePermissions, fetchPlanPermissions } from "@/lib/permissions.server";
import { Permission, UserRole, type PermissionValue, type UserRoleValue } from "@/lib/permissions";
import { SubscriptionPlan, type SubscriptionPlanValue } from "@/lib/subscription";

/** Call after mocking @/supabase/server and @/lib/permissions.server in the test file. */
export function mockApiSession(options: {
  role?: UserRoleValue;
  plan?: SubscriptionPlanValue;
  permissions?: PermissionValue[];
  planPermissions?: PermissionValue[];
  claims?: Record<string, unknown> | null;
  claimsError?: Error;
  supabase?: SupabaseClient;
} = {}) {
  const claims = options.claims === undefined ? {
    sub: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    user_role: options.role ?? UserRole.Admin,
    plan_sub: options.plan ?? SubscriptionPlan.Pro,
  } : options.claims;
  const getClaims = vi.fn().mockResolvedValue({ data: claims ? { claims } : null, error: options.claimsError ?? null });
  const supabase = options.supabase ?? { rpc: vi.fn(), from: vi.fn() } as unknown as SupabaseClient;
  Object.assign(supabase, { auth: { ...supabase.auth, getClaims } });
  vi.mocked(createClient).mockResolvedValue(supabase);
  vi.mocked(fetchEffectivePermissions).mockResolvedValue(options.permissions ?? Object.values(Permission));
  vi.mocked(fetchPlanPermissions).mockResolvedValue(options.planPermissions ?? Object.values(Permission));
  return { supabase, getClaims, claims };
}
