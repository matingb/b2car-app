import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { OperacionDTO, OperacionLineaDTO } from "@/model/dtos";
import { logger } from "@/lib/logger";
import { ServiceError, toServiceError } from "@/app/api/serviceError";
import {
	toISODateTimeWithCurrentTime,
	validateDateRangeFilters,
	resolveDateRangeBounds,
} from "@/lib/fechas";
import { normalizePagination } from "@/lib/pagination";
import {
	type OperacionRepository,
	type OperacionDetalleRawRow,
	type OperacionVentaJoin,
	type OperacionCompraJoin,
	type ClienteJoin,
	operacionRepository,
} from "./operacionRepository";

export type {
	OperacionRepository,
	OperacionDetalleRawRow,
	OperacionVentaJoin,
	OperacionCompraJoin,
	ClienteJoin,
};

export type OperacionesFilters = {
	fecha?: string; // YYYY-MM-DD, a calendar day in the application's Buenos Aires timezone
	from?: string; // ISO instant or legacy YYYY-MM-DD
	to?: string; // exclusive ISO instant or legacy inclusive YYYY-MM-DD
	tipo?: string[];
};

export type OperacionesPagination = {
	page: number;
	pageSize: number;
};

export const OPERACIONES_PAGE_SIZE = 50;

export type OperacionesStats = {
	ventas: number;
	compras: number;
	asignaciones: number;
	cobros: number;
	gastos: number;
	neto: number;
};

export type CreateOperacionLineaInput = {
	stock_id: string;
	cantidad?: number;
	cantidad_cumplida?: number;
	monto_unitario?: number;
	delta_cantidad?: number;
};

export type CreateOperacionPagoInput = {
	cuenta_id?: string;
	cuenta_financiera_id?: string;
	monto: number;
	fecha?: string;
	descripcion?: string | null;
};

export type CreateOperacionInput = {
	tipo: string;
	taller_id: string;
	fecha?: string;
	created_at?: string;
	lineas?: CreateOperacionLineaInput[];
	arreglo_id?: string | null;
	cuenta_financiera_id?: string | null;
	pagos?: CreateOperacionPagoInput[] | null;
	idempotency_key?: string | null;
	observaciones?: string | null;
	estado_pago?: string | null;
	monto_inicial?: number | null;
	mover_stock?: boolean | null;
	proveedor_id?: string | null;
	cliente_id?: string | null;
};

export type UpdateOperacionLineaInput = {
	stock_id: string;
	cantidad?: number;
	monto_unitario?: number;
	delta_cantidad?: number;
};

export type UpdateOperacionInput = {
	tipo?: string;
	taller_id?: string;
	fecha?: string;
	created_at?: string;
	lineas?: UpdateOperacionLineaInput[];
	cuenta_financiera_id?: string | null;
	idempotency_key?: string | null;
	observaciones?: string | null;
};

export type OperacionRow = OperacionDTO & { operaciones_lineas?: OperacionLineaDTO[] | null };

/**
 * Proyección de la RPC que mezcla stock y gastos sin forzar estos últimos a
 * pertenecer a un taller. `lineas` llega como JSONB para conservar una sola
 * paginación y un orden estable.
 */
export type OperacionListRow = {
	id: string;
	tipo: string;
	taller_id: string | null;
	fecha: string;
	created_at: string;
	lineas: unknown;
	gasto_id: string | null;
	descripcion: string | null;
	categoria_gasto: string | null;
	cuenta_financiera_id: string | null;
	cuenta_financiera_nombre: string | null;
	monto: number | string | null;
	monto_total?: number | string | null;
	total_pagado?: number | string | null;
	saldo_pendiente?: number | string | null;
	esta_pago?: boolean;
	estado_pago?: string;
	estado_stock?: string;
	arreglo_id: string | null;
	factura_asociada?: boolean;
	total_count: number | string | null;
	observaciones?: string | null;
	proveedor_id?: string | null;
	proveedor_nombre?: string | null;
	cliente_id?: string | null;
	cliente_nombre?: string | null;
};

type OperacionesStatsRow = {
	ventas?: number | string | null;
	compras?: number | string | null;
	asignaciones?: number | string | null;
	cobros?: number | string | null;
	gastos?: number | string | null;
	neto?: number | string | null;
};

export const validateOperacionesDateFilters = validateDateRangeFilters;

export function createOperacionesService(
	repository: OperacionRepository = operacionRepository
) {
	return {
		async list(
			supabase: SupabaseClient,
			filters: OperacionesFilters = {},
			pagination: OperacionesPagination = { page: 1, pageSize: OPERACIONES_PAGE_SIZE }
		): Promise<{ data: OperacionListRow[]; total: number; error: ServiceError | null }> {
			const { page, pageSize } = normalizePagination(pagination, {
				defaultPageSize: OPERACIONES_PAGE_SIZE,
			});
			const { from, to } = resolveDateRangeBounds(filters);

			const { data, error } = await repository.list(supabase, {
				from,
				to,
				tipos: filters.tipo && filters.tipo.length > 0 ? filters.tipo : null,
				page,
				pageSize,
			});
			if (error) {
				logger.error("[operacionesService.list] error:", error);
				return { data: [], total: 0, error: toServiceError(error) };
			}
			const rows = (Array.isArray(data) ? data : []) as OperacionListRow[];
			const total = rows.length > 0 ? Number(rows[0]?.total_count) || 0 : 0;
			const ventaIds = rows.filter((row) => row.tipo === "VENTA").map((row) => row.id);
			if (!ventaIds.length) return { data: rows, total, error: null };

			const { data: invoices, error: invoiceError } = await repository.listFacturasByOperacionIds(
				supabase,
				ventaIds
			);
			if (invoiceError) {
				logger.error("[operacionesService.list] error al listar facturas:", invoiceError);
				return { data: [], total: 0, error: toServiceError(invoiceError) };
			}

			const invoiceOperationIds = new Set(
				(invoices ?? []).map((invoice) => String(invoice.operacion_id ?? "")).filter(Boolean)
			);
			return {
				data: rows.map((row) => ({
					...row,
					factura_asociada: row.tipo === "VENTA" && invoiceOperationIds.has(row.id),
				})),
				total,
				error: null,
			};
		},

		async getById(
			supabase: SupabaseClient,
			id: string
		): Promise<{ data: OperacionRow | null; error: ServiceError | null }> {
			const { data, error } = await repository.getById(supabase, id);

			if (error) {
				logger.error("[operacionesService.getById] error:", error);
				return { data: null, error: toServiceError(error) };
			}
			return { data, error: null };
		},

		async create(
			supabase: SupabaseClient,
			input: CreateOperacionInput
		): Promise<{ data: OperacionRow | null; error: ServiceError | null }> {
			const lineasPayload = Array.isArray(input.lineas)
				? input.lineas.map((l) => ({
						stock_id: l.stock_id,
						cantidad: l.cantidad ?? 0,
						cantidad_cumplida: l.cantidad_cumplida !== undefined ? l.cantidad_cumplida : undefined,
						monto_unitario: l.monto_unitario ?? 0,
						delta_cantidad: l.delta_cantidad ?? 0,
				  }))
				: [];

			const { data: operacionId, error: rpcError } = await repository.create(supabase, {
				p_tipo: input.tipo,
				p_taller_id: input.taller_id,
				p_lineas: lineasPayload,
				p_arreglo_id: input.arreglo_id ?? null,
				p_fecha: input.fecha ? toISODateTimeWithCurrentTime(input.fecha) : null,
				p_cuenta_id: input.cuenta_financiera_id ?? null,
				p_idempotency_key: input.idempotency_key ?? null,
				p_observaciones: input.observaciones ?? null,
				p_estado_pago: input.estado_pago ?? null,
				p_monto_inicial: input.monto_inicial ?? null,
				p_mover_stock: input.mover_stock ?? true,
				p_proveedor_id: input.proveedor_id ?? null,
				p_cliente_id: input.cliente_id ?? null,
				p_pagos: input.pagos && input.pagos.length > 0 ? input.pagos : null,
			});

			if (rpcError || !operacionId) {
				logger.error("[operacionesService.create] Error en rpc_crear_operacion_con_stock:", rpcError);
				return {
					data: null,
					error: toServiceError(rpcError ?? ({ code: "Unknown", message: "Unknown error" } as PostgrestError)),
				};
			}

			return this.getById(supabase, operacionId as string);
		},

		async confirmarStock(
			supabase: SupabaseClient,
			operacionId: string,
			fecha?: string,
			lineas?: { lineaId?: string; stockId?: string; cantidad: number }[]
		): Promise<{ data: unknown; error: ServiceError | null }> {
			const lineasPayload = Array.isArray(lineas) && lineas.length > 0
				? lineas.map((l) => ({
						linea_id: l.lineaId ?? null,
						stock_id: l.stockId ?? null,
						cantidad: l.cantidad,
				  }))
				: null;

			const { data, error } = await repository.confirmarStock(supabase, {
				p_operacion_id: operacionId,
				p_fecha: fecha ? toISODateTimeWithCurrentTime(fecha) : new Date().toISOString(),
				p_lineas: lineasPayload,
			});

			if (error) {
				logger.error("[operacionesService.confirmarStock] Error:", error);
				return { data: null, error: toServiceError(error) };
			}

			return { data, error: null };
		},

		async registrarPago(
			supabase: SupabaseClient,
			operacionId: string,
			payload: {
				cuentaId: string;
				monto: number;
				fecha?: string;
				descripcion?: string;
				idempotencyKey?: string;
			}
		): Promise<{ data: unknown; error: ServiceError | null }> {
			const { data, error } = await repository.registrarPago(supabase, {
				p_operacion_id: operacionId,
				p_cuenta_id: payload.cuentaId,
				p_monto: payload.monto,
				p_fecha: payload.fecha ? toISODateTimeWithCurrentTime(payload.fecha) : new Date().toISOString(),
				p_descripcion: payload.descripcion ?? null,
				p_idempotency_key: payload.idempotencyKey ?? null,
			});

			if (error) {
				logger.error("[operacionesService.registrarPago] Error:", error);
				return { data: null, error: toServiceError(error) };
			}

			return { data, error: null };
		},

		async update(
			supabase: SupabaseClient,
			id: string,
			input: UpdateOperacionInput
		): Promise<{ data: OperacionRow | null; error: ServiceError | null }> {
			const current = await this.getById(supabase, id);
			if (current.error || !current.data) return { data: null, error: current.error ?? ServiceError.NotFound };

			const currentLineas = Array.isArray(current.data.operaciones_lineas)
				? current.data.operaciones_lineas
				: [];
			const lineas = Array.isArray(input.lineas)
				? input.lineas
				: currentLineas;
			const lineasPayload = lineas.map((linea) => ({
				stock_id: linea.stock_id,
				cantidad: linea.cantidad ?? 0,
				monto_unitario: linea.monto_unitario ?? 0,
				delta_cantidad: linea.delta_cantidad ?? 0,
			}));
			const tipo = input.tipo ?? current.data.tipo;
			const tallerId = input.taller_id ?? current.data.taller_id;
			const rawFecha = input.fecha ?? current.data.fecha;
			const fecha = rawFecha ? toISODateTimeWithCurrentTime(rawFecha) : rawFecha;
			const esOperacionFinanciera = tipo === "COMPRA" || tipo === "VENTA";
			const cuentaFueInformada = Object.prototype.hasOwnProperty.call(input, "cuenta_financiera_id");
			let cuentaFinancieraId = input.cuenta_financiera_id ?? null;

			// Una actualización parcial conserva la cuenta del asiento vigente. Si el
			// cliente manda null explícitamente, la RPC la rechaza para COMPRA/VENTA.
			if (esOperacionFinanciera && !cuentaFueInformada) {
				const { data: movimiento, error: movimientoError } = await repository.findCuentaFinancieraByOperacionId(
					supabase,
					id
				);
				if (movimientoError) {
					logger.error("[operacionesService.update] Error obteniendo cuenta financiera:", movimientoError);
					return { data: null, error: toServiceError(movimientoError) };
				}
				cuentaFinancieraId = movimiento?.cuenta_financiera_id ?? null;
			}

			const { data: updatedId, error: rpcError } = await repository.update(supabase, {
				p_operacion_id: id,
				p_tipo: tipo,
				p_taller_id: tallerId,
				p_lineas: lineasPayload,
				p_fecha: fecha,
				p_cuenta_id: cuentaFinancieraId,
				p_idempotency_key: input.idempotency_key ?? null,
				// La RPC conserva la observación con NULL y la borra con texto vacío.
				p_observaciones: input.observaciones === undefined ? null : input.observaciones ?? "",
			});
			if (rpcError || !updatedId) {
				logger.error("[operacionesService.update] Error en rpc_actualizar_operacion_con_stock:", rpcError);
				return {
					data: null,
					error: toServiceError(rpcError ?? ({ code: "Unknown", message: "No se pudo actualizar la operación" } as PostgrestError)),
				};
			}

			return this.getById(supabase, String(updatedId));
		},

		async deleteById(
			supabase: SupabaseClient,
			id: string,
			idempotencyKey?: string | null,
		): Promise<{ error: ServiceError | null }> {
			try {
				const { data, error } = await repository.deleteById(supabase, id, idempotencyKey);
				if (error) {
					logger.error("[operacionesService.deleteById] Error en rpc_borrar_operacion_completa:", error);
					return { error: toServiceError(error) };
				}
				const deleted = Boolean(
					data && typeof data === "object" && "eliminada" in data && (data as Record<string, unknown>).eliminada
				);
				if (!deleted) {
					logger.warn("[operacionesService.deleteById] Operación no encontrada o no eliminada:", { id, data });
					return { error: ServiceError.NotFound };
				}
				return { error: null };
			} catch (err) {
				logger.error("[operacionesService.deleteById] Excepción inesperada:", err);
				return { error: ServiceError.Unknown };
			}
		},

		async stats(
			supabase: SupabaseClient,
			filters: OperacionesFilters = {}
		): Promise<{ data: OperacionesStats; error: ServiceError | null }> {
			const { from, to } = resolveDateRangeBounds(filters);
			const { data, error } = await repository.stats(supabase, {
				from,
				to,
				tipos: filters.tipo && filters.tipo.length > 0 ? filters.tipo : null,
			});
			if (error) {
				logger.error("[operacionesService.stats] Error en rpc_operaciones_stats:", error);
				return {
					data: { ventas: 0, compras: 0, asignaciones: 0, cobros: 0, gastos: 0, neto: 0 },
					error: toServiceError(error),
				};
			}

			const row = (Array.isArray(data) ? data[0] : data) as OperacionesStatsRow | null;
			return {
				data: {
					ventas: Number(row?.ventas) || 0,
					compras: Number(row?.compras) || 0,
					asignaciones: Number(row?.asignaciones) || 0,
					cobros: Number(row?.cobros) || 0,
					gastos: Number(row?.gastos) || 0,
					neto: Number(row?.neto) || 0,
				},
				error: null,
			};
		},
	};
}

export const operacionesService = createOperacionesService(operacionRepository);

