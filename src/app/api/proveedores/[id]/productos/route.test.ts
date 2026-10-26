import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
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
		listarPorProveedor: vi.fn(),
		asociar: vi.fn(),
	},
}));

describe("GET /api/proveedores/[id]/productos", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRequirePermission.mockResolvedValue(null);
	});

	it("requiere permiso ProveedoresView", async () => {
		mockRequirePermission.mockResolvedValue(new Response("Unauthorized", { status: 403 }));

		const req = new NextRequest("http://localhost/api/proveedores/prov-1/productos");
		const res = await GET(req, { params: Promise.resolve({ id: "prov-1" }) });

		expect(mockRequirePermission).toHaveBeenCalledWith(Permission.ProveedoresView);
		expect(res.status).toBe(403);
	});

	it("retorna lista de productos asociados al proveedor", async () => {
		vi.mocked(productosProveedoresService.listarPorProveedor).mockResolvedValue({
			data: [
				{
					id: "pp-1",
					producto_id: "prod-1",
					proveedor_id: "prov-1",
					codigo_proveedor: "SKU-PROV-99",
					costo_referencia: 1500,
					es_predeterminado: true,
					producto_nombre: "Pastilla de Freno",
				},
			],
			error: null,
		});

		const req = new NextRequest("http://localhost/api/proveedores/prov-1/productos");
		const res = await GET(req, { params: Promise.resolve({ id: "prov-1" }) });

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data).toHaveLength(1);
		expect(json.data[0].codigo_proveedor).toBe("SKU-PROV-99");
		expect(json.data[0].costo_referencia).toBe(1500);
		expect(json.data[0].producto_nombre).toBe("Pastilla de Freno");
	});
});

describe("POST /api/proveedores/[id]/productos", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRequirePermission.mockResolvedValue(null);
	});

	it("asocia un producto al proveedor correctamente", async () => {
		vi.mocked(productosProveedoresService.asociar).mockResolvedValue({
			data: {
				id: "pp-2",
				producto_id: "00000000-0000-0000-0000-000000000001",
				proveedor_id: "prov-1",
				codigo_proveedor: "SKU-NEW",
				costo_referencia: 2500,
				es_predeterminado: false,
				producto_nombre: "Disco de Freno",
			},
			error: null,
		});

		const body = {
			producto_id: "00000000-0000-0000-0000-000000000001",
			codigo_proveedor: "SKU-NEW",
			costo_referencia: 2500,
			es_predeterminado: false,
		};

		const req = new NextRequest("http://localhost/api/proveedores/prov-1/productos", {
			method: "POST",
			body: JSON.stringify(body),
		});

		const res = await POST(req, { params: Promise.resolve({ id: "prov-1" }) });

		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.data.costo_referencia).toBe(2500);
		expect(json.data.producto_nombre).toBe("Disco de Freno");
	});
});
