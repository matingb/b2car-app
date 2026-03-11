import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, toServiceError } from "@/app/api/serviceError";
import {
	formularioRepository,
    FormularioRepository
} from "./formularioRepository";
import { FormularioConfigDTO } from "@/model/dtos";

export type FormularioConfigItem = {
	id: string;
	descripcion: string;
	costoDefault: number;
	metadata: Record<string, unknown> | null;
	created_at: string;
	updated_at: string;
};

function mapFormularioConfig(row: FormularioConfigDTO): FormularioConfigItem {
	return {
		id: row.id,
		descripcion: row.descripcion,
		costoDefault: Number(row.costodefault) || 0,
		metadata: row.metadata,
		created_at: row.created_at,
		updated_at: row.updated_at,
	};
}

export function createFormularioService(repository : FormularioRepository) {
	return {
		async listAll(
			supabase: SupabaseClient
		): Promise<{ data: FormularioConfigItem[]; error: ServiceError | null }> {
			const { data, error } = await repository.listAll(supabase);

		if (error) return { data: [], error: toServiceError(error) };

			return {
				data: data.map(mapFormularioConfig),
				error: null,
			};
		},
	};
};

export const formularioService = createFormularioService(formularioRepository);

