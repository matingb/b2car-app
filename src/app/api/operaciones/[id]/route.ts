import { logger } from "@/lib/logger";
import type { Operacion, OperacionLinea, OperacionMovimientoStock, OperacionPago } from "@/model/types";
import type { OperacionDTO, OperacionLineaDTO, OperacionMovimientoStockDTO, OperacionPagoDTO } from "@/model/dtos";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import {
	operacionesService,
	type UpdateOperacionInput,
} from "@/app/api/operaciones/operacionesService";
import { ServiceError } from "@/app/api/serviceError";
import { isValidUuid } from "@/lib/uuid";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";

export type UpdateOperacionRequest = UpdateOperacionInput;

export type GetOperacionByIdResponse = {
	data: Operacion | null;
	error?: string | null;
};

export type UpdateOperacionResponse = {
	data: Operacion | null;
	error?: string | null;
};

type OperacionRow = OperacionDTO & {
	operaciones_lineas?: OperacionLineaDTO[] | null;
	operaciones_pagos?: OperacionPagoDTO[] | null;
	movimientos_stock?: OperacionMovimientoStockDTO[] | null;
};

function mapLinea(row: OperacionLineaDTO): OperacionLinea {
	return {
		id: row.id,
		operacion_id: row.operacion_id,
		stock_id: row.stock_id,
		cantidad: Number(row.cantidad) || 0,
		cantidad_cumplida:
			row.cantidad_cumplida !== undefined && row.cantidad_cumplida !== null
				? Number(row.cantidad_cumplida)
				: undefined,
		monto_unitario: Number(row.monto_unitario) || 0,
		delta_cantidad: Number(row.delta_cantidad) || 0,
		created_at: row.created_at,
		nombre: row.nombre ? String(row.nombre) : undefined,
		codigo: row.codigo ? String(row.codigo) : undefined,
	};
}

function mapPago(row: OperacionPagoDTO): OperacionPago {
	return {
		id: row.id,
		tenant_id: row.tenant_id,
		operacion_id: row.operacion_id,
		cuenta_financiera_id: row.cuenta_financiera_id,
		monto: Number(row.monto) || 0,
		fecha: row.fecha,
		descripcion: row.descripcion ?? undefined,
		created_at: row.created_at,
		cuenta_financiera_nombre: row.cuenta_financiera_nombre ?? undefined,
	};
}

function mapMovimientoStock(row: OperacionMovimientoStockDTO): OperacionMovimientoStock {
	return {
		id: row.id,
		fecha: row.fecha,
		cantidad: Number(row.cantidad) || 0,
		saldo_anterior: Number(row.saldo_anterior) || 0,
		saldo_posterior: Number(row.saldo_posterior) || 0,
		motivo: row.motivo ?? undefined,
		created_at: row.created_at,
		created_by: row.created_by ?? undefined,
		producto_id: row.producto_id,
		stock_id: row.stock_id,
		producto_nombre: row.producto_nombre ?? undefined,
		producto_codigo: row.producto_codigo ?? undefined,
	};
}

function mapOperacion(row: OperacionRow): Operacion {
	const lineas = Array.isArray(row.operaciones_lineas) ? row.operaciones_lineas : [];
	const pagos = Array.isArray(row.operaciones_pagos) ? row.operaciones_pagos : [];
	const lineasMapped = lineas.map(mapLinea);
	const lineasTotal = lineasMapped.reduce(
		(acc, l) => acc + (l.cantidad || 0) * (l.monto_unitario || 0),
		0
	);
	const montoTotal =
		row.monto_total !== undefined && row.monto_total !== null
			? Number(row.monto_total)
			: (lineasMapped.length > 0 ? lineasTotal : undefined);
	const totalPagado =
		row.total_pagado !== undefined && row.total_pagado !== null
			? Number(row.total_pagado)
			: (row.esta_pago && montoTotal !== undefined ? montoTotal : 0);
	const saldoPendiente =
		row.saldo_pendiente !== undefined && row.saldo_pendiente !== null
			? Number(row.saldo_pendiente)
			: (montoTotal !== undefined && totalPagado !== undefined
				? Math.max(0, montoTotal - totalPagado)
				: undefined);

	return {
		id: row.id,
		tipo: row.tipo,
		taller_id: row.taller_id,
		fecha: row.fecha,
		created_at: row.created_at,
		observaciones: row.observaciones ? String(row.observaciones) : undefined,
		monto_total: montoTotal,
		total_pagado: totalPagado,
		saldo_pendiente: saldoPendiente,
		esta_pago: row.esta_pago !== undefined ? Boolean(row.esta_pago) : undefined,
		estado_pago: (row.estado_pago as Operacion["estado_pago"]) ?? undefined,
		estado_stock: (row.estado_stock as Operacion["estado_stock"]) ?? undefined,
		proveedor_id: row.proveedor_id ?? undefined,
		proveedor_nombre: row.proveedor_nombre ?? undefined,
		cliente_id: row.cliente_id ?? undefined,
		cliente_nombre: row.cliente_nombre ?? undefined,
		lineas: lineasMapped,
		pagos: pagos.map(mapPago),
		movimientos_stock: Array.isArray(row.movimientos_stock)
			? row.movimientos_stock.map(mapMovimientoStock)
			: undefined,
	};
}

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requirePermission(Permission.OperacionesView);
	if (authError) return authError;

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
	const authError = await requirePermission(Permission.OperacionesEdit);
	if (authError) return authError;

	const supabase = await createClient();
	const { id } = await params;

	const payload: UpdateOperacionRequest | null = await req.json().catch(() => null);
	if (!payload)
		return Response.json({ data: null, error: "JSON inválido" } satisfies UpdateOperacionResponse, { status: 400 });
	if (Object.prototype.hasOwnProperty.call(payload, "arreglo_id")) {
		return Response.json(
			{ data: null, error: "arreglo_id no se puede modificar en una operación existente" } satisfies UpdateOperacionResponse,
			{ status: 400 }
		);
	}
	if (payload.cuenta_financiera_id && !isValidUuid(payload.cuenta_financiera_id)) {
		return Response.json(
			{ data: null, error: "cuenta_financiera_id inválida" } satisfies UpdateOperacionResponse,
			{ status: 400 }
		);
	}
	if (!payload.idempotency_key || !isValidUuid(payload.idempotency_key)) {
		return Response.json(
			{ data: null, error: "idempotency_key inválida" } satisfies UpdateOperacionResponse,
			{ status: 400 }
		);
	}

	const { data: updated, error } = await operacionesService.update(supabase, id, payload);
	if (error || !updated) {
		logger.error("PUT /api/operaciones/[id] - error:", error);
		const status = error === ServiceError.NotFound ? 404 : 500;
		const message = status === 404 ? "Operación no encontrada" : "Error actualizando operación";
		return Response.json({ data: null, error: message } satisfies UpdateOperacionResponse, { status });
	}

	const updatedRow = updated as OperacionRow;
	const updatedOperacion = mapOperacion(updatedRow);
	await statsService.onDataChanged(supabase, updatedRow.tenant_id);
	return Response.json({ data: updatedOperacion, error: null } satisfies UpdateOperacionResponse, { status: 200 });
}

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requirePermission(Permission.OperacionesEdit);
	if (authError) return authError;

	try {
		const supabase = await createClient();
		const { id } = await params;
		const idempotencyKey = _req.headers.get("x-idempotency-key")?.trim() ?? "";
		if (!isValidUuid(idempotencyKey)) {
			return Response.json({ error: "X-Idempotency-Key inválida" }, { status: 400 });
		}

		const { data: currentOperacion, error: currentError } = await operacionesService.getById(supabase, id);
		if (currentError || !currentOperacion) {
			const status = currentError === ServiceError.NotFound ? 404 : 500;
			const message = status === 404 ? "Operación no encontrada" : "Error eliminando operación";
			return Response.json({ error: message }, { status });
		}

		const { error } = await operacionesService.deleteById(supabase, id, idempotencyKey);
		if (error) {
			logger.error("DELETE /api/operaciones/[id] - error:", error);
			let status = 500;
			let message = "Error eliminando operación";
			switch (error) {
				case ServiceError.NotFound:
					status = 404;
					message = "Operación no encontrada";
					break;
				case ServiceError.StockInsuficiente:
					status = 409;
					message = "Stock insuficiente";
					break;
				case ServiceError.MovimientoFinancieroInmutable:
					status = 409;
					message = "Los movimientos financieros registrados no se pueden modificar ni eliminar";
					break;
				case ServiceError.EnUso:
					status = 409;
					message = "La operación tiene documentos asociados (por ejemplo, remitos) y no se puede eliminar";
					break;
				default:
					break;
			}
			return Response.json({ error: message }, { status });
		}

		await statsService.onDataChanged(
			supabase,
			(currentOperacion as OperacionRow).tenant_id
		);
		return Response.json({ error: null }, { status: 200 });
	} catch (err) {
		logger.error("DELETE /api/operaciones/[id] - error inesperado:", err);
		return Response.json({ error: "Error eliminando operación" }, { status: 500 });
	}
}
