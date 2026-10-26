import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import type { ProductoProveedorDTO } from "@/model/dtos";
import { productosProveedoresService } from "@/app/api/proveedores/productosProveedoresService";
import { ServiceError } from "@/app/api/serviceError";

export type GetProveedorProductosResponse = {
	data: ProductoProveedorDTO[] | null;
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

	const { data, error } = await productosProveedoresService.listarPorProveedor(supabase, id);
	if (error) {
		const status = error === ServiceError.Validation ? 400 : 500;
		return Response.json(
			{ data: null, error: "Error al cargar productos del proveedor" } satisfies GetProveedorProductosResponse,
			{ status }
		);
	}

	return Response.json({ data, error: null } satisfies GetProveedorProductosResponse);
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const authError = await requirePermission(Permission.ProveedoresEdit);
	if (authError) return authError;

	const { id: proveedorId } = await params;

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return Response.json({ data: null, error: "Cuerpo JSON inválido" }, { status: 400 });
	}

	if (!body || typeof body !== "object") {
		return Response.json({ data: null, error: "Cuerpo JSON inválido" }, { status: 400 });
	}

	const b = body as Record<string, unknown>;
	const supabase = await createClient();

	const { data, error } = await productosProveedoresService.asociar(supabase, {
		proveedor_id: proveedorId,
		producto_id: String(b.producto_id ?? ""),
		codigo_proveedor: b.codigo_proveedor ? String(b.codigo_proveedor) : null,
		costo_referencia: b.costo_referencia !== undefined ? Number(b.costo_referencia) : 0,
		es_predeterminado: Boolean(b.es_predeterminado),
	});

	if (error) {
		const status = error === ServiceError.Validation ? 400 : 500;
		return Response.json({ data: null, error: "Error al asociar producto al proveedor" }, { status });
	}

	return Response.json({ data, error: null }, { status: 201 });
}
