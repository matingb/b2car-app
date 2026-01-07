import { decodeJwtPayload } from "@/lib/jwt";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getTenantIdFromAccessToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const jwt = decodeJwtPayload(token);
  const tenantId = jwt?.tenant_id;
  return typeof tenantId === "string" && tenantId.trim() ? tenantId : null;
}

export async function getTenantIdFromSupabase(supabase: SupabaseClient): Promise<string | null> {
  const auth = (
    supabase as unknown as {
      auth?: { getSession?: () => Promise<{ data?: { session?: { access_token?: string } } }> };
    }
  ).auth;
  if (!auth?.getSession) return null;

  const { data } = await auth.getSession();
  return getTenantIdFromAccessToken(data?.session?.access_token);
}


