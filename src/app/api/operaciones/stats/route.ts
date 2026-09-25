import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { operacionesService, type OperacionesStats, validateOperacionesDateFilters } from "@/app/api/operaciones/operacionesService";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";

type OperacionesStatsResponse = {
	data: OperacionesStats | null;
	error?: string | null;
};

export async function GET(req: Request) {
	const authError = await requirePermission(Permission.OperacionesView);
	if (authError) return authError;

	const supabase = await createClient();
	const url = new URL(req.url);
	const tipos = url.searchParams.getAll("tipo").filter(Boolean);
	const filters = {
		fecha: url.searchParams.get("fecha") || undefined,
		from: url.searchParams.get("from") || undefined,
		to: url.searchParams.get("to") || undefined,
		tipo: tipos.length > 0 ? tipos : undefined,
	};
	const dateFilterError = validateOperacionesDateFilters(filters);
	if (dateFilterError) {
		return Response.json(
			{ data: null, error: dateFilterError } satisfies OperacionesStatsResponse,
			{ status: 400 }
		);
	}

	const { data, error } = await operacionesService.stats(supabase, filters);
	if (error) {
		logger.error("GET /api/operaciones/stats - error:", error);
		return Response.json(
			{ data: null, error: "Error cargando estadísticas" } satisfies OperacionesStatsResponse,
			{ status: 500 }
		);
	}

	return Response.json(
		{ data, error: null } satisfies OperacionesStatsResponse,
		{ status: 200 }
	);
}
