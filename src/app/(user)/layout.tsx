import { createClient } from "@/supabase/server";
import { normalizeSubscriptionPlan } from "@/lib/subscription";
import { normalizeUserRole, type PermissionValue } from "@/lib/permissions";
import { fetchEffectivePermissions } from "@/lib/permissions.server";
import AppClientLayout from "./AppClientLayout";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialPermissions: PermissionValue[] = [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (!error && data?.claims) {
      const claims = data.claims as Record<string, unknown>;
      const userRole = normalizeUserRole(claims?.user_role);
      const planSub = normalizeSubscriptionPlan(claims?.plan_sub);

      if (userRole && planSub) {
        initialPermissions = await fetchEffectivePermissions(supabase, userRole, planSub);
      }
    }
  } catch {
  }

  return (
    <AppClientLayout initialPermissions={initialPermissions}>
      {children}
    </AppClientLayout>
  );
}

