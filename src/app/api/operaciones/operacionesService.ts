import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { OperacionDTO, OperacionLineaDTO } from "@/model/dtos";
import { logger } from "@/lib/logger";
import { ServiceError, toServiceError } from "@/app/api/serviceError";

export type OperacionesFilters = {
	fecha?: string; // YYYY-MM-DD
	from?: string; // YYYY-MM-DD
	to?: string; // YYYY-MM-DD
	tipo?: string[];
};

export type OperacionesPagination = {
	page: number;
	pageSize: number;
};

export const OPERACIONES_PAGE_SIZE = 50;

export type OperacionesStats = {
	ventas: number;
	compras: number;
	asignaciones: number;
	gastos: number;
	neto: number;
};

export type CreateOperacionLineaInput = {
	stock_id: string;
	cantidad?: number;
	monto_unitario?: number;
	delta_cantidad?: number;
};

export type CreateOperacionInput = {
	tipo: string;
	taller_id: string;
	fecha?: string;
	created_at?: string;
	lineas?: CreateOperacionLineaInput[];
	arreglo_id?: string | null;
	cuenta_financiera_id?: string | null;
	idempotency_key?: string | null;
};

export type UpdateOperacionLineaInput = {
	stock_id: string;
	cantidad?: number;
	monto_unitario?: number;
	delta_cantidad?: number;
};

export type UpdateOperacionInput = {
	tipo?: string;
	taller_id?: string;
	fecha?: string;
	created_at?: string;
	lineas?: UpdateOperacionLineaInput[];
	cuenta_financiera_id?: string | null;
	idempotency_key?: string | null;
};

type OperacionRow = OperacionDTO & { operaciones_lineas?: OperacionLineaDTO[] | null };

/**
 * Proyección de la RPC que mezcla stock y gastos sin forzar estos últimos a
 * pertenecer a un taller. `lineas` llega como JSONB para conservar una sola
 * paginación y un orden estable.
 */
export type OperacionListRow = {
	id: string;
	tipo: string;
	taller_id: string | null;
	fecha: string;
	created_at: string;
	lineas: unknown;
	gasto_id: string | null;
	descripcion: string | null;
	categoria_gasto: string | null;
	cuenta_financiera_id: string | null;
	cuenta_financiera_nombre: string | null;
	monto: number | string | null;
	total_count: number | string | null;
};

type OperacionesStatsRow = {
	ventas?: number | string | null;
	compras?: number | string | null;
	asignaciones?: number | string | null;
	gastos?: number | string | null;
	neto?: number | string | null;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toTimestampStart(value: string) {
	return DATE_ONLY_PATTERN.test(value) ? `${value}T00:00:00.000Z` : value;
}

function toTimestampEndExclusive(value: string) {
	if (!DATE_ONLY_PATTERN.test(value)) return value;

	const date = new Date(`${value}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + 1);
	return date.toISOString();
}

export const operacionesService = {
	async list(
		supabase: SupabaseClient,
		filters: OperacionesFilters = {},
		pagination: OperacionesPagination = { page: 1, pageSize: OPERACIONES_PAGE_SIZE }
	): Promise<{ data: OperacionListRow[]; total: number; error: ServiceError | null }>
	{
		const page = Math.max(1, Math.trunc(pagination.page) || 1);
		const pageSize = OPERACIONES_PAGE_SIZE;
		const from = filters.fecha
			? toTimestampStart(filters.fecha)
			: filters.from
				? toTimestampStart(filters.from)
				: null;
		const to = filters.fecha
			? toTimestampEndExclusive(filters.fecha)
			: filters.to
				? toTimestampEndExclusive(filters.to)
				: null;

		const { data, error } = await supabase.rpc("rpc_listar_operaciones_con_gastos", {
			p_from: from,
			p_to: to,
			p_tipos: filters.tipo && filters.tipo.length > 0 ? filters.tipo : null,
			p_page: page,
			p_page_size: pageSize,
		});
		if (error) return { data: [], total: 0, error: toServiceError(error) };
		const rows = (Array.isArray(data) ? data : []) as OperacionListRow[];
		const total = rows.length > 0 ? Number(rows[0]?.total_count) || 0 : 0;
		return { data: rows, total, error: null };
	},

	async getById(
		supabase: SupabaseClient,
		id: string
	): Promise<{ data: OperacionRow | null; error: ServiceError | null }>
	{
		const { data, error } = await supabase
			.from("operaciones")
			.select("*, operaciones_lineas(*)")
			.eq("id", id)
			.single();

		if (error) return { data: null, error: toServiceError(error) };
		return { data: (data ?? null) as OperacionRow | null, error: null };
	},

	async create(
		supabase: SupabaseClient,
		input: CreateOperacionInput
	): Promise<{ data: OperacionRow | null; error: ServiceError | null }>
	{
		const lineasPayload = Array.isArray(input.lineas)
			? input.lineas.map((l) => ({
					stock_id: l.stock_id,
					cantidad: l.cantidad ?? 0,
					monto_unitario: l.monto_unitario ?? 0,
					delta_cantidad: l.delta_cantidad ?? 0,
				}))
			: [];

		const { data: operacionId, error: rpcError } = await supabase.rpc("rpc_crear_operacion_con_stock", {
			p_tipo: input.tipo,
			p_taller_id: input.taller_id,
			p_lineas: lineasPayload,
			p_arreglo_id: input.arreglo_id ?? null,
			p_fecha: input.fecha ?? null,
			p_cuenta_id: input.cuenta_financiera_id ?? null,
			p_idempotency_key: input.idempotency_key ?? null,
		});

		if (rpcError || !operacionId) {
			logger.error("Error creating operacion:", rpcError?.code);
			return { data: null, error: toServiceError(rpcError ?? { code: "Unknown", message: "Unknown error" } as PostgrestError) };
		}

		return this.getById(supabase, operacionId as string);
	},

	async update(
		supabase: SupabaseClient,
		id: string,
		input: UpdateOperacionInput
	): Promise<{ data: OperacionRow | null; error: ServiceError | null }>
	{
		const current = await this.getById(supabase, id);
		if (current.error || !current.data) return { data: null, error: current.error ?? ServiceError.NotFound };

		const currentLineas = Array.isArray(current.data.operaciones_lineas)
			? current.data.operaciones_lineas
			: [];
		const lineas = Array.isArray(input.lineas)
			? input.lineas
			: currentLineas;
		const lineasPayload = lineas.map((linea) => ({
			stock_id: linea.stock_id,
			cantidad: linea.cantidad ?? 0,
			monto_unitario: linea.monto_unitario ?? 0,
			delta_cantidad: linea.delta_cantidad ?? 0,
		}));
		const tipo = input.tipo ?? current.data.tipo;
		const tallerId = input.taller_id ?? current.data.taller_id;
		const fecha = input.fecha ?? current.data.fecha;
		const esOperacionFinanciera = tipo === "COMPRA" || tipo === "VENTA";
		const cuentaFueInformada = Object.prototype.hasOwnProperty.call(input, "cuenta_financiera_id");
		let cuentaFinancieraId = input.cuenta_financiera_id ?? null;

		// Una actualización parcial conserva la cuenta del asiento vigente. Si el
		// cliente manda null explícitamente, la RPC la rechaza para COMPRA/VENTA.
		if (esOperacionFinanciera && !cuentaFueInformada) {
			const { data: movimiento, error: movimientoError } = await supabase
				.from("movimientos_financieros")
				.select("cuenta_financiera_id")
				.eq("operacion_id", id)
				.maybeSingle();
			if (movimientoError) return { data: null, error: toServiceError(movimientoError) };
			cuentaFinancieraId = movimiento?.cuenta_financiera_id ?? null;
		}

		const { data: updatedId, error: rpcError } = await supabase.rpc("rpc_actualizar_operacion_con_stock", {
			p_operacion_id: id,
			p_tipo: tipo,
			p_taller_id: tallerId,
			p_lineas: lineasPayload,
			p_fecha: fecha,
			p_cuenta_id: cuentaFinancieraId,
			p_idempotency_key: input.idempotency_key ?? null,
		});
		if (rpcError || !updatedId) {
			return { data: null, error: toServiceError(rpcError ?? { code: "Unknown", message: "No se pudo actualizar la operación" } as PostgrestError) };
		}

		return this.getById(supabase, String(updatedId));
	},

	async deleteById(
		supabase: SupabaseClient,
		id: string,
		idempotencyKey?: string | null,
	): Promise<{ error: ServiceError | null }>
	{
		const { data, error } = await supabase.rpc("rpc_borrar_operacion_con_stock", {
			p_operacion_id: id,
			p_idempotency_key: idempotencyKey ?? null,
		});
		if (error) return { error: toServiceError(error) };
		if (!data) return { error: ServiceError.NotFound };
		return { error: null };
	},

	async stats(
		supabase: SupabaseClient,
		filters: OperacionesFilters = {}
	): Promise<{ data: OperacionesStats; error: ServiceError | null }>
	{
		const { data, error } = await supabase.rpc("rpc_operaciones_stats", {
			p_from: filters.fecha ? toTimestampStart(filters.fecha) : filters.from ? toTimestampStart(filters.from) : null,
			p_to: filters.fecha
				? toTimestampEndExclusive(filters.fecha)
				: filters.to
					? toTimestampEndExclusive(filters.to)
					: null,
			p_tipos: filters.tipo && filters.tipo.length > 0 ? filters.tipo : null,
		});
		if (error) return { data: { ventas: 0, compras: 0, asignaciones: 0, gastos: 0, neto: 0 }, error: toServiceError(error) };

		const row = (Array.isArray(data) ? data[0] : data) as OperacionesStatsRow | null;
		return {
			data: {
				ventas: Number(row?.ventas) || 0,
				compras: Number(row?.compras) || 0,
				asignaciones: Number(row?.asignaciones) || 0,
				gastos: Number(row?.gastos) || 0,
				neto: Number(row?.neto) || 0,
			},
			error: null,
		};
	},
};
