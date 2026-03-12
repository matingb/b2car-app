import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { FormularioTemplateDTO } from "@/model/dtos";



export interface FormularioRepository {
	listAll(supabase: SupabaseClient): Promise<{ data: FormularioTemplateDTO[]; error: PostgrestError | null }>;
}

export const formularioRepository = {
	async listAll(
		supabase: SupabaseClient
	): Promise<{ data: FormularioTemplateDTO[]; error: PostgrestError | null }> {
		const { data, error } = await supabase
			.from("formularios")
			.select("id, tenant_id, descripcion, costodefault, metadata, created_at, updated_at")
			.order("created_at", { ascending: true });

		return {
			data: (data ?? []) as FormularioTemplateDTO[],
			error,
		};
	},
};

