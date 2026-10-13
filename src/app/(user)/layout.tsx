import { createClient } from "@/supabase/server";
import { normalizeSubscriptionPlan, type SubscriptionPlanValue } from "@/lib/subscription";
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
  let tenantId: string | undefined;
  let tenantName: string | undefined;
  let planSub: SubscriptionPlanValue | null = null;
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

      tenantId = typeof claims.tenant_id === "string" ? claims.tenant_id : undefined;
      tenantName = typeof claims.tenant_name === "string" ? claims.tenant_name : undefined;

      const userRole = normalizeUserRole(claims.user_role);
      planSub = normalizeSubscriptionPlan(claims.plan_sub);

      if (userRole && planSub) {
        initialPermissions = await fetchEffectivePermissions(supabase, userRole, planSub);
      }
    }
  } catch {
  }

  return (
    <AppClientLayout
      initialPermissions={initialPermissions}
      tenantId={tenantId}
      tenantName={tenantName}
      plan={planSub ?? undefined}
      identity={identity}
    >
      {children}
    </AppClientLayout>
  );
}

