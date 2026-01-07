import { SupabaseClient } from '@supabase/supabase-js'
import { TipoCliente, Cliente } from "@/model/types";
import type { Particular } from "@/model/types";

type ParticularInsertRow = {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
};

type ParticularByIdRow = {
  id: string;
  particular?: ParticularInsertRow | null;
  vehiculos?: unknown[] | null;
};

export const particularService = {
  async delete(supabase: SupabaseClient, id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .rpc('delete_particular', { particular_id: id })

    if (error) {
      console.error('Error eliminando particular', error)
      return { error: new Error(error.message) }
    }

    return { error: null }
  },

  async createClienteParticular(
    supabase: SupabaseClient,
    payload: { nombre: string; apellido?: string; telefono?: string; email?: string; direccion?: string }
  ): Promise<{ data: Cliente | null; error: Error | null }> {
    const { data: clienteInsert, error: errorCliente } = await supabase
      .from("clientes")
      .insert([{ tipo_cliente: TipoCliente.PARTICULAR }])
      .select("id, tipo_cliente")
      .single();

    if (errorCliente || !clienteInsert) {
      return { data: null, error: new Error(errorCliente?.message || "No se pudo crear el particular") };
    }

    const clienteId = clienteInsert.id;

    const { data, error: detalleError } = await supabase
      .from("particulares")
      .insert([{ ...payload, id: clienteId }])
      .select()
      .single();

    if (detalleError || !data) {
      return { data: null, error: new Error(detalleError?.message || "No se pudo crear el particular") };
    }

    const c: Cliente & { apellido?: string } = {
      id: clienteId,
      nombre: data.nombre,
      tipo_cliente: TipoCliente.PARTICULAR,
      apellido: data.apellido,
      telefono: data.telefono,
      email: data.email,
      direccion: data.direccion,
    };

    return { data: c, error: null };
  },

  async getByIdWithVehiculos(supabase: SupabaseClient, id: string): Promise<{ data: Particular | null; error: Error | null; code?: string }> {
    const { data, error } = await supabase
      .from("clientes")
      .select("*, particular:particulares(*), vehiculos(*)")
      .eq("id", id)
      .single();

    if (error) return { data: null, error: new Error(error.message), code: (error as { code?: string }).code };

    const row = data as unknown as ParticularByIdRow;
    const particular = {
      id: row.id,
      nombre: row.particular?.nombre ?? "",
      apellido: row.particular?.apellido ?? "",
      telefono: row.particular?.telefono ?? "",
      email: row.particular?.email ?? "",
      direccion: row.particular?.direccion ?? "",
      vehiculos: row.vehiculos ?? [],
    } as unknown as Particular;

    return { data: particular, error: null };
  },

  async updateById(supabase: SupabaseClient, id: string, payload: Record<string, unknown>): Promise<{ data: unknown | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("particulares")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };
    return { data: data ?? null, error: null };
  },
}

