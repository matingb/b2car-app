import type { SupabaseClient } from "@supabase/supabase-js";
import { arregloService } from "@/app/api/arreglos/arregloService";
import { clienteService } from "@/app/api/clientes/clienteService";
import { vehiculoService } from "@/app/api/vehiculos/vehiculoService";
import { decodeJwtPayload } from "@/lib/jwt";
import { computePeriodoTotals } from "@/lib/dashboard/totals";
import type { DashboardPeriodo, DashboardStats } from "@/lib/dashboard/types";
import { revalidateTag, unstable_cache } from "next/cache";

const DASHBOARD_STATS_TAG_PREFIX = "dashboard-stats";
// Cambiarla cuando cambia la forma de la respuesta: evita servir entradas cacheadas por la versión anterior.
const DASHBOARD_STATS_CACHE_VERSION = "v2";

function dashboardStatsTag(tenantId: string) {
  const normalized = String(tenantId).trim();
  return normalized
    ? `${DASHBOARD_STATS_TAG_PREFIX}:tenant:${normalized}`
    : `${DASHBOARD_STATS_TAG_PREFIX}:tenant:unknown`;
}

function invalidateDashboardStats(tenantIds?: string | string[] | null) {
  try {
    const ids = Array.isArray(tenantIds) ? tenantIds : [tenantIds];
    const uniqueTags = new Set(
      ids
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
        .map((id) => dashboardStatsTag(id))
    );
    uniqueTags.forEach((tag) => revalidateTag(tag));
  } catch {
    // ignore
  }
}

async function getSessionTenantId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  const jwt = decodeJwtPayload(token);
  const tenantId = jwt?.tenant_id;
  return typeof tenantId === "string" && tenantId.trim() ? tenantId : null;
}

export type { DashboardStats, DashboardPeriodo } from "@/lib/dashboard/types";

function startOfUtcMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

function startOfNextUtcMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0));
}

async function getStats(
  supabase: SupabaseClient,
  periodFrom?: string,
  periodTo?: string
): Promise<DashboardStats> {
  const now = new Date();
  const from = periodFrom ?? startOfUtcMonth(now).toISOString();
  const to = periodTo ?? startOfNextUtcMonth(now).toISOString();
  const recentLimit = 5;

  const [
    clientesTotal,
    vehiculosTotal,
    periodo,
    recentActivities,
    nuevosEsteMes,
    facturacionPorTipo,
    facturacionPorEmpleado,
    costoPorTipo,
    costoPorEmpleado,
  ] = await Promise.all([
    clienteService.countAll(supabase),
    vehiculoService.countAll(supabase),
    arregloService.dashboardPeriodo(supabase, from, to),
    arregloService.listRecentActivities(supabase, recentLimit, from, to),
    clienteService.nuevosPorDia(supabase, from, to),
    arregloService.facturacionPorTipo(supabase, from, to),
    arregloService.facturacionPorEmpleado(supabase, from, to),
    arregloService.costoPorTipo(supabase, from, to),
    arregloService.costoPorEmpleado(supabase, from, to),
  ]);

  const { resumen } = periodo;
  const totals = computePeriodoTotals(periodo);

  return {
    totals: {
      clientes: clientesTotal,
      vehiculos: vehiculosTotal,
      arreglos: resumen.total,
      montoIngresos: totals.facturacion,
      arreglosEsteMes: totals.arreglos,
      gastos: totals.gastos,
      balance: totals.balance,
    },
    recentActivities,
    arreglos: {
      total: resumen.total,
      cobrados: resumen.cobrados,
      parciales: resumen.parciales,
      pendientes: resumen.pendientes,
      montoCobradoTotal: resumen.montoCobradoTotal,
      montoCobradoParcial: resumen.montoCobradoParcial,
      montoPendienteParcial: resumen.montoPendienteParcial,
      montoPendiente: resumen.montoPendiente,
    },
    clientes: {
      nuevosEsteMes,
    },
    periodo,
    facturacionPorTipo,
    facturacionPorEmpleado,
    costoPorTipo,
    costoPorEmpleado,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export const statsService = {
  async getStats(
    supabase: SupabaseClient,
    periodFrom?: string,
    periodTo?: string,
    tenantId?: string
  ): Promise<DashboardStats> {
    const resolvedTenantId = tenantId ?? (await getSessionTenantId(supabase));
    if (!resolvedTenantId) throw new Error("JWT sin tenant_id");

    const getCached = unstable_cache(
      async () => getStats(supabase, periodFrom, periodTo),
      [
        DASHBOARD_STATS_TAG_PREFIX,
        DASHBOARD_STATS_CACHE_VERSION,
        periodFrom ?? "current",
        periodTo ?? "current",
        resolvedTenantId,
      ],
      { revalidate: 3600, tags: [dashboardStatsTag(resolvedTenantId)] }
    );

    return await getCached();
  },

  /** Resumen y series diarias de un período a comparar; comparte la invalidación por tenant. */
  async getPeriodo(
    supabase: SupabaseClient,
    periodFrom: string,
    periodTo: string,
    tenantId?: string
  ): Promise<DashboardPeriodo> {
    const resolvedTenantId = tenantId ?? (await getSessionTenantId(supabase));
    if (!resolvedTenantId) throw new Error("JWT sin tenant_id");

    const getCached = unstable_cache(
      async () => arregloService.dashboardPeriodo(supabase, periodFrom, periodTo),
      [DASHBOARD_STATS_TAG_PREFIX, DASHBOARD_STATS_CACHE_VERSION, "periodo", periodFrom, periodTo, resolvedTenantId],
      { revalidate: 3600, tags: [dashboardStatsTag(resolvedTenantId)] }
    );

    return await getCached();
  },

  async onDataChanged(supabase: SupabaseClient, tenantIds?: string | string[] | null) {
    const ids = Array.isArray(tenantIds) ? tenantIds : [tenantIds];
    const explicitIds = ids
      .map((id) => String(id ?? "").trim())
      .filter(Boolean);

    if (explicitIds.length > 0) {
      invalidateDashboardStats(explicitIds);
      return;
    }

    const tenantId = await getSessionTenantId(supabase);
    if (tenantId) invalidateDashboardStats(tenantId);
  },
} as const;
