import { Cliente, Turno, Vehiculo } from "@/model/types";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { TurnoEstado, TurnoDto as TurnoRow } from "@/model/dtos";
import type { SupabaseError } from "@/model/types";

function mapRowToTurno(row: TurnoRow, cliente: Cliente, vehiculo: Vehiculo): Turno {
	return {
		id: row.id,
		fecha: row.fecha,
		hora: row.hora,
		duracion: row.duracion,
		vehiculo: vehiculo,
		cliente: cliente,
		tipo: row.tipo,
		estado: row.estado,
		telefono: cliente.telefono ?? undefined,
		email: cliente.email ?? undefined,
		descripcion: row.descripcion ?? undefined,
		observaciones: row.observaciones ?? undefined,
	};
}

export enum TurnosServiceError {
	NotFound = "NotFound",
	Unknown = "Unknown",
}

function toServiceError(err: PostgrestError): TurnosServiceError {
	const code = (err as { code?: string }).code;
	if (code === "PGRST116") return TurnosServiceError.NotFound;
	return TurnosServiceError.Unknown;
}

export type ListTurnosFilters = {
	fecha?: string; // YYYY-MM-DD
	from?: string; // YYYY-MM-DD
	to?: string; // YYYY-MM-DD
	estado?: TurnoEstado;
};

export type CreateTurnoInput = {
	fecha: string; // YYYY-MM-DD
	hora: string; // HH:mm
	duracion: number;
	vehiculo_id: string;
	cliente_id: string;
	tipo: string;
	estado: TurnoEstado;
	descripcion?: string | null;
	observaciones?: string | null;
};

export type CreateTurnoResponse = {
	data: Turno | null;
	error: SupabaseError | null;
};

export const turnosService = {
	async list(
		supabase: SupabaseClient,
		filters: ListTurnosFilters = {}
	): Promise<{ data: TurnoRow[]; error: TurnosServiceError | null }>
	{
		let query = supabase
			.from("turnos")
			.select("*")
			.order("fecha", { ascending: true })
			.order("hora", { ascending: true });

		if (filters.fecha) query = query.eq("fecha", filters.fecha);
		if (filters.from) query = query.gte("fecha", filters.from);
		if (filters.to) query = query.lte("fecha", filters.to);
		if (filters.estado) query = query.eq("estado", filters.estado);

		const { data, error } = await query;
		if (error) return { data: [], error: toServiceError(error) };

		const rows = (data ?? []) as unknown as TurnoRow[];
		return { data: rows, error: null };
	},

	async create(
		supabase: SupabaseClient,
		input: CreateTurnoInput
	): Promise<{ data: Turno | null; error: SupabaseError | null }>
	{
		const insertPayload = {
			fecha: input.fecha,
			hora: input.hora,
			duracion: input.duracion,
			vehiculo_id: input.vehiculo_id,
			cliente_id: input.cliente_id,
			tipo: input.tipo,
			estado: input.estado,
			descripcion: input.descripcion ?? null,
			observaciones: input.observaciones ?? null,
		};

		const { data: inserted, error } = await supabase
			.from("turnos")
			.insert([insertPayload])
			.select("*")
			.single();

		if (error) {
			return { data: null, error: { message: error.message, code: (error as { code?: string }).code } };
		}

		return { data: inserted , error: null };
	},
} as const;

