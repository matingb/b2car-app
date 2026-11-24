import { logger } from "@/lib/logger";
import type { Operacion, OperacionLinea } from "@/model/types";
import type { OperacionDTO } from "@/model/dtos";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { isValidUuid } from "@/lib/uuid";
import { ServiceError } from "@/app/api/serviceError";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { normalizePage } from "@/lib/pagination";
import { ALICUOTAS_IVA_ARCA } from "@/lib/facturacion/types";
import { calcularIvaTotalDesdeBases } from "@/lib/comprobantesRecibidos/iva";
import { sumarImportes } from "@/lib/comprobantesRecibidos/types";
import {
	operacionesService,
	validateOperacionesDateFilters,
	OPERACIONES_PAGE_SIZE,
	type CreateOperacionInput,
	type OperacionesFilters,
	type OperacionListRow,
} from "@/app/api/operaciones/operacionesService";
import { validarCargos } from "@/lib/operaciones/cargos";

export type CreateOperacionRequest = CreateOperacionInput;

export type GetOperacionesResponse = {
	data: Operacion[] | null;
	pagination: {
		page: number;
		pageSize: number;
		total: number;
	};
	error?: string | null;
};

export type CreateOperacionResponse = {
	data: Operacion | null;
	error?: string | null;
};

const IVA_ALICUOTA_IDS = new Set<number>(ALICUOTAS_IVA_ARCA.map((rate) => rate.id));

type OperacionRow = OperacionDTO & { operaciones_lineas?: unknown[] | null };

function mapLineaFromUnknown(row: unknown): OperacionLinea | null {
	if (!row || typeof row !== "object") return null;
	const source = row as Record<string, unknown>;
	const id = String(source.id ?? "");
	const operacionId = String(source.operacion_id ?? "");
	const stockId = String(source.stock_id ?? "");
	if (!id || !operacionId || !stockId) return null;
	return {
		id,
		operacion_id: operacionId,
		stock_id: stockId,
		cantidad: Number(source.cantidad) || 0,
		cantidad_cumplida:
			source.cantidad_cumplida !== undefined && source.cantidad_cumplida !== null
				? Number(source.cantidad_cumplida)
				: undefined,
		monto_unitario: Number(source.monto_unitario) || 0,
		subtotal: source.subtotal !== undefined && source.subtotal !== null ? Number(source.subtotal) : undefined,
		descuento: source.descuento !== undefined && source.descuento !== null ? Number(source.descuento) : undefined,
		total: source.total !== undefined && source.total !== null ? Number(source.total) : undefined,
		delta_cantidad: Number(source.delta_cantidad) || 0,
		iva_alicuota_id: source.iva_alicuota_id !== undefined && source.iva_alicuota_id !== null
			? Number(source.iva_alicuota_id)
			: undefined,
		created_at: String(source.created_at ?? ""),
		nombre: source.nombre ? String(source.nombre) : undefined,
		codigo: source.codigo ? String(source.codigo) : undefined,
	};
}

function mapOperacion(row: OperacionRow | OperacionListRow): Operacion {
	const rawLineas = "lineas" in row ? row.lineas : row.operaciones_lineas;
	const lineas = Array.isArray(rawLineas)
		? rawLineas.map(mapLineaFromUnknown).filter((linea): linea is OperacionLinea => Boolean(linea))
		: [];
	const movimiento = "gasto_id" in row ? row : null;
	const montoTotal = row.monto_total !== undefined && row.monto_total !== null ? Number(row.monto_total) : undefined;
	const totalPagado = row.total_pagado !== undefined && row.total_pagado !== null ? Number(row.total_pagado) : undefined;
	const saldoPendiente = row.saldo_pendiente !== undefined && row.saldo_pendiente !== null
		? Number(row.saldo_pendiente)
		: (montoTotal !== undefined && totalPagado !== undefined ? Math.max(0, montoTotal - totalPagado) : undefined);

	return {
		id: String(row.id),
		tipo: row.tipo as Operacion["tipo"],
		taller_id: row.taller_id ?? null,
		fecha: String(row.fecha),
		created_at: String(row.created_at),
		lineas,
		factura_asociada: "factura_asociada" in row && row.factura_asociada === true,
		observaciones: row.observaciones ? String(row.observaciones) : undefined,
		subtotal: row.subtotal !== undefined && row.subtotal !== null ? Number(row.subtotal) : undefined,
		descuento: row.descuento !== undefined && row.descuento !== null ? Number(row.descuento) : undefined,
		monto_total: montoTotal,
		total_pagado: totalPagado,
		saldo_pendiente: saldoPendiente,
		esta_pago: row.esta_pago !== undefined ? Boolean(row.esta_pago) : undefined,
		estado_pago: (row.estado_pago as Operacion["estado_pago"]) ?? undefined,
		estado_stock: (row.estado_stock as Operacion["estado_stock"]) ?? undefined,
		proveedor_id: "proveedor_id" in row && row.proveedor_id ? String(row.proveedor_id) : undefined,
		proveedor_nombre: "proveedor_nombre" in row && row.proveedor_nombre ? String(row.proveedor_nombre) : undefined,
		cliente_id: "cliente_id" in row && row.cliente_id ? String(row.cliente_id) : undefined,
		cliente_nombre: "cliente_nombre" in row && row.cliente_nombre ? String(row.cliente_nombre) : undefined,
		...(movimiento ? {
			gasto_id: movimiento.gasto_id ?? undefined,
			descripcion: movimiento.descripcion ?? undefined,
			categoria_gasto: movimiento.categoria_gasto ?? undefined,
			cuenta_financiera_id: movimiento.cuenta_financiera_id ?? undefined,
			cuenta_financiera_nombre: movimiento.cuenta_financiera_nombre ?? undefined,
			monto: Number(movimiento.monto) || 0,
			arreglo_id: movimiento.arreglo_id ?? undefined,
		} : {}),
	};
}

export async function GET(req: Request) {
	const authError = await requirePermission(Permission.OperacionesView);
	if (authError) return authError;

	const supabase = await createClient();
	const { searchParams } = new URL(req.url);
	const tipos = searchParams.getAll("tipo").filter(Boolean);
	const page = normalizePage(searchParams.get("page"));
	const filters: OperacionesFilters = {
		fecha: searchParams.get("fecha") || undefined,
		from: searchParams.get("from") || undefined,
		to: searchParams.get("to") || undefined,
		tipo: tipos.length > 0 ? tipos : undefined,
	};
	const dateFilterError = validateOperacionesDateFilters(filters);
	if (dateFilterError) {
		return Response.json({
			data: [],
			pagination: { page, pageSize: OPERACIONES_PAGE_SIZE, total: 0 },
			error: dateFilterError,
		} satisfies GetOperacionesResponse, { status: 400 });
	}

	const { data, total, error } = await operacionesService.list(supabase, filters, {
		page,
		pageSize: OPERACIONES_PAGE_SIZE,
	});
	logger.debug("GET /api/operaciones - filters:", filters, "page:", page, "total:", total, "error:", error);

	if (error) {
		return Response.json({
			data: [],
			pagination: { page, pageSize: OPERACIONES_PAGE_SIZE, total: 0 },
			error: "Error cargando operaciones",
		} satisfies GetOperacionesResponse, { status: 500 });
	}

	return Response.json(
		{
			data: (data ?? []).map((row) => mapOperacion(row as OperacionListRow)),
			pagination: { page, pageSize: OPERACIONES_PAGE_SIZE, total },
			error: null,
		} satisfies GetOperacionesResponse,
		{ status: 200 }
	);
}

export async function POST(req: Request) {
	const authError = await requirePermission(Permission.OperacionesEdit);
	if (authError) return authError;

	const supabase = await createClient();

	const body: CreateOperacionRequest | null = await req.json().catch(() => null);
	if (!body) return Response.json({ data: null, error: "JSON inválido" } satisfies CreateOperacionResponse, { status: 400 });

	if (!body.tipo) return Response.json({ data: null, error: "Falta tipo" } satisfies CreateOperacionResponse, { status: 400 });
	if (body.precios_incluyen_iva !== undefined && typeof body.precios_incluyen_iva !== "boolean") {
		return Response.json({ data: null, error: "La modalidad de precios con IVA no es válida" } satisfies CreateOperacionResponse, { status: 400 });
	}
	if (body.precios_incluyen_iva === false && body.tipo !== "COMPRA") {
		return Response.json({ data: null, error: "Solo las compras admiten precios netos con IVA a sumar" } satisfies CreateOperacionResponse, { status: 400 });
	}
	const lineasConAlicuotaInvalida = Array.isArray(body.lineas)
		&& body.lineas.some((linea) => linea.iva_alicuota_id != null && !IVA_ALICUOTA_IDS.has(linea.iva_alicuota_id));
	if (lineasConAlicuotaInvalida) {
		return Response.json({ data: null, error: "La alícuota de IVA de una línea no es válida" } satisfies CreateOperacionResponse, { status: 400 });
	}
	if (body.tipo !== "GASTO" && !body.taller_id) {
		return Response.json({ data: null, error: "Falta taller_id" } satisfies CreateOperacionResponse, { status: 400 });
	}
	const cargos = Array.isArray(body.cargos) ? body.cargos : [];
	if (cargos.length > 0) {
		if (body.tipo !== "COMPRA") {
			return Response.json({ data: null, error: "Solo las compras admiten percepciones" } satisfies CreateOperacionResponse, { status: 400 });
		}
		const cargosError = validarCargos(cargos);
		if (cargosError) return Response.json({ data: null, error: cargosError } satisfies CreateOperacionResponse, { status: 400 });
	}
	// IVA calculado de factura A y percepciones forman parte del total usado para validar pagos.
	let ivaCompra = 0;
	if (body.tipo === "COMPRA" && body.precios_incluyen_iva === false) {
		try {
			ivaCompra = calcularIvaTotalDesdeBases((body.lineas ?? []).map((linea, index) => ({
				key: String(index),
				importe: (Number(linea.cantidad) || 0) * (Number(linea.monto_unitario) || 0),
				ivaAlicuotaId: linea.iva_alicuota_id ?? 5,
			})));
		} catch {
			return Response.json({ data: null, error: "No se pudo calcular el IVA de la compra" } satisfies CreateOperacionResponse, { status: 400 });
		}
	}
	const importeLineas = (body.lineas ?? []).reduce(
		(sum, l) => sum + (Number(l.cantidad) || 0) * (Number(l.monto_unitario) || 0),
		0
	);
	const importeTotal = body.tipo === "GASTO"
		? (Number(body.monto) || 0)
		: sumarImportes([importeLineas, ivaCompra, ...cargos.map((cargo) => Number(cargo.importe) || 0)]);
	if (body.tipo === "GASTO" && (!body.categoria_gasto || !body.categoria_gasto.trim())) {
		return Response.json({ data: null, error: "Falta categoria_gasto" } satisfies CreateOperacionResponse, { status: 400 });
	}
	if (body.tipo === "GASTO" && importeTotal <= 0) {
		return Response.json({ data: null, error: "El monto del gasto debe ser mayor a 0" } satisfies CreateOperacionResponse, { status: 400 });
	}
	const esOperacionComercial = body.tipo === "COMPRA" || body.tipo === "VENTA" || body.tipo === "GASTO";
	const estadoPago = body.estado_pago ?? "PAGADO";
	const tienePagos = Array.isArray(body.pagos) && body.pagos.length > 0;
	const requiereCuentaFinanciera = esOperacionComercial && importeTotal > 0 && estadoPago !== "PENDIENTE" && !tienePagos;

	if (requiereCuentaFinanciera && !body.cuenta_financiera_id) {
		return Response.json({ data: null, error: "Seleccioná una cuenta financiera" } satisfies CreateOperacionResponse, { status: 400 });
	}
	if (tienePagos) {
		for (const p of body.pagos!) {
			if (!p.cuenta_id || !isValidUuid(p.cuenta_id)) {
				return Response.json({ data: null, error: "cuenta_financiera_id inválida en pagos" } satisfies CreateOperacionResponse, { status: 400 });
			}
			if (typeof p.monto !== "number" || p.monto <= 0) {
				return Response.json({ data: null, error: "monto inválido en pagos" } satisfies CreateOperacionResponse, { status: 400 });
			}
		}
		const totalPagosIniciales = sumarImportes(body.pagos!.map((p) => p.monto));
		if (totalPagosIniciales > importeTotal) {
			return Response.json({ data: null, error: "Los pagos iniciales no pueden superar el total de la operación" } satisfies CreateOperacionResponse, { status: 400 });
		}
	}
	if (body.monto_inicial !== undefined && body.monto_inicial !== null) {
		if (typeof body.monto_inicial !== "number" || !Number.isFinite(body.monto_inicial) || body.monto_inicial < 0) {
			return Response.json({ data: null, error: "El monto inicial no es válido" } satisfies CreateOperacionResponse, { status: 400 });
		}
		if (body.monto_inicial > importeTotal) {
			return Response.json({ data: null, error: "El monto inicial no puede superar el total de la operación" } satisfies CreateOperacionResponse, { status: 400 });
		}
	}
	if (esOperacionComercial && estadoPago === "PARCIAL" && !tienePagos) {
		const montoInicial = Number(body.monto_inicial);
		if (!Number.isFinite(montoInicial) || montoInicial <= 0) {
			return Response.json({ data: null, error: "El monto inicial debe ser mayor a 0 para pagos parciales" } satisfies CreateOperacionResponse, { status: 400 });
		}
		if (montoInicial >= importeTotal) {
			return Response.json({ data: null, error: "El monto parcial debe ser menor al importe total" } satisfies CreateOperacionResponse, { status: 400 });
		}
	}
	if (body.cuenta_financiera_id && !isValidUuid(body.cuenta_financiera_id)) {
		return Response.json({ data: null, error: "cuenta_financiera_id inválida" } satisfies CreateOperacionResponse, { status: 400 });
	}
	if (body.cliente_id && !isValidUuid(body.cliente_id)) {
		return Response.json({ data: null, error: "cliente_id inválida" } satisfies CreateOperacionResponse, { status: 400 });
	}
	if (body.proveedor_id && !isValidUuid(body.proveedor_id)) {
		return Response.json({ data: null, error: "proveedor_id inválida" } satisfies CreateOperacionResponse, { status: 400 });
	}
	if (body.taller_id && !isValidUuid(body.taller_id)) {
		return Response.json({ data: null, error: "taller_id inválida" } satisfies CreateOperacionResponse, { status: 400 });
	}
	if (!body.idempotency_key || !isValidUuid(body.idempotency_key)) {
		return Response.json({ data: null, error: "idempotency_key inválida" } satisfies CreateOperacionResponse, { status: 400 });
	}

	const { data, error } = await operacionesService.create(supabase, body);
	if (error || !data) {
		logger.error("POST /api/operaciones - error:", error);
		if (error === ServiceError.StockInsuficiente) {
			return Response.json({ data: null, error: "Stock insuficiente" } satisfies CreateOperacionResponse, { status: 409 });
		}
		return Response.json({ data: null, error: error?.toString() } satisfies CreateOperacionResponse, { status: 500 });
	}

	const createdRow = data as OperacionRow;
	const operacion: Operacion = mapOperacion(createdRow);

	await statsService.onDataChanged(supabase, createdRow.tenant_id);
	return Response.json({ data: operacion, error: null } satisfies CreateOperacionResponse, { status: 201 });
}
