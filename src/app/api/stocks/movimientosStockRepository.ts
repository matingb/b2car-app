import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, toServiceError } from "@/app/api/serviceError";
import type { MovimientoStockDTO } from "@/model/dtos";

export type ListarMovimientosStockFilters = {
	productoId: string;
	tallerId?: string | null;
	limit: number;
	offset: number;
};

export interface MovimientosStockRepository {
	listar(
		supabase: SupabaseClient,
		filters: ListarMovimientosStockFilters
	): Promise<{ data: MovimientoStockDTO[]; error: ServiceError | PostgrestError | null }>;
}

export const supabaseMovimientosStockRepository: MovimientosStockRepository = {
	async listar(supabase: SupabaseClient, filters: ListarMovimientosStockFilters) {
		const { data, error } = await supabase.rpc("rpc_listar_movimientos_stock", {
			p_producto_id: filters.productoId,
			p_taller_id: filters.tallerId || null,
			p_limite: filters.limit,
			p_offset: filters.offset,
		});

		if (error) return { data: [], error: toServiceError(error) ?? error };

		const mapped: MovimientoStockDTO[] = Array.isArray(data)
			? data.map((row: Record<string, unknown>) => ({
					id: String(row.id),
					tenant_id: String(row.tenant_id),
					taller_id: String(row.taller_id),
					taller_nombre: row.taller_nombre ? String(row.taller_nombre) : undefined,
					producto_id: String(row.producto_id),
					producto_nombre: row.producto_nombre ? String(row.producto_nombre) : undefined,
					producto_codigo: row.producto_codigo ? String(row.producto_codigo) : undefined,
					stock_id: String(row.stock_id),
					operacion_id: row.operacion_id ? String(row.operacion_id) : null,
					operacion_tipo: row.operacion_tipo ? String(row.operacion_tipo) : null,
					tipo_movimiento: String(row.tipo_movimiento),
					cantidad: Number(row.cantidad) || 0,
					saldo_anterior: Number(row.saldo_anterior) || 0,
					saldo_posterior: Number(row.saldo_posterior) || 0,
					fecha: String(row.fecha),
					motivo: row.motivo ? String(row.motivo) : null,
					created_by: row.created_by ? String(row.created_by) : null,
					created_at: String(row.created_at),
			  }))
			: [];

		return { data: mapped, error: null };
	},
};
