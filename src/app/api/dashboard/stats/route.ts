import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { statsService, type DashboardStats } from "./dashboardStatsService";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { parseDashboardRange } from "@/lib/dashboard/range";

type DashboardStatsResponse = {
  data: DashboardStats | null;
  error?: string | null;
};

export async function GET(request: Request) {
  const authError = await requirePermission(Permission.DashboardView);
  if (authError) return authError;

  const parsed = parseDashboardRange(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return Response.json(
      { data: null, error: parsed.error } satisfies DashboardStatsResponse,
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = await createClient();

  try {
    const stats = await statsService.getStats(supabase, parsed.range.from, parsed.range.to);
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

