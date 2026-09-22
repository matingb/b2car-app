import { GetTalleresResponse, UpdateTallerPatch, UpdateTallerResponse } from "@/clients/tenantClient";
import { Taller } from "@/model/types";
import { SupabaseClient } from "@supabase/supabase-js";

export const tallerService = {
  async getTalleres(supabase: SupabaseClient): Promise<GetTalleresResponse> {
    const { data, error } = await supabase
      .from("talleres")
      .select("id, nombre, ubicacion, valor_hora");
    if (error) {
      return { data: null, error: error.message };
    }
    return { data: data as Taller[], error: null };
  },

  async updateTaller(
    supabase: SupabaseClient,
    tallerId: string,
    patch: UpdateTallerPatch,
  ): Promise<UpdateTallerResponse> {
    const { data, error } = await supabase
      .from("talleres")
      .update(patch)
      .eq("id", tallerId)
      .select("id, nombre, ubicacion, valor_hora")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }
    return { data: data as Taller, error: null };
  },
};

/**
 * Alias de compatibilidad hacia tallerService.
 */
export const tenantService = tallerService;