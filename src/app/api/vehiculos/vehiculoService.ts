import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vehiculo } from "@/model/types";
import { CreateVehiculoRequest } from "@/clients/vehiculoClient";

type SupabaseError = { message: string; code?: string };

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
  ): Promise<{ data: { id: number } | null; error: SupabaseError | null }> {
    const { data: inserted, error } = await supabase.from("vehiculos").insert([input]).select("id").single();
    
    if (error) {
      return { data: null, error: { message: error.message, code: (error as { code?: string }).code } };
    }

    return { data: inserted ?? null, error: null };
  },
};


