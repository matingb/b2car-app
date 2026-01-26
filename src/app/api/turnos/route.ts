import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import {
	turnosService,
	CreateTurnoInput
} from "./turnosService";
import { TurnoEstado } from "@/model/dtos";

function isIsoDate(value: unknown): value is string {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isHourMinute(value: unknown): value is string {
	return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function isTurnoEstado(value: unknown): value is TurnoEstado {
	return value === "Confirmado" || value === "Pendiente" || value === "Cancelado";
}

export async function GET(req: Request) {
	const supabase = await createClient();

	const url = new URL(req.url);
	const fecha = url.searchParams.get("fecha") ?? undefined;
	const from = url.searchParams.get("from") ?? undefined;
	const to = url.searchParams.get("to") ?? undefined;
	const estado = url.searchParams.get("estado") ?? undefined;

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
			{ data: [], error: "Query param 'estado' inválido (Confirmado|Pendiente|Cancelado)" },
			{ status: 400 }
		);
	}

	const { data, error } = await turnosService.list(supabase, {
		fecha,
		from,
		to,
		estado: estado as TurnoEstado | undefined,
	});

	logger.debug("GET /api/turnos - filters:", { fecha, from, to, estado }, "data:", data, "error:", error);

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

	const fecha = body.fecha;
	const hora = body.hora;
	const duracion = body.duracion;
	const vehiculo_id = body.vehiculo_id;
	const cliente_id = body.cliente_id;
	const tipo = body.tipo;
	const estado = body.estado;

	if (!isIsoDate(fecha)) {
		return Response.json({ data: null, error: { message: "Falta/invalid fecha (YYYY-MM-DD)", code: "validation" } }, { status: 400 });
	}
	if (!isHourMinute(hora)) {
		return Response.json({ data: null, error: { message: "Falta/invalid hora (HH:mm)", code: "validation" } }, { status: 400 });
	}

	if (typeof vehiculo_id !== "string" || !vehiculo_id.trim()) {
		return Response.json({ data: null, error: { message: "Falta vehiculo id", code: "validation" } }, { status: 400 });
	}
	if (typeof cliente_id !== "string" || !cliente_id.trim()) {
		return Response.json({ data: null, error: { message: "Falta cliente id", code: "validation" } }, { status: 400 });
	}

	const estadoFinal: TurnoEstado = isTurnoEstado(estado) ? estado : "confirmado";

	const input: CreateTurnoInput = {
		fecha: fecha,
		hora: hora,
		duracion,
		vehiculo_id: vehiculo_id.trim(),
		cliente_id: cliente_id.trim(),
		tipo: tipo?.trim() ?? null,
		estado: estadoFinal,
		descripcion: body.descripcion?.trim() ?? null,
		observaciones: body.observaciones?.trim() ?? null,
	};

	const { data: inserted, error: insertError } = await turnosService.create(supabase, input);

	if (insertError) {
		const code = insertError.code || "";
		const status = code === "23505" ? 409 : 500;
		const message = status === 409 ? "Ya existe un turno para ese horario" : "Error al crear turno";
		logger.error("POST /api/turnos - error:", insertError);
		return Response.json({ data: null, error: { message, code: insertError.code } }, { status });
	}

	await statsService.onDataChanged(supabase);
	return Response.json({ data: inserted, error: null }, { status: 201 });
}



