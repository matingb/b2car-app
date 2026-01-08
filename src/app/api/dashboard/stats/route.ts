import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { statsService, type DashboardStats } from "./dashboardStatsService"
import { getTenantIdFromAccessToken } from "@/supabase/tenant";

type DashboardStatsResponse = {
  data: DashboardStats | null;
  error?: string | null;
};

export async function GET() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json(
      { data: null, error: "Unauthorized" } satisfies DashboardStatsResponse,
      { status: 401 }
    );
  }

  try {
    const tenantId = getTenantIdFromAccessToken(auth.session.access_token);
    if (!tenantId) {
      return Response.json(
        { data: null, error: "Unauthorized" } satisfies DashboardStatsResponse,
        { status: 401 }
      );
    }

    const stats = await statsService.getStats(supabase, tenantId);
    return Response.json(
      { data: stats, error: null } satisfies DashboardStatsResponse,
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=30",
          Vary: "Cookie",
        },
      }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error cargando dashboard";
    logger.error("GET /api/dashboard/stats error:", message);
    return Response.json(
      { data: null, error: message } satisfies DashboardStatsResponse,
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

