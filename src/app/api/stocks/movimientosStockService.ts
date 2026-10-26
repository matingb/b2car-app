import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError } from "@/app/api/serviceError";
import { isValidUuid } from "@/lib/uuid";
import type { MovimientoStockDTO } from "@/model/dtos";
import {
	type MovimientosStockRepository,
	supabaseMovimientosStockRepository,
} from "./movimientosStockRepository";

export type ListarMovimientosInput = {
	productoId: string;
	tallerId?: string | null;
	limit?: number;
	offset?: number;
};

export function createMovimientosStockService(repository: MovimientosStockRepository) {
	return {
		async listar(
			supabase: SupabaseClient,
			input: ListarMovimientosInput
		): Promise<{ data: MovimientoStockDTO[]; error: ServiceError | PostgrestError | null }> {
			if (!isValidUuid(input.productoId)) {
				return { data: [], error: ServiceError.Validation };
			}

			if (input.tallerId && !isValidUuid(input.tallerId)) {
				return { data: [], error: ServiceError.Validation };
			}

			const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 200);
			const offset = Math.max(Number(input.offset) || 0, 0);

			return repository.listar(supabase, {
				productoId: input.productoId,
				tallerId: input.tallerId || null,
				limit,
				offset,
			});
		},
	};
}

export const movimientosStockService = createMovimientosStockService(
	supabaseMovimientosStockRepository
);
