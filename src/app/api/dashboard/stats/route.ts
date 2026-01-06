import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { getStats, type DashboardStats } from "./dashboardStatsService"
/*
import { unstable_cache } from "next/cache";
import { decodeJwtPayload } from "@/lib/jwt";
*/

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
    /*
    Esto es un ejemplo de como usar caching con revalidacion y tags utilizando unstable_cache de Next.js
    const tenantId = decodeJwtPayload(auth.session.access_token)?.tenant_id as string;
    const monthKey = new Date().toISOString().slice(0, 7);

    const getCachedStats = unstable_cache(
      async () => getStats(supabase),
      ["dashboard-stats", tenantId, monthKey],
      { revalidate: 60, tags: ["dashboard-stats"] }
    );
    */

    const stats = await getStats(supabase);
    return Response.json(
      { data: stats, error: null } satisfies DashboardStatsResponse,
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=60",
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

