import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import {
	turnosService,
	CreateTurnoInput
} from "./turnosService";
import { TurnoEstado } from "@/model/dtos";

const VALID_ESTADOS: readonly TurnoEstado[] = ["confirmado", "pendiente", "cancelado"] as const;

function isIsoDate(value?: string | null): value is string {
	return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isHourMinute(value?: string | null): value is string {
	return Boolean(value && /^\d{2}:\d{2}$/.test(value));
}

function isTurnoEstado(value: unknown): value is TurnoEstado {
	return VALID_ESTADOS.includes(value as TurnoEstado);
}

export async function GET(req: Request) {
	const supabase = await createClient();

	const url = new URL(req.url);
	const fecha = url.searchParams.get("fecha") ?? undefined;
	const from = url.searchParams.get("from") ?? undefined;
	const to = url.searchParams.get("to") ?? undefined;
	const estado = url.searchParams.get("estado") ?? undefined;
	const taller_id = url.searchParams.get("taller_id") ?? undefined;

	if (fecha && !isIsoDate(fecha)) {
		return Response.json({ data: [], error: "Query param 'fecha' inválido (YYYY-MM-DD)" }, { status: 400 });
	}
	if (from && !isIsoDate(from)) {
		return Response.json({ data: [], error: "Query param 'from' inválido (YYYY-MM-DD)" }, { status: 400 });
	}
	if (to && !isIsoDate(to)) {
		return Response.json({ data: [], error: "Query param 'to' inválido (YYYY-MM-DD)" }, { status: 400 });
	}
	if (estado && !isTurnoEstado(estado)) {
		return Response.json(
			{ data: [], error: "Query param 'estado' inválido (confirmado|pendiente|cancelado)" },
			{ status: 400 }
		);
	}

	const { data, error } = await turnosService.list(supabase, {
		fecha,
		from,
		to,
		estado: estado as TurnoEstado | undefined,
		taller_id,
	});

	logger.debug("GET /api/turnos - filters:", { fecha, from, to, estado, taller_id }, "data:", data, "error:", error);

	if (error) {
		const status = error === "NotFound" ? 404 : 500;
		const message = status === 404 ? "Turnos no encontrados" : "Error cargando turnos";
		return Response.json({ data: [], error: message }, { status });
	}

	return Response.json({ data, error: null });
}

export async function POST(req: Request) {
	const supabase = await createClient();

	const body = await req.json().catch(() => null) as CreateTurnoInput;
	if (!body) {
		return Response.json({ data: null, error: { message: "JSON invalido", code: "validation" } }, { status: 400 });
	}

	const titulo = body.titulo;
	const taller_id = body.taller_id;
	const fecha = body.fecha;
	const hora = body.hora;
	const duracion = body.duracion;
	const vehiculo_id = body.vehiculo_id?.trim() || null;
	const cliente_id = body.cliente_id?.trim() || null;
	const tipo = body.tipo?.trim() || null;
	const estado = body.estado;

	if (!titulo?.trim()) {
		return Response.json({ data: null, error: { message: "Falta título del turno", code: "validation" } }, { status: 400 });
	}
	if (!taller_id?.trim()) {
		return Response.json({ data: null, error: { message: "Falta taller id", code: "validation" } }, { status: 400 });
	}
	if (!isIsoDate(fecha)) {
		return Response.json({ data: null, error: { message: "Falta/invalid fecha (YYYY-MM-DD)", code: "validation" } }, { status: 400 });
	}
	if (!isHourMinute(hora)) {
		return Response.json({ data: null, error: { message: "Falta/invalid hora (HH:mm)", code: "validation" } }, { status: 400 });
	}

	const estadoFinal: TurnoEstado = isTurnoEstado(estado) ? estado : "confirmado";

	const input: CreateTurnoInput = {
		titulo: titulo.trim(),
		taller_id: taller_id.trim(),
		fecha: fecha,
		hora: hora,
		duracion,
		vehiculo_id,
		cliente_id,
		tipo,
		estado: estadoFinal,
		descripcion: body.descripcion?.trim() ?? null,
		observaciones: body.observaciones?.trim() ?? null,
	};

	const { data: inserted, error: insertError } = await turnosService.create(supabase, input);

	if (insertError) {
		const code = insertError.code || "";
		let status = 500;
		let message = insertError.message ? `Error al crear turno: ${insertError.message}` : "Error al crear turno";
		if (code === "23505") {
			status = 409;
			message = "Ya existe un turno para ese horario";
		} else if (code === "23502") {
			status = 400;
			message = `Falta un campo obligatorio`;
		} else if (code === "23503") {
			status = 400;
			message = `El cliente, vehículo o taller especificado no existe o no es válido (${insertError.message})`;
		}
		logger.error("POST /api/turnos - error:", insertError);
		return Response.json({ data: null, error: { message, code: insertError.code, details: insertError.message } }, { status });
	}

	await statsService.onDataChanged(supabase);
	return Response.json({ data: inserted, error: null }, { status: 201 });
}
