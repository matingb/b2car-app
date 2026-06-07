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
  arreglosResumen(
    supabase: SupabaseClient,
    fromISO?: string,
    toISO?: string,
    tallerId?: string
  ): Promise<{ total: number; cobrados: number; pendientes: number; montoIngresos: number }>;
  tiposConIngresos(
    supabase: SupabaseClient,
    fromISO?: string,
    toISO?: string,
    tallerId?: string
  ): Promise<Array<{ tipo?: unknown; cantidad?: unknown; ingresos?: unknown }>>;
  listRecentActivities(
    supabase: SupabaseClient,
    limit: number,
    fromISO?: string,
    toISO?: string,
    tallerId?: string
  ): Promise<
    Array<{
      id?: unknown;
      descripcion?: unknown;
      updated_at?: unknown;
      precio_final?: unknown;
      vehiculo?: { patente?: unknown } | null;
    }>
  >;
  arreglosPorPeriodo(
    supabase: SupabaseClient,
    fromISO: string,
    toISO: string,
    tallerId?: string
  ): Promise<Array<{ label: string; cantidad: number }>>;
  ingresosPorPeriodo(
    supabase: SupabaseClient,
    fromISO: string,
    toISO: string,
    tallerId?: string
  ): Promise<Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>>;
  gastosPorPeriodo(
    supabase: SupabaseClient,
    fromISO: string,
    toISO: string,
    tallerId?: string
  ): Promise<Array<{ label: string; repuestos: number; sueldos: number }>>;
}

async function listVehiculoIdsByPatente(supabase: SupabaseClient, patenteRaw?: string) {
  const patente = String(patenteRaw ?? "").trim();
  if (!patente) return { ids: null as string[] | null, error: null as ReturnType<typeof toServiceError> | null };

  const { data, error } = await supabase.from("vehiculos").select("id").ilike("patente", `%${patente}%`);
  if (error) return { ids: null, error: toServiceError(error) };
  const ids = (data ?? []).map((row) => String((row as { id?: unknown }).id ?? "")).filter(Boolean);
  return { ids, error: null };
}

async function listVehiculoIdsBySearch(supabase: SupabaseClient, searchRaw?: string) {
  const search = String(searchRaw ?? "").trim();
  if (!search) return { ids: [] as string[], error: null as ReturnType<typeof toServiceError> | null };

  const { data, error } = await supabase
    .from("vista_vehiculos_con_clientes")
    .select("id")
    .or(`nombre_cliente.ilike.%${search}%,patente.ilike.%${search}%`);

  if (error) return { ids: [], error: toServiceError(error) };
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

    const { ids: vehiculoIdsBySearch, error: searchVehiculoError } = await listVehiculoIdsBySearch(
      supabase,
      safeSearch
    );
    if (searchVehiculoError) return { data: null, error: searchVehiculoError };

    if (safeSearch) {
      const searchConditions = [
        `descripcion.ilike.%${safeSearch}%`,
        `tipo.ilike.%${safeSearch}%`,
        `observaciones.ilike.%${safeSearch}%`,
      ];
      if (vehiculoIdsBySearch.length > 0) {
        searchConditions.push(`vehiculo_id.in.(${vehiculoIdsBySearch.join(",")})`);
      }
      query = query.or(searchConditions.join(","));
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

  async arreglosResumen(supabase, fromISO?, toISO?, tallerId?) {
    const { data, error } = await supabase.rpc("dashboard_arreglos_resumen", {
      p_from: fromISO ?? null,
      p_to: toISO ?? null,
      p_taller_id: tallerId ?? null,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { total?: unknown; cobrados?: unknown; pendientes?: unknown; monto_ingresos?: unknown }
      | null
      | undefined;
    return {
      total: Number(row?.total ?? 0),
      cobrados: Number(row?.cobrados ?? 0),
      pendientes: Number(row?.pendientes ?? 0),
      montoIngresos: Number(row?.monto_ingresos ?? 0),
    };
  },

  async tiposConIngresos(supabase, fromISO?, toISO?, tallerId?) {
    const { data, error } = await supabase.rpc("dashboard_tipos_con_ingresos", {
      p_from: fromISO ?? null,
      p_to: toISO ?? null,
      p_taller_id: tallerId ?? null,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ tipo?: unknown; cantidad?: unknown; ingresos?: unknown }>;
  },

  async listRecentActivities(supabase, limit, fromISO?, toISO?, tallerId?) {
    let query = supabase
      .from("arreglos")
      .select("id, descripcion, updated_at, precio_final, vehiculo:vehiculos(patente)")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (fromISO) query = query.gte("fecha", fromISO);
    if (toISO) query = query.lt("fecha", toISO);
    if (tallerId) query = query.eq("taller_id", tallerId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      descripcion?: unknown;
      updated_at?: unknown;
      precio_final?: unknown;
      vehiculo?: { patente?: unknown } | null;
    }>;
  },

  async arreglosPorPeriodo(supabase, fromISO, toISO, tallerId?) {
    const { data, error } = await supabase.rpc("dashboard_arreglos_por_periodo", {
      p_from: fromISO,
      p_to: toISO,
      p_taller_id: tallerId ?? null,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { label?: unknown; cantidad?: unknown }) => ({
      label: String(r.label ?? ""),
      cantidad: Number(r.cantidad ?? 0),
    }));
  },

  async ingresosPorPeriodo(supabase, fromISO, toISO, tallerId?) {
    const { data, error } = await supabase.rpc("dashboard_ingresos_por_periodo", {
      p_from: fromISO,
      p_to: toISO,
      p_taller_id: tallerId ?? null,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { label?: unknown; mano_de_obra?: unknown; repuestos?: unknown; ventas?: unknown }) => ({
      label: String(r.label ?? ""),
      mano_de_obra: Number(r.mano_de_obra ?? 0),
      repuestos: Number(r.repuestos ?? 0),
      ventas: Number(r.ventas ?? 0),
    }));
  },

  async gastosPorPeriodo(supabase, fromISO, toISO, tallerId?) {
    const { data, error } = await supabase.rpc("dashboard_gastos_por_periodo", {
      p_from: fromISO,
      p_to: toISO,
      p_taller_id: tallerId ?? null,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { label?: unknown; repuestos?: unknown; sueldos?: unknown }) => ({
      label: String(r.label ?? ""),
      repuestos: Number(r.repuestos ?? 0),
      sueldos: Number(r.sueldos ?? 0),
    }));
  },
};
