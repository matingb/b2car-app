import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { proveedorService } from "@/app/api/proveedores/proveedorService";
import type { ProveedorCuentaCorrienteResumen } from "@/model/dtos";
import { ServiceError } from "@/app/api/serviceError";

export type GetProveedorOperacionesResponse = {
	data: ProveedorCuentaCorrienteResumen | null;
	error?: string | null;
};

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requirePermission(Permission.ProveedoresView);
	if (authError) return authError;

	const { id } = await params;
	const supabase = await createClient();

	const { data, error } = await proveedorService.getCuentaCorriente(supabase, id);

	if (error) {
		const status = error === ServiceError.Validation ? 400 : 500;
		return Response.json(
			{ data: null, error: "Error al cargar cuenta corriente y operaciones del proveedor" } satisfies GetProveedorOperacionesResponse,
			{ status }
		);
	}

	return Response.json({ data, error: null } satisfies GetProveedorOperacionesResponse);
}
