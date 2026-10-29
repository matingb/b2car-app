import { logger } from "@/lib/logger";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { operacionesService } from "@/app/api/operaciones/operacionesService";
import { ServiceError } from "@/app/api/serviceError";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { isValidUuid } from "@/lib/uuid";

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requirePermission(Permission.OperacionesEdit);
	if (authError) return authError;

	const { id } = await params;
	if (!isValidUuid(id)) {
		return Response.json({ data: null, error: "ID de operación inválido" }, { status: 400 });
	}

	const body = await req.json().catch(() => ({}));
	const supabase = await createClient();

	const { data, error } = await operacionesService.confirmarStock(
		supabase,
		id,
		body?.fecha,
		body?.lineas
	);
	if (error) {
		logger.error("POST /api/operaciones/[id]/confirmar-stock - error:", error);
		if (error === ServiceError.NotFound) {
			return Response.json({ data: null, error: "Operación no encontrada" }, { status: 404 });
		}
		if (error === ServiceError.StockInsuficiente) {
			return Response.json({ data: null, error: "Stock insuficiente" }, { status: 409 });
		}
		return Response.json({ data: null, error: error.toString() }, { status: 500 });
	}

	const { data: opData } = await operacionesService.getById(supabase, id);
	if (opData?.tenant_id) {
		await statsService.onDataChanged(supabase, opData.tenant_id);
	}

	return Response.json({ data, error: null }, { status: 200 });
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requirePermission(Permission.OperacionesEdit);
	if (authError) return authError;

	const { id } = await params;
	if (!isValidUuid(id)) {
		return Response.json({ data: null, error: "ID de operación inválido" }, { status: 400 });
	}

	const searchParams = req.nextUrl?.searchParams ?? new URL(req.url).searchParams;
	const movimientoId = searchParams.get("movimiento_id")?.trim();
	if (!movimientoId || !isValidUuid(movimientoId)) {
		return Response.json({ data: null, error: "ID de movimiento inválido" }, { status: 400 });
	}

	const supabase = await createClient();
	const { data, error } = await operacionesService.revertirStock(supabase, id, movimientoId);

	if (error) {
		logger.error("DELETE /api/operaciones/[id]/confirmar-stock - error:", error);
		if (error === ServiceError.NotFound) {
			return Response.json({ data: null, error: "Operación o movimiento no encontrado" }, { status: 404 });
		}
		if (error === ServiceError.Validation) {
			return Response.json({ data: null, error: "No se puede revertir una reversión o un movimiento ya revertido" }, { status: 400 });
		}
		if (error === ServiceError.StockInsuficiente || error === ServiceError.ReversionStockBloqueada) {
			return Response.json({ data: null, error: "Stock físico insuficiente para revertir" }, { status: 409 });
		}
		return Response.json({ data: null, error: error.toString() }, { status: 500 });
	}

	const { data: opData } = await operacionesService.getById(supabase, id);
	if (opData?.tenant_id) {
		await statsService.onDataChanged(supabase, opData.tenant_id);
	}

	return Response.json({ data, error: null }, { status: 200 });
}

