import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import type { MovimientoStockDTO } from "@/model/dtos";
import { movimientosStockService } from "@/app/api/stocks/movimientosStockService";
import { ServiceError } from "@/app/api/serviceError";

export type GetMovimientosStockResponse = {
	data: MovimientoStockDTO[] | null;
	error?: string | null;
};

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requirePermission(Permission.ProductosView);
	if (authError) return authError;

	const { id } = await params;
	const { searchParams } = new URL(req.url);
	const tallerId = searchParams.get("tallerId") || undefined;
	const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
	const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;

	const supabase = await createClient();

	const { data, error } = await movimientosStockService.listar(supabase, {
		productoId: id,
		tallerId,
		limit,
		offset,
	});

	if (error) {
		const status = error === ServiceError.Validation ? 400 : 500;
		return Response.json(
			{ data: null, error: "Error al cargar movimientos de stock" } satisfies GetMovimientosStockResponse,
			{ status }
		);
	}

	return Response.json({ data, error: null } satisfies GetMovimientosStockResponse);
}
