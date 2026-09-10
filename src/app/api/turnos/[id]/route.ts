import { createClient } from "@/supabase/server";
import { CreateTurnoInput, turnosService, UpdateTurnoInput } from "../turnosService";
import { logger } from "@/lib/logger";
import { statsService } from "../../dashboard/stats/dashboardStatsService";
import { NextRequest } from "next/server";


export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { id } = await params;
    if (!id) {
        return Response.json({ data: null, error: { message: "Falta turno id", code: "validation" } }, { status: 400 });
    }

    const { error: deleteError } = await turnosService.delete(supabase, { id });
    if (deleteError) {
        logger.error("DELETE /api/turnos - error:", deleteError);
        return Response.json({ data: null, error: { message: "Error al eliminar turno", code: deleteError.code } }, { status: 500 });
    }
    await statsService.onDataChanged(supabase);
    return Response.json({ data: null, error: null }, { status: 200 });
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
	const supabase = await createClient();
	const { id } = await params;
	const body = await req.json().catch(() => null) as CreateTurnoInput;
	if (!body) {
		return Response.json({ data: null, error: { message: "JSON invalido", code: "validation" } }, { status: 400 });
	}
	if (!id) {
		return Response.json({ data: null, error: { message: "Falta/invalid turno id", code: "validation" } }, { status: 400 });
	}

	const input: UpdateTurnoInput = {
		id,
		titulo: body.titulo,
		taller_id: body.taller_id,
		fecha: body.fecha,
		hora: body.hora,
		duracion: body.duracion,
		vehiculo_id: body.vehiculo_id,
		cliente_id: body.cliente_id,
		tipo: body.tipo,
		estado: body.estado,
		descripcion: body.descripcion,
		observaciones: body.observaciones,
	};

	const { data: updated, error: updateError } = await turnosService.update(supabase, input);

	if (updateError) {
		const code = updateError.code || "";
		let status = 500;
		let message = updateError.message ? `Error al actualizar turno: ${updateError.message}` : "Error al actualizar turno";
		if (code === "23505") {
			status = 409;
			message = "Ya existe un turno para ese horario";
		} else if (code === "23502") {
			status = 400;
			message = `Falta un campo obligatorio`;
		} else if (code === "23503") {
			status = 400;
			message = `El cliente, vehículo o taller especificado no existe o no es válido (${updateError.message})`;
		}
		logger.error("PUT /api/turnos - error:", updateError);
		return Response.json({ data: null, error: { message, code: updateError.code, details: updateError.message } }, { status });
	}

	await statsService.onDataChanged(supabase);
	return Response.json({ data: updated, error: null }, { status: 200 });
}