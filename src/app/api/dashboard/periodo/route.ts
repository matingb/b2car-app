import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { statsService, type DashboardPeriodo } from "@/app/api/dashboard/stats/dashboardStatsService";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { parseDashboardRange } from "@/lib/dashboard/range";

type DashboardPeriodoResponse = {
  data: DashboardPeriodo | null;
  error?: string | null;
};

/** Resumen y series diarias de un período a comparar en el dashboard. */
export async function GET(request: Request) {
  const authError = await requirePermission(Permission.DashboardView);
  if (authError) return authError;

  const parsed = parseDashboardRange(new URL(request.url).searchParams, { required: true });
  if (!parsed.ok) {
    return Response.json(
      { data: null, error: parsed.error } satisfies DashboardPeriodoResponse,
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = await createClient();

  try {
    const periodo = await statsService.getPeriodo(supabase, parsed.range.from!, parsed.range.to!);
    return Response.json(
      { data: periodo, error: null } satisfies DashboardPeriodoResponse,
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=30",
          Vary: "Cookie",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error cargando el período";
    logger.error("GET /api/dashboard/periodo error:", message);
    return Response.json(
      { data: null, error: message } satisfies DashboardPeriodoResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
