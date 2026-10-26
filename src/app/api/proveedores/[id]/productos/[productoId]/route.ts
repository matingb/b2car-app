import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import {
	productosProveedoresService,
	type ActualizarProductoVinculadoInput,
} from "@/app/api/proveedores/productosProveedoresService";
import { ServiceError } from "@/app/api/serviceError";

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string; productoId: string }> }
) {
	const authError = await requirePermission(Permission.ProveedoresEdit);
	if (authError) return authError;

	const { id: proveedorId, productoId } = await params;
	const supabase = await createClient();

	const { error } = await productosProveedoresService.desvincular(supabase, proveedorId, productoId);

	if (error) {
		const status = error === ServiceError.Validation ? 400 : error === ServiceError.NotFound ? 404 : 500;
		return Response.json({ data: null, error: "Error al desvincular producto" }, { status });
	}

	return Response.json({ data: { ok: true }, error: null });
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string; productoId: string }> }
) {
	const authError = await requirePermission(Permission.ProveedoresEdit);
	if (authError) return authError;

	const { id: proveedorId, productoId } = await params;

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return Response.json({ data: null, error: "Cuerpo JSON inválido" }, { status: 400 });
	}

	if (!body || typeof body !== "object") {
		return Response.json({ data: null, error: "Cuerpo JSON inválido" }, { status: 400 });
	}

	const b = body as ActualizarProductoVinculadoInput;
	const supabase = await createClient();

	const { data, error } = await productosProveedoresService.actualizar(
		supabase,
		proveedorId,
		productoId,
		{
			codigo_proveedor: b.codigo_proveedor,
			costo_referencia: b.costo_referencia,
			es_predeterminado: b.es_predeterminado,
		}
	);

	if (error) {
		const status = error === ServiceError.Validation ? 400 : error === ServiceError.NotFound ? 404 : 500;
		return Response.json({ data: null, error: "Error al actualizar vinculación" }, { status });
	}

	return Response.json({ data, error: null });
}
