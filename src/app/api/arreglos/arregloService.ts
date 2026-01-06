import type { SupabaseClient } from "@supabase/supabase-js";

export type TiposConIngresos = {
  tipos: string[];
  cantidad: number[];
  ingresos: number[];
};

export type RecentActivity = {
  id: string;
  titulo: string;
  vehiculo: string;
  fechaUltimaActualizacion: string;
  monto: number;
};

export const arregloService = {
  async countAll(supabase: SupabaseClient): Promise<number> {
    const { data, error } = await supabase.rpc("dashboard_count_arreglos");
    if (error) throw new Error(error.message);
    return (data ?? 0) as number;
  },

  async countByPago(supabase: SupabaseClient, estaPago: boolean): Promise<number> {
    const { data, error } = await supabase.rpc("dashboard_count_arreglos_by_pago", {
      p_esta_pago: estaPago,
    });
    if (error) throw new Error(error.message);
    return (data ?? 0) as number;
  },

  async sumIngresos(supabase: SupabaseClient, fromISO: string, toISO: string): Promise<number> {
    const { data, error } = await supabase.rpc("dashboard_sum_ingresos", {
      p_from: fromISO,
      p_to: toISO,
    });
    if (error) throw new Error(error.message);
    return (data ?? 0) as number;
  },

  async tiposConIngresos(supabase: SupabaseClient): Promise<TiposConIngresos> {
    const { data, error } = await supabase.rpc("dashboard_tipos_con_ingresos");
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{
      tipo?: unknown;
      cantidad?: unknown;
      ingresos?: unknown;
    }>;

    const tipos: string[] = [];
    const cantidad: number[] = [];
    const ingresos: number[] = [];

    for (const r of rows) {
      tipos.push(String(r.tipo ?? "").trim() || "Sin tipo");
      cantidad.push(Number(r.cantidad ?? 0) || 0);
      ingresos.push(Number(Number(r.ingresos ?? 0).toFixed(2)) || 0);
    }

    return { tipos, cantidad, ingresos };
  },

  async listRecentActivities(supabase: SupabaseClient, limit: number): Promise<RecentActivity[]> {
    const { data, error } = await supabase
      .from("arreglos")
      .select("id, descripcion, updated_at, precio_final, vehiculo:vehiculos(patente)")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{
      id?: unknown;
      descripcion?: unknown;
      updated_at?: unknown;
      precio_final?: unknown;
      vehiculo?: { patente?: unknown } | null;
    }>;

    return rows
      .map((r) => ({
        id: String(r.id ?? ""),
        titulo: String(r.descripcion ?? "").trim() || "Actividad",
        vehiculo: String(r.vehiculo?.patente ?? "").trim() || "-",
        fechaUltimaActualizacion: String(r.updated_at ?? ""),
        monto: Number(r.precio_final ?? 0) || 0,
      }))
      .filter((a) => a.id);
  },
};


