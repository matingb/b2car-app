import { GetTalleresResponse } from "@/clients/tenantClient";
import { Taller } from "@/model/types";
import { SupabaseClient } from "@supabase/supabase-js";

export const tenantService = {
    async getTalleres(supabase: SupabaseClient): Promise<GetTalleresResponse> {
        const { data, error } = await supabase.from("talleres").select("id, nombre, ubicacion");
        if (error) {
            throw new Error(error.message);
        }
        return { data: data as Taller[], error: null  };
    }

}