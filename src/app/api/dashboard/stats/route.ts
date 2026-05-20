import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { statsService, type DashboardStats } from "./dashboardStatsService"

type DashboardStatsResponse = {
  data: DashboardStats | null;
  error?: string | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json(
      { data: null, error: "Unauthorized" } satisfies DashboardStatsResponse,
      { status: 401 }
    );
  }

  try {
    const url = new URL(request.url);
    const periodFrom = url.searchParams.get("from") ?? undefined;
    const periodTo = url.searchParams.get("to") ?? undefined;
    const tallerId = url.searchParams.get("tallerId") ?? undefined;
    const stats = await statsService.getStats(supabase, periodFrom, periodTo, tallerId);
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

