import type { SupabaseClient } from "@supabase/supabase-js";
import { arregloService } from "@/app/api/arreglos/arregloService";
import { clienteService } from "@/app/api/clientes/clienteService";
import { vehiculoService } from "@/app/api/vehiculos/vehiculoService";
import { decodeJwtPayload } from "@/lib/jwt";
import { revalidateTag, unstable_cache } from "next/cache";

const DASHBOARD_STATS_TAG_PREFIX = "dashboard-stats";

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

export type DashboardStats = {
  totals?: {
    clientes?: number;
    vehiculos?: number;
    arreglos?: number;
    montoIngresos?: number;
    arreglosEsteMes?: number;
    gastos?: number;
    balance?: number;
  };
  recentActivities?: Array<{
    id: string;
    titulo: string;
    vehiculo: string;
    fechaUltimaActualizacion: string;
    monto: number;
  }>;
  arreglos?: {
    tipos?: {
      tipos: string[];
      cantidad: number[];
      ingresos: number[];
    };
    total?: number;
    cobrados?: number;
    pendientes?: number;
  };
  clientes?: {
    nuevosEsteMes?: {
      dias: string[];
      valor: number[];
    };
  };
  arreglosPorPeriodo?: Array<{ label: string; cantidad: number }>;
  ingresosPorPeriodo?: Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>;
  gastosPorPeriodo?: Array<{ label: string; repuestos: number; sueldos: number }>;
  lastUpdatedAt?: string;
  [key: string]: unknown;
};

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
    resumen,
    tipos,
    recentActivities,
    nuevosEsteMes,
    arreglosPorPeriodo,
    ingresosPorPeriodo,
    gastosPorPeriodo,
  ] = await Promise.all([
    clienteService.countAll(supabase),
    vehiculoService.countAll(supabase),
    arregloService.arreglosResumen(supabase, from, to),
    arregloService.tiposConIngresos(supabase, from, to),
    arregloService.listRecentActivities(supabase, recentLimit, from, to),
    clienteService.nuevosPorDia(supabase, from, to),
    arregloService.arreglosPorPeriodo(supabase, from, to),
    arregloService.ingresosPorPeriodo(supabase, from, to),
    arregloService.gastosPorPeriodo(supabase, from, to),
  ]);

  const arreglosEsteMes = arreglosPorPeriodo.reduce((sum, d) => sum + d.cantidad, 0);
  const gastos = gastosPorPeriodo.reduce((sum, d) => sum + d.repuestos + d.sueldos, 0);
  const balance = resumen.montoIngresos - gastos;

  return {
    totals: {
      clientes: clientesTotal,
      vehiculos: vehiculosTotal,
      arreglos: resumen.total,
      montoIngresos: resumen.montoIngresos,
      arreglosEsteMes,
      gastos,
      balance,
    },
    recentActivities,
    arreglos: {
      tipos,
      total: resumen.total,
      cobrados: resumen.cobrados,
      pendientes: resumen.pendientes,
    },
    clientes: {
      nuevosEsteMes,
    },
    arreglosPorPeriodo,
    ingresosPorPeriodo,
    gastosPorPeriodo,
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
        periodFrom ?? "current",
        periodTo ?? "current",
        resolvedTenantId,
      ],
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
