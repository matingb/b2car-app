import { logger } from "@/lib/logger";
import type { Operacion, OperacionLinea } from "@/model/types";
import type { OperacionDTO, OperacionLineaDTO } from "@/model/dtos";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import {
	operacionesService,
	OPERACIONES_PAGE_SIZE,
	type CreateOperacionInput,
	type OperacionesFilters,
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
		fecha: row.fecha,
		created_at: row.created_at,
		lineas: lineas.map(mapLinea),
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
			data: (data ?? []).map((row) => mapOperacion(row as OperacionRow)),
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
