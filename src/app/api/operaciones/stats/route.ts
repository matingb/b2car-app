import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { operacionesService, type OperacionesStats } from "@/app/api/operaciones/operacionesService";

type OperacionesStatsResponse = {
	data: OperacionesStats | null;
	error?: string | null;
};

export async function GET(req: Request) {
	const supabase = await createClient();
	const url = new URL(req.url);
	const filters = {
		fecha: url.searchParams.get("fecha") || undefined,
		from: url.searchParams.get("from") || undefined,
		to: url.searchParams.get("to") || undefined,
	};

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
