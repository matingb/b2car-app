import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { getLandingPathForPermissions, normalizeUserRole } from "@/lib/permissions";
import { fetchEffectivePermissions } from "@/lib/permissions.server";
import { normalizeSubscriptionPlan } from "@/lib/subscription";

export default async function HomePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const role = normalizeUserRole(data?.claims?.user_role);
  const plan = normalizeSubscriptionPlan(data?.claims?.plan_sub);
  if (error || !role || !plan) redirect("/login");

  const permissions = await fetchEffectivePermissions(supabase, role, plan);
  redirect(getLandingPathForPermissions(permissions));
}


