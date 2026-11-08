import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requireAnyPermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { proveedorService } from "@/app/api/proveedores/proveedorService";
import { ServiceError } from "@/app/api/serviceError";
import { isValidUuid } from "@/lib/uuid";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { logger } from "@/lib/logger";
import type { SentidoMovimientoCuentaCorriente } from "@/model/types";

export type CreatePagoDirectoProveedorResponse = {
	data: { id: string; ok: boolean } | null;
	error?: string | null;
};

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requireAnyPermission([
		Permission.OperacionesEdit,
		Permission.FinanzasEdit,
	]);
	if (authError) return authError;

	const { id } = await params;
	if (!isValidUuid(id)) {
		return Response.json(
			{ data: null, error: "ID de proveedor inválido" } satisfies CreatePagoDirectoProveedorResponse,
			{ status: 400 }
		);
	}

	const body = await req.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return Response.json(
			{ data: null, error: "JSON inválido" } satisfies CreatePagoDirectoProveedorResponse,
			{ status: 400 }
		);
	}

	const rawPagos = Array.isArray(body.pagos) ? body.pagos : null;
	let parsedPagos: Array<{ cuentaId: string; monto: number; fecha?: string; descripcion?: string; idempotencyKey?: string }> | undefined = undefined;
	let cuentaId: string | undefined = undefined;
	let monto: number | undefined = undefined;

	if (rawPagos && rawPagos.length > 0) {
		parsedPagos = [];
		for (const p of rawPagos) {
			const cId = p.cuenta_id ?? p.cuentaId;
			if (!cId || !isValidUuid(cId)) {
				return Response.json(
					{ data: null, error: "Seleccioná una cuenta financiera válida para cada pago" } satisfies CreatePagoDirectoProveedorResponse,
					{ status: 400 }
				);
			}
			const m = Number(p.monto);
			if (!Number.isFinite(m) || m <= 0) {
				return Response.json(
					{ data: null, error: "El monto de cada pago debe ser mayor a 0" } satisfies CreatePagoDirectoProveedorResponse,
					{ status: 400 }
				);
			}
			const idem = p.idempotency_key ?? p.idempotencyKey;
			if (idem && !isValidUuid(idem)) {
				return Response.json(
					{ data: null, error: "idempotency_key inválida" } satisfies CreatePagoDirectoProveedorResponse,
					{ status: 400 }
				);
			}
			parsedPagos.push({
				cuentaId: cId,
				monto: m,
				fecha: p.fecha,
				descripcion: p.descripcion,
				idempotencyKey: idem,
			});
		}
	} else {
		cuentaId = body.cuenta_id ?? body.cuentaId;
		if (!cuentaId || !isValidUuid(cuentaId)) {
			return Response.json(
				{ data: null, error: "Seleccioná una cuenta financiera válida" } satisfies CreatePagoDirectoProveedorResponse,
				{ status: 400 }
			);
		}

		monto = Number(body.monto);
		if (!Number.isFinite(monto) || monto <= 0) {
			return Response.json(
				{ data: null, error: "El monto debe ser mayor a 0" } satisfies CreatePagoDirectoProveedorResponse,
				{ status: 400 }
			);
		}
	}

	const rawSentido = body.sentido ?? body.tipo;
	let sentido: SentidoMovimientoCuentaCorriente | undefined = undefined;
	if (rawSentido !== undefined && rawSentido !== null && rawSentido !== "") {
		const upper = String(rawSentido).toUpperCase();
		if (upper === "PAGO" || upper === "PAGO_PROVEEDOR") {
			sentido = "PAGO";
		} else if (upper === "COBRO" || upper === "COBRO_PROVEEDOR") {
			sentido = "COBRO";
		} else {
			return Response.json(
				{ data: null, error: "Tipo de movimiento inválido" } satisfies CreatePagoDirectoProveedorResponse,
				{ status: 400 }
			);
		}
	}

	const idempotencyKey = body.idempotency_key ?? body.idempotencyKey;
	if (idempotencyKey && !isValidUuid(idempotencyKey)) {
		return Response.json(
			{ data: null, error: "idempotency_key inválida" } satisfies CreatePagoDirectoProveedorResponse,
			{ status: 400 }
		);
	}

	const supabase = await createClient();

	const { data, error } = await proveedorService.createPagoDirecto(supabase, id, {
		...(sentido ? { sentido } : {}),
		cuentaId,
		monto,
		fecha: body.fecha,
		descripcion: body.descripcion,
		idempotencyKey,
		observaciones: body.observaciones,
		tallerId: body.taller_id ?? body.tallerId,
		pagos: parsedPagos,
	});

	if (error) {
		logger.error("POST /api/proveedores/[id]/pagos - error:", error);
		const status =
			error === ServiceError.NotFound
				? 404
				: error === ServiceError.Validation
				? 400
				: 500;
		return Response.json(
			{ data: null, error: error.toString() } satisfies CreatePagoDirectoProveedorResponse,
			{ status }
		);
	}

	await statsService.onDataChanged(supabase);

	return Response.json(
		{ data: { id: data!, ok: true }, error: null } satisfies CreatePagoDirectoProveedorResponse,
		{ status: 201 }
	);
}

