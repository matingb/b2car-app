import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { Permission } from "@/lib/permissions";
import { NextRequest } from "next/server";
import { proveedorService } from "@/app/api/proveedores/proveedorService";

const mockRequirePermission = vi.fn();

vi.mock("@/supabase/server", () => ({
	createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/requirePermission", () => ({
	requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

vi.mock("@/app/api/proveedores/proveedorService", () => ({
	proveedorService: {
		getCuentaCorriente: vi.fn(),
	},
}));

describe("GET /api/proveedores/[id]/operaciones", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRequirePermission.mockResolvedValue(null);
	});

	it("requiere permiso ProveedoresView", async () => {
		mockRequirePermission.mockResolvedValue(new Response("Unauthorized", { status: 403 }));

		const req = new NextRequest("http://localhost/api/proveedores/prov-1/operaciones");
		const res = await GET(req, { params: Promise.resolve({ id: "prov-1" }) });

		expect(mockRequirePermission).toHaveBeenCalledWith(Permission.ProveedoresView);
		expect(res.status).toBe(403);
	});

	it("retorna operaciones y resumen de cuenta corriente llamando al servicio", async () => {
		vi.mocked(proveedorService.getCuentaCorriente).mockResolvedValue({
			data: {
				totalComprado: 15000,
				totalPagado: 9000,
				saldoAdeudado: 6000,
				operaciones: [
					{
						id: "op-1",
						tipo: "COMPRA",
						fecha: "2026-10-20T10:00:00Z",
						created_at: "2026-10-20T10:00:00Z",
						monto_total: 10000,
						total_pagado: 4000,
						saldo_pendiente: 6000,
						estado_pago: "PARCIAL",
						estado_stock: "ENTREGADO",
						observaciones: "Compra repuestos",
						taller_id: "taller-1",
						taller_nombre: "Taller Central",
					},
					{
						id: "op-2",
						tipo: "COMPRA",
						fecha: "2026-10-21T10:00:00Z",
						created_at: "2026-10-21T10:00:00Z",
						monto_total: 5000,
						total_pagado: 5000,
						saldo_pendiente: 0,
						estado_pago: "PAGADO",
						estado_stock: "ENTREGADO",
						observaciones: null,
						taller_id: "taller-1",
						taller_nombre: "Taller Central",
					},
				],
			},
			error: null,
		});

		const req = new NextRequest("http://localhost/api/proveedores/prov-1/operaciones");
		const res = await GET(req, { params: Promise.resolve({ id: "prov-1" }) });

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.operaciones).toHaveLength(2);
		expect(json.data.totalComprado).toBe(15000);
		expect(json.data.totalPagado).toBe(9000);
		expect(json.data.saldoAdeudado).toBe(6000);
		expect(json.data.operaciones[0].taller_nombre).toBe("Taller Central");
	});
});
