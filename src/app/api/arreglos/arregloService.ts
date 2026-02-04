import type { SupabaseClient } from "@supabase/supabase-js";
import type { Arreglo } from "@/model/types";
import type { CreateArregloInsertPayload, UpdateArregloRequest } from "./arregloRequests";
import { ServiceError, ServiceResult, toServiceError } from "@/app/api/serviceError";
import { buildDescripcionFromDetalles } from "@/lib/arreglos";

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
  async listAll(
    supabase: SupabaseClient,
    filters?: { tallerId?: string }
  ): Promise<ServiceResult<Arreglo[]>> {
    let query = supabase
      .from("arreglos")
      .select("*, vehiculo:vehiculos(*), taller:talleres(*), detalles:detalle_arreglo(descripcion)")
      

    if (filters?.tallerId) {
      query = query.eq("taller_id", filters.tallerId);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: toServiceError(error) };

    const arreglos = (data ?? []).map((row) => {
      const { detalles, ...rest } = row as {
        detalles?: Array<{ descripcion?: unknown }> | null;
        descripcion?: unknown;
        [key: string]: unknown;
      };
      const fallback = String((row as { descripcion?: unknown })?.descripcion ?? "");
      return {
        ...rest,
        descripcion: buildDescripcionFromDetalles(detalles, fallback),
      };
    });

    return { data: arreglos as unknown as Arreglo[], error: null };
  },

  async getByIdWithVehiculo(supabase: SupabaseClient, id: string): Promise<ServiceResult<Arreglo>> {
    const { data, error } = await supabase
      .from("arreglos")
      .select("*, vehiculo:vehiculos(*)")
      .eq("id", id)
      .single();
    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? null) as unknown as Arreglo | null, error: null };
  },

  async create(
    supabase: SupabaseClient,
    payload: CreateArregloInsertPayload
  ): Promise<ServiceResult<Arreglo>> {
    const { data, error } = await supabase
      .from("arreglos")
      .insert([payload])
      .select("*, vehiculo:vehiculos(*)")
      .single();
    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? null) as unknown as Arreglo | null, error: null };
  },

  async updateById(
    supabase: SupabaseClient,
    id: string,
    payload: UpdateArregloRequest
  ): Promise<ServiceResult<Arreglo>> {

    const { data, error } = await supabase
      .from("arreglos")
      .update(payload)
      .eq("id", id)
      .select("*, vehiculo:vehiculos(*)")
      .single();

    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? null) as unknown as Arreglo | null, error: null };
  },

  async deleteById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: ServiceError | null }> {

    const { error } = await supabase.from("arreglos").delete().eq("id", id);

    if (error) return { error: toServiceError(error) };
    return { error: null };
  },

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


