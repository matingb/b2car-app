import { createClient } from "@/supabase/server";
import { normalizeSubscriptionPlan, type SubscriptionPlanValue } from "@/lib/subscription";
import { normalizeUserRole, type PermissionValue } from "@/lib/permissions";
import { fetchEffectivePermissions } from "@/lib/permissions.server";
import { tagDatadogTenant } from "@/lib/datadogTrace";
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

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (!error && data?.claims) {
      const claims = data.claims as Record<string, unknown>;
      tenantId = typeof claims.tenant_id === "string" ? claims.tenant_id : undefined;
      tenantName = typeof claims.tenant_name === "string" ? claims.tenant_name : undefined;

      const userRole = normalizeUserRole(claims.user_role);
      planSub = normalizeSubscriptionPlan(claims.plan_sub);
      tagDatadogTenant(tenantId, tenantName, planSub);

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
    >
      {children}
    </AppClientLayout>
  );
}

