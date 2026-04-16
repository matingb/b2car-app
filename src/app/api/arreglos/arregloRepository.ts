import type { SupabaseClient } from "@supabase/supabase-js";
import type { Arreglo } from "@/model/types";
import type { CreateArregloInsertPayload, UpdateArregloRequest } from "./arregloRequests";
import { type ServiceResult, toServiceError } from "@/app/api/serviceError";
import {
  getLimitSentinel,
  normalizePaginationLimit,
  sliceWithHasMore,
} from "@/lib/pagination";

export type ArregloListFilters = {
  tallerId?: string;
  search?: string;
  patente?: string;
  tipo?: string;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  limit: number;
};

export type ArregloListPageRow = {
  [key: string]: unknown;
};

export type ArregloListPageResult = {
  rows: ArregloListPageRow[];
  hasMore: boolean;
};

export interface ArregloRepository {
  getArreglo(supabase: SupabaseClient, filters: ArregloListFilters): Promise<ServiceResult<ArregloListPageResult>>;
  getByIdWithVehiculo(supabase: SupabaseClient, id: string): Promise<ServiceResult<Arreglo>>;
  create(supabase: SupabaseClient, payload: CreateArregloInsertPayload): Promise<ServiceResult<Arreglo>>;
  updateById(
    supabase: SupabaseClient,
    id: string,
    payload: UpdateArregloRequest
  ): Promise<ServiceResult<Arreglo>>;
  listOperacionIdsByArregloId(supabase: SupabaseClient, id: string): Promise<ServiceResult<string[]>>;
  deleteOperacionesConStockLista(
    supabase: SupabaseClient,
    operacionIds: string[]
  ): Promise<{ error: ReturnType<typeof toServiceError> | null }>;
  deleteById(supabase: SupabaseClient, id: string): Promise<{ error: ReturnType<typeof toServiceError> | null }>;
  countAll(supabase: SupabaseClient): Promise<number>;
  countByPago(supabase: SupabaseClient, estaPago: boolean): Promise<number>;
  sumIngresos(supabase: SupabaseClient, fromISO: string, toISO: string): Promise<number>;
  tiposConIngresos(
    supabase: SupabaseClient
  ): Promise<Array<{ tipo?: unknown; cantidad?: unknown; ingresos?: unknown }>>;
  listRecentActivities(
    supabase: SupabaseClient,
    limit: number
  ): Promise<
    Array<{
      id?: unknown;
      descripcion?: unknown;
      updated_at?: unknown;
      precio_final?: unknown;
      vehiculo?: { patente?: unknown } | null;
    }>
  >;
}

async function listVehiculoIdsByPatente(supabase: SupabaseClient, patenteRaw?: string) {
  const patente = String(patenteRaw ?? "").trim();
  if (!patente) return { ids: null as string[] | null, error: null as ReturnType<typeof toServiceError> | null };

  const { data, error } = await supabase.from("vehiculos").select("id").ilike("patente", `%${patente}%`);
  if (error) return { ids: null, error: toServiceError(error) };
  const ids = (data ?? []).map((row) => String((row as { id?: unknown }).id ?? "")).filter(Boolean);
  return { ids, error: null };
}

export const supabaseArregloRepository: ArregloRepository = {
  async getArreglo(supabase, filters) {
    const limit = normalizePaginationLimit(filters.limit);
    const safeSearch = String(filters.search ?? "").trim();
    const safeTipo = String(filters.tipo ?? "").trim();
    const safeEstado = String(filters.estado ?? "").trim().toUpperCase();

    let query = supabase
      .from("arreglos")
      .select("*, vehiculo:vista_vehiculos_con_clientes(*), taller:talleres(*)")
      .order("fecha", { ascending: false })
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(getLimitSentinel(limit));

    if (filters.tallerId) query = query.eq("taller_id", filters.tallerId);
    if (filters.fechaDesde) query = query.gte("fecha", filters.fechaDesde);
    if (filters.fechaHasta) query = query.lte("fecha", filters.fechaHasta);
    if (safeTipo) query = query.ilike("tipo", `%${safeTipo}%`);
    if (safeEstado) query = query.eq("estado", safeEstado);

    if (safeSearch) {
      query = query.or(
        `descripcion.ilike.%${safeSearch}%,tipo.ilike.%${safeSearch}%,observaciones.ilike.%${safeSearch}%`
      );
    }

    const { ids: vehiculoIdsByPatente, error: patenteError } = await listVehiculoIdsByPatente(
      supabase,
      filters.patente
    );
    if (patenteError) return { data: null, error: patenteError };
    if (vehiculoIdsByPatente) {
      if (vehiculoIdsByPatente.length === 0) return { data: { rows: [], hasMore: false }, error: null };
      query = query.in("vehiculo_id", vehiculoIdsByPatente);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: toServiceError(error) };

    const rows = (data ?? []) as ArregloListPageRow[];
    const { items, hasMore } = sliceWithHasMore(rows, limit);
    return { data: { rows: items, hasMore }, error: null };
  },

  async getByIdWithVehiculo(supabase, id) {
    const { data, error } = await supabase
      .from("arreglos")
      .select("*, vehiculo:vehiculos(*)")
      .eq("id", id)
      .single();
    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? null) as Arreglo | null, error: null };
  },

  async create(supabase, payload) {
    const { data, error } = await supabase
      .from("arreglos")
      .insert([payload])
      .select("*, vehiculo:vehiculos(*)")
      .single();
    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? null) as Arreglo | null, error: null };
  },

  async updateById(supabase, id, payload) {
    const { data, error } = await supabase
      .from("arreglos")
      .update(payload)
      .eq("id", id)
      .select("*, vehiculo:vehiculos(*)")
      .single();
    if (error) return { data: null, error: toServiceError(error) };
    return { data: (data ?? null) as Arreglo | null, error: null };
  },

  async listOperacionIdsByArregloId(supabase, id) {
    const { data, error } = await supabase
      .from("operaciones_asignacion_arreglo")
      .select("operacion_id")
      .eq("arreglo_id", id);
    if (error) return { data: null, error: toServiceError(error) };

    const ids = (data ?? [])
      .map((row) => String((row as { operacion_id?: unknown }).operacion_id ?? ""))
      .filter(Boolean);
    return { data: ids, error: null };
  },

  async deleteOperacionesConStockLista(supabase, operacionIds) {
    const { error } = await supabase.rpc("rpc_borrar_operaciones_con_stock_lista", {
      p_operacion_ids: operacionIds,
    });
    return { error: error ? toServiceError(error) : null };
  },

  async deleteById(supabase, id) {
    //const { error } = await supabase.from("arreglos").delete().eq("id", id);
    const { error } = await supabase.rpc("rpc_borrar_arreglo", {
      p_arreglo_id: id,
    });
    return { error: error ? toServiceError(error) : null };
  },

  async countAll(supabase) {
    const { data, error } = await supabase.rpc("dashboard_count_arreglos");
    if (error) throw new Error(error.message);
    return (data ?? 0) as number;
  },

  async countByPago(supabase, estaPago) {
    const { data, error } = await supabase.rpc("dashboard_count_arreglos_by_pago", {
      p_esta_pago: estaPago,
    });
    if (error) throw new Error(error.message);
    return (data ?? 0) as number;
  },

  async sumIngresos(supabase, fromISO, toISO) {
    const { data, error } = await supabase.rpc("dashboard_sum_ingresos", {
      p_from: fromISO,
      p_to: toISO,
    });
    if (error) throw new Error(error.message);
    return (data ?? 0) as number;
  },

  async tiposConIngresos(supabase) {
    const { data, error } = await supabase.rpc("dashboard_tipos_con_ingresos");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ tipo?: unknown; cantidad?: unknown; ingresos?: unknown }>;
  },

  async listRecentActivities(supabase, limit) {
    const { data, error } = await supabase
      .from("arreglos")
      .select("id, descripcion, updated_at, precio_final, vehiculo:vehiculos(patente)")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      descripcion?: unknown;
      updated_at?: unknown;
      precio_final?: unknown;
      vehiculo?: { patente?: unknown } | null;
    }>;
  },
};
