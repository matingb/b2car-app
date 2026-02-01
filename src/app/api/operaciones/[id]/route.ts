import { logger } from "@/lib/logger";
import type { Operacion, OperacionLinea } from "@/model/types";
import type { OperacionDTO, OperacionLineaDTO } from "@/model/dtos";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import {
	operacionesService,
	type UpdateOperacionInput,
} from "@/app/api/operaciones/operacionesService";
import { ServiceError } from "@/app/api/serviceError";

export type UpdateOperacionRequest = UpdateOperacionInput;

export type GetOperacionByIdResponse = {
	data: Operacion | null;
	error?: string | null;
};

export type UpdateOperacionResponse = {
	data: Operacion | null;
	error?: string | null;
};

type OperacionRow = OperacionDTO & { operaciones_lineas?: OperacionLineaDTO[] | null };

function mapLinea(row: OperacionLineaDTO): OperacionLinea {
	return {
		id: row.id,
		operacion_id: row.operacion_id,
		stock_id: row.stock_id,
		cantidad: Number(row.cantidad) || 0,
		monto_unitario: Number(row.monto_unitario) || 0,
		delta_cantidad: Number(row.delta_cantidad) || 0,
		created_at: row.created_at,
	};
}

function mapOperacion(row: OperacionRow): Operacion {
	const lineas = Array.isArray(row.operaciones_lineas) ? row.operaciones_lineas : [];
	return {
		id: row.id,
		tipo: row.tipo,
		taller_id: row.taller_id,
		created_at: row.created_at,
		lineas: lineas.map(mapLinea),
	};
}

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const supabase = await createClient();
	const { id } = await params;

	const { data, error } = await operacionesService.getById(supabase, id);
	if (error) {
		const status = error === ServiceError.NotFound ? 404 : 500;
		const message = status === 404 ? "Operación no encontrada" : "Error cargando operación";
		return Response.json({ data: null, error: message } satisfies GetOperacionByIdResponse, { status });
	}

	return Response.json({ data: mapOperacion(data as OperacionRow), error: null } satisfies GetOperacionByIdResponse, { status: 200 });
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const supabase = await createClient();
	const { id } = await params;

	const payload: UpdateOperacionRequest | null = await req.json().catch(() => null);
	if (!payload)
		return Response.json({ data: null, error: "JSON inválido" } satisfies UpdateOperacionResponse, { status: 400 });

	const { data: updated, error } = await operacionesService.update(supabase, id, payload);
	if (error || !updated) {
		logger.error("PUT /api/operaciones/[id] - error:", error);
		const status = error === ServiceError.NotFound ? 404 : 500;
		const message = status === 404 ? "Operación no encontrada" : "Error actualizando operación";
		return Response.json({ data: null, error: message } satisfies UpdateOperacionResponse, { status });
	}

	await statsService.onDataChanged(supabase);
	return Response.json({ data: mapOperacion(updated as OperacionRow), error: null } satisfies UpdateOperacionResponse, { status: 200 });
}

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const supabase = await createClient();
	const { id } = await params;

	const { error } = await operacionesService.deleteById(supabase, id);
	if (error) {
		const status = error === ServiceError.NotFound ? 404 : 500;
		const message = status === 404 ? "Operación no encontrada" : "Error eliminando operación";
		return Response.json({ error: message }, { status });
	}

	await statsService.onDataChanged(supabase);
	return Response.json({ error: null }, { status: 200 });
}
