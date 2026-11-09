import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { proveedorService } from "@/app/api/proveedores/proveedorService";
import { ServiceError } from "@/app/api/serviceError";
import { isValidUuid } from "@/lib/uuid";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { logger } from "@/lib/logger";
import type { ProveedorCuentaCorrienteResumen } from "@/model/dtos";

export type GetProveedorCuentaCorrienteResponse = {
	data: ProveedorCuentaCorrienteResumen | null;
	error?: string | null;
};

export type CreateMovimientoCuentaCorrienteProveedorResponse = {
	data: { id: string; ok: boolean } | null;
	error?: string | null;
};

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requirePermission(Permission.ProveedoresView);
	if (authError) return authError;

	const { id } = await params;
	if (!isValidUuid(id)) {
		return Response.json(
			{ data: null, error: "ID de proveedor inválido" } satisfies GetProveedorCuentaCorrienteResponse,
			{ status: 400 }
		);
	}

	const supabase = await createClient();
	const { data, error } = await proveedorService.getCuentaCorriente(supabase, id);
	if (error) {
		const errorMessage =
			typeof error === "string"
				? error
				: "message" in error
				? error.message
				: "Error al obtener cuenta corriente";
		const status = error === ServiceError.NotFound ? 404 : 500;
		return Response.json(
			{ data: null, error: errorMessage } satisfies GetProveedorCuentaCorrienteResponse,
			{ status }
		);
	}

	return Response.json({ data, error: null } satisfies GetProveedorCuentaCorrienteResponse);
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requirePermission(Permission.ProveedoresFinanzasEdit);
	if (authError) return authError;

	const { id } = await params;
	if (!isValidUuid(id)) {
		return Response.json(
			{ data: null, error: "ID de proveedor inválido" } satisfies CreateMovimientoCuentaCorrienteProveedorResponse,
			{ status: 400 }
		);
	}

	const body = await req.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return Response.json(
			{ data: null, error: "JSON inválido" } satisfies CreateMovimientoCuentaCorrienteProveedorResponse,
			{ status: 400 }
		);
	}

	const rawPagos = Array.isArray(body.pagos) ? body.pagos : null;
	let parsedPagos: Array<{ cuentaId: string; importe: number; fecha?: string; descripcion?: string; idempotencyKey?: string }> | undefined = undefined;
	let cuentaId: string | undefined = undefined;
	let importe: number | undefined = undefined;

	if (rawPagos && rawPagos.length > 0) {
		parsedPagos = [];
		for (const p of rawPagos) {
			const cId = p.cuenta_id ?? p.cuentaId;
			if (!cId || !isValidUuid(cId)) {
				return Response.json(
					{ data: null, error: "Seleccioná una cuenta financiera válida para cada movimiento" } satisfies CreateMovimientoCuentaCorrienteProveedorResponse,
					{ status: 400 }
				);
			}
			const imp = Number(p.importe);
			if (!Number.isFinite(imp) || imp === 0) {
				return Response.json(
					{ data: null, error: "El importe de cada movimiento no puede ser cero" } satisfies CreateMovimientoCuentaCorrienteProveedorResponse,
					{ status: 400 }
				);
			}
			const idem = p.idempotency_key ?? p.idempotencyKey;
			if (idem && !isValidUuid(idem)) {
				return Response.json(
					{ data: null, error: "idempotency_key inválida" } satisfies CreateMovimientoCuentaCorrienteProveedorResponse,
					{ status: 400 }
				);
			}
			parsedPagos.push({
				cuentaId: cId,
				importe: imp,
				fecha: p.fecha,
				descripcion: p.descripcion,
				idempotencyKey: idem,
			});
		}
	} else {
		cuentaId = body.cuenta_id ?? body.cuentaId;
		if (!cuentaId || !isValidUuid(cuentaId)) {
			return Response.json(
				{ data: null, error: "Seleccioná una cuenta financiera válida" } satisfies CreateMovimientoCuentaCorrienteProveedorResponse,
				{ status: 400 }
			);
		}

		importe = Number(body.importe);
		if (!Number.isFinite(importe) || importe === 0) {
			return Response.json(
				{ data: null, error: "El importe no puede ser cero" } satisfies CreateMovimientoCuentaCorrienteProveedorResponse,
				{ status: 400 }
			);
		}
	}

	const idempotencyKey = body.idempotency_key ?? body.idempotencyKey;
	if (idempotencyKey && !isValidUuid(idempotencyKey)) {
		return Response.json(
			{ data: null, error: "idempotency_key inválida" } satisfies CreateMovimientoCuentaCorrienteProveedorResponse,
			{ status: 400 }
		);
	}

	const supabase = await createClient();

	const { data, error } = await proveedorService.createMovimiento(supabase, id, {
		cuentaId,
		importe,
		fecha: body.fecha,
		descripcion: body.descripcion,
		idempotencyKey,
		observaciones: body.observaciones,
		tallerId: body.taller_id ?? body.tallerId,
		pagos: parsedPagos,
	});

	if (error) {
		logger.error("POST /api/proveedores/[id]/cuenta-corriente - error:", error);
		const status =
			error === ServiceError.NotFound
				? 404
				: error === ServiceError.Validation
				? 400
				: 500;
		return Response.json(
			{ data: null, error: error.toString() } satisfies CreateMovimientoCuentaCorrienteProveedorResponse,
			{ status }
		);
	}

	await statsService.onDataChanged(supabase);

	return Response.json(
		{ data: { id: data!, ok: true }, error: null } satisfies CreateMovimientoCuentaCorrienteProveedorResponse,
		{ status: 201 }
	);
}
