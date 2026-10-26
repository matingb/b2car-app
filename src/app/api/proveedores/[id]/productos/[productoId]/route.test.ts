import { describe, expect, it, vi, beforeEach } from "vitest";
import { DELETE, PATCH } from "./route";
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
		actualizar: vi.fn(),
		desvincular: vi.fn(),
	},
}));

describe("DELETE /api/proveedores/[id]/productos/[productoId]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRequirePermission.mockResolvedValue(null);
	});

	it("requiere permiso ProveedoresEdit", async () => {
		mockRequirePermission.mockResolvedValue(new Response("Unauthorized", { status: 403 }));

		const req = new NextRequest("http://localhost/api/proveedores/prov-1/productos/prod-1");
		const res = await DELETE(req, {
			params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001", productoId: "00000000-0000-0000-0000-000000000002" }),
		});

		expect(mockRequirePermission).toHaveBeenCalledWith(Permission.ProveedoresEdit);
		expect(res.status).toBe(403);
	});

	it("desvincula producto llamando al servicio", async () => {
		const provId = "00000000-0000-0000-0000-000000000001";
		const prodId = "00000000-0000-0000-0000-000000000002";

		vi.mocked(productosProveedoresService.desvincular).mockResolvedValue({ error: null });

		const req = new NextRequest(`http://localhost/api/proveedores/${provId}/productos/${prodId}`);
		const res = await DELETE(req, {
			params: Promise.resolve({ id: provId, productoId: prodId }),
		});

		expect(res.status).toBe(200);
		expect(productosProveedoresService.desvincular).toHaveBeenCalled();
	});
});

describe("PATCH /api/proveedores/[id]/productos/[productoId]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRequirePermission.mockResolvedValue(null);
	});

	it("actualiza vinculación llamando al servicio", async () => {
		const provId = "00000000-0000-0000-0000-000000000001";
		const prodId = "00000000-0000-0000-0000-000000000002";

		vi.mocked(productosProveedoresService.actualizar).mockResolvedValue({
			data: {
				id: "pp-1",
				proveedor_id: provId,
				producto_id: prodId,
				codigo_proveedor: "SKU-UPD",
				costo_referencia: 4000,
				es_predeterminado: true,
			},
			error: null,
		});

		const req = new NextRequest(`http://localhost/api/proveedores/${provId}/productos/${prodId}`, {
			method: "PATCH",
			body: JSON.stringify({ costo_referencia: 4000, codigo_proveedor: "SKU-UPD" }),
		});

		const res = await PATCH(req, {
			params: Promise.resolve({ id: provId, productoId: prodId }),
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.costo_referencia).toBe(4000);
		expect(productosProveedoresService.actualizar).toHaveBeenCalled();
	});
});
