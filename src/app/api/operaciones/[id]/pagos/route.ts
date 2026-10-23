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

	const body = await req.json().catch(() => null);
	if (!body) {
		return Response.json({ data: null, error: "JSON inválido" }, { status: 400 });
	}

	if (!body.cuenta_id || !isValidUuid(body.cuenta_id)) {
		return Response.json({ data: null, error: "Seleccioná una cuenta financiera válida" }, { status: 400 });
	}

	const monto = Number(body.monto);
	if (!Number.isFinite(monto) || monto <= 0) {
		return Response.json({ data: null, error: "El monto debe ser mayor a 0" }, { status: 400 });
	}

	if (body.idempotency_key && !isValidUuid(body.idempotency_key)) {
		return Response.json({ data: null, error: "idempotency_key inválida" }, { status: 400 });
	}

	const supabase = await createClient();

	const { data, error } = await operacionesService.registrarPago(supabase, id, {
		cuentaId: body.cuenta_id,
		monto,
		fecha: body.fecha,
		descripcion: body.descripcion,
		idempotencyKey: body.idempotency_key,
	});

	if (error) {
		logger.error("POST /api/operaciones/[id]/pagos - error:", error);
		if (error === ServiceError.NotFound) {
			return Response.json({ data: null, error: "Operación no encontrada" }, { status: 404 });
		}
		return Response.json({ data: null, error: error.toString() }, { status: 500 });
	}

	const { data: opData } = await operacionesService.getById(supabase, id);
	if (opData?.tenant_id) {
		await statsService.onDataChanged(supabase, opData.tenant_id);
	}

	return Response.json({ data, error: null }, { status: 201 });
}
