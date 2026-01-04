import type { SupabaseClient } from "@supabase/supabase-js";
import { arregloService } from "@/app/api/arreglos/arregloService";
import { clienteService } from "@/app/api/clientes/clienteService";
import { vehiculoService } from "@/app/api/vehiculos/vehiculoService";

export type DashboardStats = {
  totals?: {
    clientes?: number;
    vehiculos?: number;
    arreglos?: number;
    montoIngresos?: number;
  };
  recentActivities?: Array<{
    id: string;
    titulo: string;
    vehiculo: string;
    fechaActividad: string; // ISO
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
  lastUpdatedAt?: string;
  [key: string]: unknown;
};

function startOfUtcMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

function startOfNextUtcMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0));
}

export async function getStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const now = new Date();
  const fromMonth = startOfUtcMonth(now).toISOString();
  const toMonth = startOfNextUtcMonth(now).toISOString();
  const recentLimit = 5;

  const [
    clientesTotal,
    vehiculosTotal,
    arreglosTotal,
    cobrados,
    pendientes,
    montoIngresos,
    tipos,
    recentActivities,
    nuevosEsteMes,
  ] = await Promise.all([
    clienteService.countAll(supabase),
    vehiculoService.countAll(supabase),
    arregloService.countAll(supabase),
    arregloService.countByPago(supabase, true),
    arregloService.countByPago(supabase, false),
    arregloService.sumIngresos(supabase, fromMonth, toMonth),
    arregloService.tiposConIngresos(supabase),
    arregloService.listRecentActivities(supabase, recentLimit),
    clienteService.nuevosPorDia(supabase, fromMonth, toMonth),
  ]);

  return {
    totals: {
      clientes: clientesTotal,
      vehiculos: vehiculosTotal,
      arreglos: arreglosTotal,
      montoIngresos,
    },
    recentActivities,
    arreglos: {
      tipos,
      total: arreglosTotal,
      cobrados,
      pendientes,
    },
    clientes: {
      nuevosEsteMes,
    },
    lastUpdatedAt: new Date().toISOString(),
  };
}


