import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { Permission } from "@/lib/permissions";
import { NextRequest } from "next/server";
import { productosProveedoresService } from "@/app/api/proveedores/productosProveedoresService";

const mockRequirePermission = vi.fn();

vi.mock("@/supabase/server", () => ({
	createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/requirePermission", () => ({
	requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

vi.mock("@/app/api/proveedores/productosProveedoresService", () => ({
	productosProveedoresService: {
		listarPorProducto: vi.fn(),
	},
}));

describe("GET /api/productos/[id]/proveedores", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRequirePermission.mockResolvedValue(null);
	});

	it("dado un usuario sin permisos para ver productos, retorna 403", async () => {
		mockRequirePermission.mockResolvedValue(new Response("Unauthorized", { status: 403 }));

		const req = new NextRequest("http://localhost/api/productos/prod-1/proveedores");
		const res = await GET(req, { params: Promise.resolve({ id: "prod-1" }) });

		expect(mockRequirePermission).toHaveBeenCalledWith(Permission.ProductosView);
		expect(res.status).toBe(403);
	});

	it("retorna lista de proveedores asociados al producto llamando al servicio", async () => {
		vi.mocked(productosProveedoresService.listarPorProducto).mockResolvedValue({
			data: [
				{
					id: "pp-1",
					producto_id: "prod-1",
					proveedor_id: "prov-1",
					codigo_proveedor: "SKU-AUTO",
					costo_referencia: 3200,
					es_predeterminado: true,
					proveedor_nombre: "Distribuidora Repuestos SA",
				},
			],
			error: null,
		});

		const req = new NextRequest("http://localhost/api/productos/prod-1/proveedores");
		const res = await GET(req, { params: Promise.resolve({ id: "prod-1" }) });

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data).toHaveLength(1);
		expect(json.data[0].proveedor_nombre).toBe("Distribuidora Repuestos SA");
		expect(json.data[0].costo_referencia).toBe(3200);
		expect(json.data[0].es_predeterminado).toBe(true);
	});
});
