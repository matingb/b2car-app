import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { OperacionDTO, OperacionLineaDTO } from "@/model/dtos";

export type OperacionesFilters = {
	fecha?: string; // YYYY-MM-DD
	from?: string; // YYYY-MM-DD
	to?: string; // YYYY-MM-DD
	tipo?: string[];
};

export type CreateOperacionLineaInput = {
	producto_id: string;
	cantidad?: number;
	monto_unitario?: number;
	delta_cantidad?: number;
};

export type CreateOperacionInput = {
	tipo: string;
	taller_id: string;
	created_at?: string;
	lineas?: CreateOperacionLineaInput[];
	arreglo_id?: string | null;
};

export type UpdateOperacionLineaInput = {
	producto_id: string;
	cantidad?: number;
	monto_unitario?: number;
	delta_cantidad?: number;
};

export type UpdateOperacionInput = {
	tipo?: string;
	taller_id?: string;
	created_at?: string;
	lineas?: UpdateOperacionLineaInput[];
	arreglo_id?: string | null;
};

export enum OperacionesServiceError {
	NotFound = "NotFound",
	Unknown = "Unknown",
}

type OperacionRow = OperacionDTO & { operaciones_lineas?: OperacionLineaDTO[] | null };

function toServiceError(err: PostgrestError): OperacionesServiceError {
	const code = (err as { code?: string }).code;
	if (code === "PGRST116") return OperacionesServiceError.NotFound;
	return OperacionesServiceError.Unknown;
}

function toDayStart(date: string) {
	return `${date}T00:00:00.000Z`;
}

function toDayEnd(date: string) {
	return `${date}T23:59:59.999Z`;
}

export const operacionesService = {
	async list(
		supabase: SupabaseClient,
		filters: OperacionesFilters = {}
	): Promise<{ data: OperacionRow[]; error: OperacionesServiceError | null }>
	{
		let query = supabase
			.from("operaciones")
			.select("*, operaciones_lineas(*)")
			.order("created_at", { ascending: false });

		if (filters.fecha) {
			query = query.gte("created_at", toDayStart(filters.fecha)).lte("created_at", toDayEnd(filters.fecha));
		}
		if (filters.from) query = query.gte("created_at", toDayStart(filters.from));
		if (filters.to) query = query.lte("created_at", toDayEnd(filters.to));
		if (filters.tipo && filters.tipo.length > 0) query = query.in("tipo", filters.tipo);

		const { data, error } = await query;
		if (error) return { data: [], error: toServiceError(error) };
		return { data: (data ?? []) as OperacionRow[], error: null };
	},

	async getById(
		supabase: SupabaseClient,
		id: string
	): Promise<{ data: OperacionRow | null; error: OperacionesServiceError | null }>
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
	): Promise<{ data: OperacionRow | null; error: OperacionesServiceError | null }>
	{
		const insertPayload = {
			tipo: input.tipo,
			taller_id: input.taller_id,
			...(input.created_at ? { created_at: input.created_at } : {}),
		};

		const { data: created, error: insertError } = await supabase
			.from("operaciones")
			.insert([insertPayload])
			.select("*")
			.single();

		if (insertError || !created) {
			return { data: null, error: insertError ? toServiceError(insertError) : OperacionesServiceError.Unknown };
		}

		let lineas: OperacionLineaDTO[] = [];
		if (Array.isArray(input.lineas) && input.lineas.length > 0) {
			const lineasPayload = input.lineas.map((l) => ({
				operacion_id: created.id,
				producto_id: l.producto_id,
				cantidad: l.cantidad ?? 0,
				monto_unitario: l.monto_unitario ?? 0,
				delta_cantidad: l.delta_cantidad ?? 0,
			}));

			const { data: insertedLineas, error: lineasError } = await supabase
				.from("operaciones_lineas")
				.insert(lineasPayload)
				.select("*");

			if (lineasError) {
				return { data: null, error: toServiceError(lineasError) };
			}

			lineas = (insertedLineas ?? []) as OperacionLineaDTO[];
		}

		if (input.arreglo_id) {
			const { error: asignacionError } = await supabase
				.from("operaciones_asignacion_arreglo")
				.upsert({ operacion_id: created.id, arreglo_id: input.arreglo_id });
			if (asignacionError) {
				return { data: null, error: toServiceError(asignacionError) };
			}
		}

		return {
			data: {
				...(created as OperacionDTO),
				operaciones_lineas: lineas,
			} as OperacionRow,
			error: null,
		};
	},

	async update(
		supabase: SupabaseClient,
		id: string,
		input: UpdateOperacionInput
	): Promise<{ data: OperacionRow | null; error: OperacionesServiceError | null }>
	{
		const updatePayload: Record<string, string | undefined> = {};
		if (input.tipo) updatePayload.tipo = input.tipo;
		if (input.taller_id) updatePayload.taller_id = input.taller_id;
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
					producto_id: l.producto_id,
					cantidad: l.cantidad ?? 0,
					monto_unitario: l.monto_unitario ?? 0,
					delta_cantidad: l.delta_cantidad ?? 0,
				}));

				const { error: insertError } = await supabase.from("operaciones_lineas").insert(lineasPayload);
				if (insertError) return { data: null, error: toServiceError(insertError) };
			}
		}

		if (input.arreglo_id !== undefined) {
			if (input.arreglo_id) {
				const { error: upsertError } = await supabase
					.from("operaciones_asignacion_arreglo")
					.upsert({ operacion_id: id, arreglo_id: input.arreglo_id });
				if (upsertError) return { data: null, error: toServiceError(upsertError) };
			} else {
				const { error: deleteAsigError } = await supabase
					.from("operaciones_asignacion_arreglo")
					.delete()
					.eq("operacion_id", id);
				if (deleteAsigError) return { data: null, error: toServiceError(deleteAsigError) };
			}
		}

		return this.getById(supabase, id);
	},

	async deleteById(
		supabase: SupabaseClient,
		id: string
	): Promise<{ error: OperacionesServiceError | null }>
	{
		const { data, error } = await supabase.from("operaciones").delete().eq("id", id).select("id");
		if (error) return { error: toServiceError(error) };
		if (!data || data.length === 0) return { error: OperacionesServiceError.NotFound };
		return { error: null };
	},
};
