import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { OperacionDTO, OperacionLineaDTO } from "@/model/dtos";
import { logger } from "@/lib/logger";
import { ServiceError, toServiceError } from "@/app/api/serviceError";
import { UpdateOperacionRequest } from "./[id]/route";

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
};

type OperacionRow = OperacionDTO & { operaciones_lineas?: OperacionLineaDTO[] | null };

type OperacionesStatsRow = {
	ventas?: number | string | null;
	compras?: number | string | null;
	asignaciones?: number | string | null;
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
	): Promise<{ data: OperacionRow[]; total: number; error: ServiceError | null }>
	{
		const page = Math.max(1, Math.trunc(pagination.page) || 1);
		const pageSize = OPERACIONES_PAGE_SIZE;
		const from = (page - 1) * pageSize;
		const to = from + pageSize - 1;

		let query = supabase
			.from("operaciones")
			.select("*, operaciones_lineas(*)", { count: "exact" })
			.order("fecha", { ascending: false })
			.order("created_at", { ascending: false })
			.order("id", { ascending: false });

		if (filters.fecha) {
			query = query
				.gte("fecha", toTimestampStart(filters.fecha))
				.lt("fecha", toTimestampEndExclusive(filters.fecha));
		}
		if (filters.from) query = query.gte("fecha", toTimestampStart(filters.from));
		if (filters.to) query = query.lt("fecha", toTimestampEndExclusive(filters.to));
		if (filters.tipo && filters.tipo.length > 0) query = query.in("tipo", filters.tipo);

		const { data, count, error } = await query.range(from, to);
		if (error) return { data: [], total: 0, error: toServiceError(error) };
		return { data: (data ?? []) as OperacionRow[], total: count ?? 0, error: null };
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
		});

		logger.error("RPC crear_operacion_con_stock - operacionId:", operacionId, "rpcError:", rpcError);

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
	): Promise<{ data: UpdateOperacionRequest | null; error: ServiceError | null }>
	{
		const updatePayload: Record<string, string | undefined> = {};
		if (input.tipo) updatePayload.tipo = input.tipo;
		if (input.taller_id) updatePayload.taller_id = input.taller_id;
		if (input.fecha) updatePayload.fecha = input.fecha;
		if (input.created_at) updatePayload.created_at = input.created_at;

		if (Object.keys(updatePayload).length > 0) {
			const { error: updateError } = await supabase.from("operaciones").update(updatePayload).eq("id", id);
			if (updateError) return { data: null, error: toServiceError(updateError) };
		}

		if (Array.isArray(input.lineas)) {
			const { error: deleteError } = await supabase.from("operaciones_lineas").delete().eq("operacion_id", id);
			if (deleteError) return { data: null, error: toServiceError(deleteError) };

			if (input.lineas.length > 0) {
				const lineasPayload = input.lineas.map((l) => ({
					operacion_id: id,
					stock_id: l.stock_id,
					cantidad: l.cantidad ?? 0,
					monto_unitario: l.monto_unitario ?? 0,
					delta_cantidad: l.delta_cantidad ?? 0,
				}));

				const { error: insertError } = await supabase.from("operaciones_lineas").insert(lineasPayload);
				if (insertError) return { data: null, error: toServiceError(insertError) };
			}
		}

		return this.getById(supabase, id);
	},

	async deleteById(
		supabase: SupabaseClient,
		id: string
	): Promise<{ error: ServiceError | null }>
	{
		const { data, error } = await supabase.rpc("rpc_borrar_operacion_con_stock", {
			p_operacion_id: id,
		});
		logger.error("RPC borrar_operacion_con_stock - data:", data, "error:", error);
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
		if (error) return { data: { ventas: 0, compras: 0, asignaciones: 0, neto: 0 }, error: toServiceError(error) };

		const row = (Array.isArray(data) ? data[0] : data) as OperacionesStatsRow | null;
		return {
			data: {
				ventas: Number(row?.ventas) || 0,
				compras: Number(row?.compras) || 0,
				asignaciones: Number(row?.asignaciones) || 0,
				neto: Number(row?.neto) || 0,
			},
			error: null,
		};
	},
};
