import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { Permission } from "@/lib/permissions";
import { NextRequest } from "next/server";
import { movimientosStockService } from "@/app/api/stocks/movimientosStockService";
import { ServiceError } from "@/app/api/serviceError";

const mockRequirePermission = vi.fn();

vi.mock("@/supabase/server", () => ({
	createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/requirePermission", () => ({
	requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

vi.mock("@/app/api/stocks/movimientosStockService", () => ({
	movimientosStockService: {
		listar: vi.fn(),
	},
}));

describe("GET /api/productos/[id]/movimientos", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRequirePermission.mockResolvedValue(null);
	});

	it("requiere permiso ProductosView", async () => {
		mockRequirePermission.mockResolvedValue(new Response("Unauthorized", { status: 403 }));

		const req = new NextRequest("http://localhost/api/productos/p1/movimientos");
		const res = await GET(req, { params: Promise.resolve({ id: "p1" }) });

		expect(mockRequirePermission).toHaveBeenCalledWith(Permission.ProductosView);
		expect(res.status).toBe(403);
	});

	it("llama a movimientosStockService.listar con los filtros y mapea resultados", async () => {
		const fakeRows = [
			{
				id: "m1",
				tenant_id: "t1",
				taller_id: "taller-1",
				taller_nombre: "Taller Central",
				producto_id: "prod-1",
				producto_nombre: "Filtro de Aceite",
				producto_codigo: "FA-01",
				stock_id: "stock-1",
				operacion_id: "op-1",
				operacion_tipo: "COMPRA",
				tipo_movimiento: "COMPRA",
				cantidad: 10,
				saldo_anterior: 5,
				saldo_posterior: 15,
				fecha: "2026-10-21T12:00:00Z",
				motivo: "Recepción de compra",
				created_by: "user-1",
				created_at: "2026-10-21T12:00:00Z",
			},
		];

		vi.mocked(movimientosStockService.listar).mockResolvedValue({ data: fakeRows, error: null });

		const req = new NextRequest("http://localhost/api/productos/prod-1/movimientos?tallerId=taller-1&limit=20&offset=0");
		const res = await GET(req, { params: Promise.resolve({ id: "prod-1" }) });

		expect(movimientosStockService.listar).toHaveBeenCalledWith(expect.anything(), {
			productoId: "prod-1",
			tallerId: "taller-1",
			limit: 20,
			offset: 0,
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data).toHaveLength(1);
		expect(json.data[0].tipo_movimiento).toBe("COMPRA");
		expect(json.data[0].cantidad).toBe(10);
		expect(json.data[0].saldo_posterior).toBe(15);
	});

	it("devuelve 500 si falla el servicio", async () => {
		vi.mocked(movimientosStockService.listar).mockResolvedValue({ data: [], error: ServiceError.Unknown });

		const req = new NextRequest("http://localhost/api/productos/prod-1/movimientos");
		const res = await GET(req, { params: Promise.resolve({ id: "prod-1" }) });

		expect(res.status).toBe(500);
		const json = await res.json();
		expect(json.error).toBe("Error al cargar movimientos de stock");
	});
});
