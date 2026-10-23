import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import type { ProductoProveedorDTO } from "@/model/dtos";
import { productosProveedoresService } from "@/app/api/proveedores/productosProveedoresService";
import { ServiceError } from "@/app/api/serviceError";

export type GetProductoProveedoresResponse = {
	data: ProductoProveedorDTO[] | null;
	error?: string | null;
};

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requirePermission(Permission.ProductosView);
	if (authError) return authError;

	const { id: productoId } = await params;
	const supabase = await createClient();

	const { data, error } = await productosProveedoresService.listarPorProducto(supabase, productoId);
	if (error) {
		const status = error === ServiceError.Validation ? 400 : 500;
		return Response.json(
			{ data: null, error: "Error al cargar proveedores del producto" } satisfies GetProductoProveedoresResponse,
			{ status }
		);
	}

	return Response.json({ data, error: null } satisfies GetProductoProveedoresResponse);
}
