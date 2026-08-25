import { logger } from "@/lib/logger";
import type { Operacion, OperacionLinea } from "@/model/types";
import type { OperacionDTO } from "@/model/dtos";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { isValidUuid } from "@/lib/uuid";
import {
	operacionesService,
	OPERACIONES_PAGE_SIZE,
	type CreateOperacionInput,
	type OperacionesFilters,
	type OperacionListRow,
} from "@/app/api/operaciones/operacionesService";

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
		monto_unitario: Number(source.monto_unitario) || 0,
		delta_cantidad: Number(source.delta_cantidad) || 0,
		created_at: String(source.created_at ?? ""),
	};
}

function mapOperacion(row: OperacionRow | OperacionListRow): Operacion {
	const rawLineas = "lineas" in row ? row.lineas : row.operaciones_lineas;
	const lineas = Array.isArray(rawLineas)
		? rawLineas.map(mapLineaFromUnknown).filter((linea): linea is OperacionLinea => Boolean(linea))
		: [];
	const movimiento = "gasto_id" in row ? row : null;
	return {
		id: String(row.id),
		tipo: row.tipo as Operacion["tipo"],
		taller_id: row.taller_id ?? null,
		fecha: String(row.fecha),
		created_at: String(row.created_at),
		lineas,
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
	const supabase = await createClient();
	const { searchParams } = new URL(req.url);
	const tipos = searchParams.getAll("tipo").filter(Boolean);
	const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
	const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
	const filters: OperacionesFilters = {
		fecha: searchParams.get("fecha") || undefined,
		from: searchParams.get("from") || undefined,
		to: searchParams.get("to") || undefined,
		tipo: tipos.length > 0 ? tipos : undefined,
	};

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
	const supabase = await createClient();

	const body: CreateOperacionRequest | null = await req.json().catch(() => null);
	if (!body) return Response.json({ data: null, error: "JSON inválido" } satisfies CreateOperacionResponse, { status: 400 });

	if (!body.tipo) return Response.json({ data: null, error: "Falta tipo" } satisfies CreateOperacionResponse, { status: 400 });
	if (!body.taller_id)
		return Response.json({ data: null, error: "Falta taller_id" } satisfies CreateOperacionResponse, { status: 400 });
	if ((body.tipo === "COMPRA" || body.tipo === "VENTA") && !body.cuenta_financiera_id) {
		return Response.json({ data: null, error: "Seleccioná una cuenta financiera" } satisfies CreateOperacionResponse, { status: 400 });
	}
	if (body.cuenta_financiera_id && !isValidUuid(body.cuenta_financiera_id)) {
		return Response.json({ data: null, error: "cuenta_financiera_id inválida" } satisfies CreateOperacionResponse, { status: 400 });
	}
	if (!body.idempotency_key || !isValidUuid(body.idempotency_key)) {
		return Response.json({ data: null, error: "idempotency_key inválida" } satisfies CreateOperacionResponse, { status: 400 });
	}

	const { data, error } = await operacionesService.create(supabase, body);
	if (error || !data) {
		logger.error("POST /api/operaciones - error:", error);
		return Response.json({ data: null, error: error?.toString() } satisfies CreateOperacionResponse, { status: 500 });
	}

	const createdRow = data as OperacionRow;
	const operacion: Operacion = mapOperacion(createdRow);

	await statsService.onDataChanged(supabase, createdRow.tenant_id);
	return Response.json({ data: operacion, error: null } satisfies CreateOperacionResponse, { status: 201 });
}
