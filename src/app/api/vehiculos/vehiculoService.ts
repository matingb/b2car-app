import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Vehiculo } from "@/model/types";
import { CreateVehiculoRequest } from "@/clients/vehiculoClient";
import type { Cliente } from "@/model/types";
import type { TipoCliente } from "@/model/types";
import type { SupabaseError } from "@/model/types";

type ClienteJoinRow = {
  id: string;
  tipo_cliente: TipoCliente;
  particular?: {
    nombre?: string;
    apellido?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
  } | null;
  empresa?: {
    nombre?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
  } | null;
};

export enum VehiculoServiceError {
  NotFound = "NotFound",
  Unknown = "Unknown",
}

export enum VehiculoClienteServiceError {
  NotFound = "NotFound",
  NoClienteAsignado = "NoClienteAsignado",
  Unknown = "Unknown",
}

function toServiceError(err: PostgrestError): VehiculoServiceError {
  const code = (err as { code?: string }).code;
  if (code === "PGRST116") return VehiculoServiceError.NotFound;
  return VehiculoServiceError.Unknown;
}

function toClienteServiceError(err: PostgrestError): VehiculoClienteServiceError {
  const code = (err as { code?: string }).code;
  if (code === "PGRST116") return VehiculoClienteServiceError.NotFound;
  return VehiculoClienteServiceError.Unknown;
}

export const vehiculoService = {
  async list(supabase: SupabaseClient): Promise<{ data: Vehiculo[]; error: Error | null }> {
    const { data, error } = await supabase.from("vista_vehiculos_con_clientes").select("*");
    if (error) return { data: [], error: new Error(error.message) };

    const vehiculos: Vehiculo[] = (data ?? []) as Vehiculo[];

    return { data: vehiculos, error: null };
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
    error: VehiculoServiceError | null;
  }> {
    const { data: vehiculo, error: vError } = await supabase
      .from("vista_vehiculos_con_clientes")
      .select("*")
      .eq("id", id)
      .single();

    if (vError) return { data: null, arreglos: [], error: toServiceError(vError) };

    const { data: arreglos, error: aError } = await supabase
      .from("arreglos")
      .select("*, vehiculo:vehiculos(*)")
      .eq("vehiculo_id", id)
      .order("fecha", { ascending: false });

    if (aError) return { data: (vehiculo ?? null) as Vehiculo | null, arreglos: [], error: toServiceError(aError) };

    return { data: (vehiculo ?? null) as Vehiculo | null, arreglos: (arreglos ?? []) as unknown[], error: null };
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
  ): Promise<{ data: Cliente | null; error: VehiculoClienteServiceError | null }> {
    const { data: vData, error: vError } = await supabase
      .from("vehiculos")
      .select("cliente_id")
      .eq("id", vehiculoId)
      .single();

    if (vError) return { data: null, error: toClienteServiceError(vError) };
    if (!vData?.cliente_id) return { data: null, error: VehiculoClienteServiceError.NoClienteAsignado };

    const { data: cData, error: cError } = await supabase
      .from("clientes")
      .select("*, particular:particulares(*), empresa:empresas(*)")
      .eq("id", vData.cliente_id)
      .single();

    if (cError) return { data: null, error: toClienteServiceError(cError) };

    const row = cData as unknown as ClienteJoinRow;
    const particular = row.particular;
    const empresa = row.empresa;

    const cliente: Cliente = {
      id: row.id,
      nombre: particular ? `${particular.nombre} ${particular.apellido}`.trim() : empresa?.nombre || "",
      tipo_cliente: row.tipo_cliente,
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


