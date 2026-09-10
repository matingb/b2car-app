import { Cliente, Taller, TipoCliente, Turno, Vehiculo } from "@/model/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TurnoDto, TurnoEstado, TurnoDto as TurnoRow } from "@/model/dtos";
import type { SupabaseError } from "@/model/types";
import { logger } from "@/lib/logger";
import { ServiceError, toServiceError } from "@/app/api/serviceError";


export type ListTurnosFilters = {
	fecha?: string; // YYYY-MM-DD
	from?: string; // YYYY-MM-DD
	to?: string; // YYYY-MM-DD
	estado?: TurnoEstado;
	taller_id?: string;
};

export type CreateTurnoInput = {
	titulo: string;
	fecha: string; // YYYY-MM-DD
	hora: string; // HH:mm
	duracion: number | null;
	taller_id: string;
	vehiculo_id?: string | null;
	cliente_id?: string | null;
	tipo: string | null;
	estado: TurnoEstado;
	descripcion?: string | null;
	observaciones?: string | null;
};

export type UpdateTurnoInput = {
	id: string;
	titulo?: string;
	fecha?: string; // YYYY-MM-DD
	hora?: string; // HH:mm
	duracion?: number | null;
	taller_id?: string;
	vehiculo_id?: string | null;
	cliente_id?: string | null;
	tipo?: string | null;
	estado?: TurnoEstado;
	descripcion?: string | null;
	observaciones?: string | null;
};

export type DeleteTurnoInput = {
	id: string;
};

export type CreateTurnoResponse = {
	data: TurnoDto | null;
	error: SupabaseError | null;
};

export type GetTurnosResponse = {
    data: Turno[] | null;
    error?: SupabaseError | null;
};

type TurnoListRow = TurnoRow & {
	taller_nombre?: string | null;
	taller_ubicacion?: string | null;
	vehiculo_id_full?: string | null;
	vehiculo_cliente_id?: string | null;
	patente?: string | null;
	marca?: string | null;
	modelo?: string | null;
	fecha_patente?: string | null;
	numero_chasis?: string | null;
	nro_interno?: string | null;

	cliente_id_full?: string | null;
	tipo_cliente?: TipoCliente | null;
	particular_nombre?: string | null;
	particular_apellido?: string | null;
	particular_codigo_pais?: string | null;
	particular_telefono?: string | null;
	particular_email?: string | null;
	particular_direccion?: string | null;
	empresa_nombre?: string | null;
	empresa_codigo_pais?: string | null;
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

function resolverTituloTurno(
	titulo: string | null | undefined,
	vehiculo: Vehiculo | null,
	cliente: Cliente | null
): string {
	if (titulo) return titulo;
	if (vehiculo) return `${vehiculo.patente} - ${vehiculo.marca}`;
	if (cliente) return cliente.nombre;
	return "Turno";
}

export const turnosService = {
	async list(
		supabase: SupabaseClient,
		filters: ListTurnosFilters = {}
	): Promise<{ data: Turno[]; error: ServiceError | null }>
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
		if (filters.taller_id) query = query.eq("taller_id", filters.taller_id);

		const { data, error } = await query;
		logger.debug("turnosService.list - filters:", filters, "data:", data, "error:", error);
		if (error) return { data: [], error: toServiceError(error) };

		const rows = (data ?? []) as TurnoListRow[];
		const turnos: Turno[] = rows.map((row) => {
			const nombreCliente = `${row.particular_nombre || ""} ${row.particular_apellido || ""}`.trim()
				|| row.empresa_nombre
				|| "";

			const hasVehiculo = Boolean(row.vehiculo_id || row.vehiculo_id_full || row.patente);
			const vehiculo: Vehiculo | null = hasVehiculo
				? {
					id: row.vehiculo_id_full ?? row.vehiculo_id ?? "",
					nombre_cliente: nombreCliente,
					patente: row.patente ?? "",
					marca: row.marca ?? "",
					modelo: row.modelo ?? "",
					fecha_patente: row.fecha_patente ?? "",
					numero_chasis: row.numero_chasis ?? "",
					nro_interno: row.nro_interno ?? null,
				}
				: null;

			// Check by ID only — nombreCliente puede ser "" sin haber datos reales
			const hasCliente = Boolean(row.cliente_id || row.cliente_id_full || row.tipo_cliente);
			let cliente: Cliente | null = null;
			if (hasCliente) {
				if (row.tipo_cliente === TipoCliente.PARTICULAR) {
					cliente = {
						id: row.cliente_id_full ?? row.cliente_id ?? "",
						nombre: nombreCliente,
						tipo_cliente: TipoCliente.PARTICULAR,
						codigo_pais: row.particular_codigo_pais ?? undefined,
						telefono: row.particular_telefono ?? "",
						email: row.particular_email ?? "",
						direccion: row.particular_direccion ?? "",
					};
				} else {
					cliente = {
						id: row.cliente_id_full ?? row.cliente_id ?? "",
						nombre: row.empresa_nombre ?? nombreCliente,
						tipo_cliente: row.tipo_cliente ?? TipoCliente.EMPRESA,
						codigo_pais: row.empresa_codigo_pais ?? undefined,
						telefono: row.empresa_telefono ?? "",
						email: row.empresa_email ?? "",
						direccion: row.empresa_direccion ?? "",
						cuit: row.empresa_cuit ?? undefined,
					};
				}
			}

			const taller: Taller | null = row.taller_id
				? {
					id: row.taller_id,
					nombre: row.taller_nombre ?? "",
					ubicacion: row.taller_ubicacion ?? "",
				}
				: null;

			return {
				id: row.id,
				titulo: resolverTituloTurno(row.titulo, vehiculo, cliente),
				fecha: row.fecha,
				hora: toHHMM(row.hora) || "09:00",
				duracion: row.duracion,
				taller_id: row.taller_id,
				taller,
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
			titulo: input.titulo.trim(),
			fecha: input.fecha,
			hora: input.hora,
			duracion: input.duracion,
			taller_id: input.taller_id,
			vehiculo_id: input.vehiculo_id ?? null,
			cliente_id: input.cliente_id ?? null,
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

		const { id: _id, ...rest } = input;
		const updatePayload: Omit<UpdateTurnoInput, "id"> = {
			...rest,
			...("vehiculo_id" in input ? { vehiculo_id: input.vehiculo_id ?? null } : {}),
			...("cliente_id" in input ? { cliente_id: input.cliente_id ?? null } : {}),
			...(typeof input.titulo === "string" ? { titulo: input.titulo.trim() } : {}),
		};

		const { data: updated, error } = await supabase
			.from("turnos")
			.update(updatePayload)
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
