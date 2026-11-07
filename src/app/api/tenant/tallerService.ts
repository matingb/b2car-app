import { GetTalleresResponse, UpdateTallerPatch, UpdateTallerResponse } from "@/clients/tenantClient";
import { Taller } from "@/model/types";
import { SupabaseClient } from "@supabase/supabase-js";

const TALLER_COLUMNS = "id, nombre, ubicacion, valor_hora, whatsapp, instagram, facebook";

export const tallerService = {
  async getTalleres(supabase: SupabaseClient): Promise<GetTalleresResponse> {
    const { data, error } = await supabase
      .from("talleres")
      .select(TALLER_COLUMNS);
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
      .select(TALLER_COLUMNS)
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