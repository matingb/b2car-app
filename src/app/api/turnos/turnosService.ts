import { Cliente, TipoCliente, Turno, Vehiculo } from "@/model/types";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { TurnoEstado, TurnoDto as TurnoRow } from "@/model/dtos";
import type { SupabaseError } from "@/model/types";
import { logger } from "@/lib/logger";

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
	duracion: number | null;
	vehiculo_id: string;
	cliente_id: string;
	tipo: string | null;
	estado: TurnoEstado;
	descripcion?: string | null;
	observaciones?: string | null;
};

export type UpdateTurnoInput = {
	id: string;
	fecha?: string; // YYYY-MM-DD
	hora?: string; // HH:mm
	duracion?: number | null;
	vehiculo_id?: string;
	cliente_id?: string;
	tipo?: string | null;
	estado?: TurnoEstado;
	descripcion?: string | null;
	observaciones?: string | null;
};

export type DeleteTurnoInput = {
	id: string;
};

export type CreateTurnoResponse = {
	data: Turno | null;
	error: SupabaseError | null;
};

export type GetTurnosResponse = {
    data: Turno[] | null;
    error?: SupabaseError | null;
};

type TurnoListRow = TurnoRow & {
	vehiculo_id_full?: string | null;
	vehiculo_cliente_id?: string | null;
	patente?: string | null;
	marca?: string | null;
	modelo?: string | null;
	fecha_patente?: string | null;
	nro_interno?: string | null;

	cliente_id_full?: string | null;
	tipo_cliente?: TipoCliente | null;
	particular_nombre?: string | null;
	particular_apellido?: string | null;
	particular_telefono?: string | null;
	particular_email?: string | null;
	particular_direccion?: string | null;
	empresa_nombre?: string | null;
	empresa_telefono?: string | null;
	empresa_email?: string | null;
	empresa_direccion?: string | null;
	empresa_cuit?: string | null;
};

function toHHMM(value: unknown): string | null {
	if (value == null) return null;

	if (typeof value === "string") {
		if (value.includes(":")) {
			const [h, m] = value.split(":");
			const hours = Number.parseInt(h ?? "", 10);
			const minutes = Number.parseInt(m ?? "", 10);
			if (Number.isFinite(hours) && Number.isFinite(minutes)) {
				return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
			}
			return null;
		}

		const n = Number(value);
		if (!Number.isFinite(n)) return null;
		const minutesTotal = Math.trunc(n);
		const hours = Math.floor(minutesTotal / 60);
		const minutes = minutesTotal % 60;
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
	}

	if (typeof value === "number") {
		if (!Number.isFinite(value)) return null;
		const minutesTotal = Math.trunc(value);
		const hours = Math.floor(minutesTotal / 60);
		const minutes = minutesTotal % 60;
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
	}

	return null;
}

export const turnosService = {
	async list(
		supabase: SupabaseClient,
		filters: ListTurnosFilters = {}
	): Promise<{ data: Turno[]; error: TurnosServiceError | null }>
	{
		let query = supabase
			.from("vista_turnos_con_detalle")
			.select("*")
			.order("fecha", { ascending: true })
			.order("hora", { ascending: true });

		if (filters.fecha) query = query.eq("fecha", filters.fecha);
		if (filters.from) query = query.gte("fecha", filters.from);
		if (filters.to) query = query.lte("fecha", filters.to);
		if (filters.estado) query = query.eq("estado", filters.estado);

		const { data, error } = await query;
		logger.debug("turnosService.list - filters:", filters, "data:", data, "error:", error);
		if (error) return { data: [], error: toServiceError(error) };

		const rows = (data ?? []) as TurnoListRow[];
		const turnos: Turno[] = rows.map((row) => {
			const nombreCliente = `${row.particular_nombre || ""} ${row.particular_apellido || ""}`.trim()
				|| row.empresa_nombre
				|| "";
			const vehiculo: Vehiculo = {
				id: row.vehiculo_id_full ?? row.vehiculo_id,
				nombre_cliente: nombreCliente,
				patente: row.patente ?? "",
				marca: row.marca ?? "",
				modelo: row.modelo ?? "",
				fecha_patente: row.fecha_patente ?? "",
				nro_interno: row.nro_interno ?? null,
			};

			let cliente: Cliente;
			if (row.tipo_cliente === TipoCliente.PARTICULAR) {
				cliente = {
					id: row.cliente_id_full ?? row.cliente_id,
					nombre: nombreCliente,
					tipo_cliente: TipoCliente.PARTICULAR,
					telefono: row.particular_telefono ?? "",
					email: row.particular_email ?? "",
					direccion: row.particular_direccion ?? "",
				};
			} else {
				cliente = {
					id: row.cliente_id_full ?? row.cliente_id,
					nombre: row.empresa_nombre ?? nombreCliente,
					tipo_cliente: row.tipo_cliente ?? TipoCliente.EMPRESA,
					telefono: row.empresa_telefono ?? "",
					email: row.empresa_email ?? "",
					direccion: row.empresa_direccion ?? "",
					cuit: row.empresa_cuit ?? undefined,
				};
			}

			return {
				id: row.id,
				fecha: row.fecha,
				hora: toHHMM(row.hora) || "09:00",
				duracion: row.duracion,
				vehiculo,
				cliente,
				tipo: row.tipo,
				estado: row.estado,
				descripcion: row.descripcion ?? undefined,
				observaciones: row.observaciones ?? undefined,
			};
		});

		return { data: turnos, error: null };
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
	async update(
		supabase: SupabaseClient,
		input: UpdateTurnoInput
	): Promise<{ data: Turno | null; error: SupabaseError | null }> {

		const { data: updated, error } = await supabase
			.from("turnos")
			.update(input)
			.eq("id", input.id)
			.select("*")
			.single();

		if (error) {
			return { data: null, error: { message: error.message, code: (error as { code?: string }).code } };
		}

		return { data: updated , error: null };
	},
	async delete(
		supabase: SupabaseClient,
		input: DeleteTurnoInput
	): Promise<{ error: SupabaseError | null }> {

		const { error } = await supabase
			.from("turnos")
			.delete()
			.eq("id", input.id);

		if (error) {
			return { error: { message: error.message, code: (error as { code?: string }).code } };
		}
		return { error: null };
	}
} as const;

