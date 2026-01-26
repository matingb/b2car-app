import { logger } from "@/lib/logger";
import type { Operacion, OperacionLinea } from "@/model/types";
import type { OperacionDTO, OperacionLineaDTO } from "@/model/dtos";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import {
	operacionesService,
	OperacionesServiceError,
	type CreateOperacionInput,
	type OperacionesFilters,
} from "@/app/api/operaciones/operacionesService";

export type CreateOperacionRequest = CreateOperacionInput;

export type GetOperacionesResponse = {
	data: Operacion[] | null;
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
		producto_id: row.producto_id,
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

export async function GET(req: Request) {
	const supabase = await createClient();
	const { searchParams } = new URL(req.url);
	const filters: OperacionesFilters = {
		fecha: searchParams.get("fecha") || undefined,
		from: searchParams.get("from") || undefined,
		to: searchParams.get("to") || undefined,
	};

	const { data, error } = await operacionesService.list(supabase, filters);
	logger.debug("GET /api/operaciones - filters:", filters, "data:", data, "error:", error);

	if (error) {
		return Response.json({ data: [], error: "Error cargando operaciones" } satisfies GetOperacionesResponse, { status: 500 });
	}

	return Response.json(
		{ data: (data ?? []).map((row) => mapOperacion(row as OperacionRow)), error: null } satisfies GetOperacionesResponse,
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
		return Response.json({ data: null, error: "Error creando operación" } satisfies CreateOperacionResponse, { status: 500 });
	}

	const operacion: Operacion = mapOperacion(data as OperacionRow);

	await statsService.onDataChanged(supabase);
	return Response.json({ data: operacion, error: null } satisfies CreateOperacionResponse, { status: 201 });
}
