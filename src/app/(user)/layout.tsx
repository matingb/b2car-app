import { createClient } from "@/supabase/server";
import { normalizeSubscriptionPlan } from "@/lib/subscription";
import { normalizeUserRole, type PermissionValue } from "@/lib/permissions";
import { fetchEffectivePermissions } from "@/lib/permissions.server";
import { telemetry, identityFromClaims, type TelemetryIdentity } from "@/lib/telemetry";
import AppClientLayout from "./AppClientLayout";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialPermissions: PermissionValue[] = [];
  let tenantName: string | undefined;
  let identity: TelemetryIdentity | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (!error && data?.claims) {
      const claims = data.claims as Record<string, unknown>;
      identity = identityFromClaims(claims);
      if (identity) {
        telemetry.identify(identity);
      }

      tenantName = typeof claims.tenant_name === "string" ? claims.tenant_name : undefined;

      const userRole = normalizeUserRole(claims.user_role);
      const planSub = normalizeSubscriptionPlan(claims.plan_sub);

      if (userRole && planSub) {
        initialPermissions = await fetchEffectivePermissions(supabase, userRole, planSub);
      }
    }
  } catch {
  }

  return (
    <AppClientLayout
      initialPermissions={initialPermissions}
      tenantName={tenantName}
      identity={identity}
    >
      {children}
    </AppClientLayout>
  );
}

