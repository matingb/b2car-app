import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { FormularioConfigDTO } from "@/model/dtos";



export interface FormularioRepository {
    listAll(supabase: SupabaseClient): Promise<{ data: FormularioConfigDTO[]; error: PostgrestError | null }>;
}

export const formularioRepository = {
	async listAll(
		supabase: SupabaseClient
	): Promise<{ data: FormularioConfigDTO[]; error: PostgrestError | null }> {
		const { data, error } = await supabase
			.from("formulario_arreglo_config")
			.select("id, tenant_id, descripcion, costodefault, metadata, created_at, updated_at")
			.order("created_at", { ascending: true });

		return {
			data: (data ?? []) as FormularioConfigDTO[],
			error,
		};
	},
};

