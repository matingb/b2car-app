import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vehiculo } from "@/model/types";
import { CreateVehiculoRequest } from "@/clients/vehiculoClient";
import type { Cliente } from "@/model/types";
import type { SupabaseError } from "@/model/types";
import { ServiceError, toServiceError } from "@/app/api/serviceError";
import type { ClienteListRow } from "@/app/api/clientes/clienteService";
import {
  normalizePaginationLimit,
  normalizePage,
  sliceWithHasMore,
} from "@/lib/pagination";

export type VehiculoServiceError = ServiceError;
export type VehiculoClienteServiceError = ServiceError;

export type VehiculoListFilters = {
  search?: string;
  cliente_id?: string;
  limit?: number;
  page?: number;
};

export const vehiculoService = {
  async list(
    supabase: SupabaseClient,
    filters?: VehiculoListFilters
  ): Promise<{ data: Vehiculo[]; hasMore?: boolean; error: Error | null }> {
    let query = supabase.from("vista_vehiculos_con_clientes").select("*");

    if (filters?.cliente_id) {
      query = query.eq("cliente_id", filters.cliente_id);
    }

    if (filters?.search) {
      const s = filters.search.trim();
      if (s) {
        query = query.or(
          `patente.ilike.%${s}%,marca.ilike.%${s}%,modelo.ilike.%${s}%,nombre_cliente.ilike.%${s}%,nro_interno.ilike.%${s}%,numero_chasis.ilike.%${s}%`
        );
      }
    }

    query = query.order("patente", { ascending: true });

    if (filters?.limit) {
      const page = normalizePage(filters.page);
      const limit = normalizePaginationLimit(filters.limit);
      const from = (page - 1) * limit;
      const { data, error } = await query.range(from, from + limit);
      if (error) return { data: [], hasMore: false, error: new Error(error.message) };
      const { items, hasMore } = sliceWithHasMore(data ?? [], limit);
      return { data: items as Vehiculo[], hasMore, error: null };
    }

    const { data, error } = await query;
    if (error) return { data: [], hasMore: false, error: new Error(error.message) };

    return { data: (data ?? []) as Vehiculo[], hasMore: false, error: null };
  },

  async create(
    supabase: SupabaseClient,
    input: CreateVehiculoRequest
  ): Promise<{ data: { id: string } | null; error: SupabaseError | null }> {
    const { data: inserted, error } = await supabase.from("vehiculos").insert([input]).select("id").single();
    
    if (error) {
      return { data: null, error: { message: error.message, code: (error as { code?: string }).code } };
    }

    return { data: inserted ?? null, error: null };
  },

  async countAll(supabase: SupabaseClient): Promise<number> {
    const { data, error } = await supabase.rpc("dashboard_count_vehiculos");
    if (error) throw new Error(error.message);
    return (data ?? 0) as number;
  },

  async getById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{
    data: Vehiculo | null;
    arreglos: unknown[];
    error: ServiceError | null;
  }> {
    const { data: vehiculo, error: vError } = await supabase
      .from("vista_vehiculos_con_clientes")
      .select("*")
      .eq("id", id)
      .single();

    if (vError) return { data: null, arreglos: [], error: toServiceError(vError) };

    const { data: arreglosRaw, error: aError } = await supabase
      .from("arreglos")
      .select("*, vehiculo:vehiculos(*), taller:talleres(*), empleados_detallados:arreglos_empleados_detallados")
      .eq("vehiculo_id", id)
      .order("fecha", { ascending: false });

    if (aError) return { data: (vehiculo ?? null) as Vehiculo | null, arreglos: [], error: toServiceError(aError) };

    const mappedArreglos = (arreglosRaw ?? []).map((arr: Record<string, unknown>) => {
      const { empleados_detallados, ...rest } = arr;
      return { ...rest, empleados: empleados_detallados || [] };
    });

    return { data: (vehiculo ?? null) as Vehiculo | null, arreglos: mappedArreglos as unknown[], error: null };
  },

  async updateById(
    supabase: SupabaseClient,
    id: string,
    updateData: Record<string, string | number | null | undefined>
  ): Promise<{ data: unknown | null; error: { message: string } | null; notFound?: boolean }> {
    const { data: checkData, error: checkError } = await supabase
      .from("vehiculos")
      .select("*")
      .eq("id", id)
      .single();

    if (checkError || !checkData) return { data: null, error: { message: "Vehículo no encontrado" }, notFound: true };

    const { data, error } = await supabase
      .from("vehiculos")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) return { data: null, error: { message: error.message } };
    if (!data || data.length === 0) return { data: null, error: { message: "Vehículo no actualizado" }, notFound: true };

    return { data: data[0] ?? null, error: null };
  },

  async deleteById(supabase: SupabaseClient, id: string): Promise<{ error: { message: string } | null }> {
    const { error } = await supabase.from("vehiculos").delete().eq("id", id);
    if (error) return { error: { message: error.message } };
    return { error: null };
  },

  async getClienteByVehiculoId(
    supabase: SupabaseClient,
    vehiculoId: string
  ): Promise<{ data: Cliente | null; error: ServiceError | null }> {
    const { data: vData, error: vError } = await supabase
      .from("vehiculos")
      .select("cliente_id")
      .eq("id", vehiculoId)
      .single();

    if (vError) return { data: null, error: toServiceError(vError) };
    if (!vData?.cliente_id) return { data: null, error: ServiceError.NoClienteAsignado };

    const { data: cData, error: cError } = await supabase
      .from("clientes")
      .select("*, particular:particulares(*), empresa:empresas(*)")
      .eq("id", vData.cliente_id)
      .single();

    if (cError) return { data: null, error: toServiceError(cError) };

    const row = cData as unknown as ClienteListRow;
    const particular = row.particular;
    const empresa = row.empresa;

    const cliente: Cliente = {
      id: row.id,
      nombre: particular ? `${particular.nombre} ${particular.apellido}`.trim() : empresa?.nombre || "",
      tipo_cliente: row.tipo_cliente,
      codigo_pais: particular?.codigo_pais || empresa?.codigo_pais || "",
      telefono: particular?.telefono || empresa?.telefono || "",
      email: particular?.email || empresa?.email || "",
      direccion: particular?.direccion || empresa?.direccion || "",
    };

    return { data: cliente, error: null };
  },

  async updateCliente(
    supabase: SupabaseClient,
    vehiculoId: string,
    nuevoClienteId: string | number
  ): Promise<{ error: { message: string } | null }> {
    const { error } = await supabase
      .from("vehiculos")
      .update({ cliente_id: nuevoClienteId })
      .eq("id", vehiculoId);

    if (error) return { error: { message: error.message } };
    return { error: null };
  },
};


