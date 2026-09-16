import { createClient } from "@/supabase/server";
import { normalizeSubscriptionPlan } from "@/lib/subscription";
import { normalizeUserRole } from "@/lib/permissions";
import AppClientLayout from "./AppClientLayout";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialUserRole = null;
  let initialPlanSub = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims) {
      const claims = data.claims as Record<string, unknown>;
      initialUserRole = normalizeUserRole(claims?.user_role);
      initialPlanSub = normalizeSubscriptionPlan(claims?.plan_sub);
    }
  } catch {
    // If reading claims fails, pass null and let middleware handle redirection
  }

  return (
    <AppClientLayout
      initialUserRole={initialUserRole}
      initialPlanSub={initialPlanSub}
    >
      {children}
    </AppClientLayout>
  );
}
