import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET, PUT, DELETE } from "./route";
import { ServiceError } from "@/app/api/serviceError";

vi.mock("@/supabase/server", () => ({
	createClient: vi.fn(),
}));

vi.mock("@/lib/requirePermission", () => ({
	requirePermission: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
	statsService: {
		onDataChanged: vi.fn(),
	},
}));

vi.mock("../operacionesService", async () => {
	const actual = await vi.importActual<typeof import("../operacionesService")>("../operacionesService");
	return {
		...actual,
		operacionesService: {
			...actual.operacionesService,
			update: vi.fn(),
			getById: vi.fn(),
			deleteById: vi.fn(),
		},
	};
});

import { createClient } from "@/supabase/server";
import { operacionesService } from "../operacionesService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

describe("/api/operaciones/[id]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createClient).mockResolvedValue({} as unknown as SupabaseClient);
	});

	it("PUT rechaza arreglo_id con 400", async () => {
		const req = new NextRequest("http://localhost/api/operaciones/op-1", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ arreglo_id: "a1" }),
		});

		const res = await PUT(req, { params: Promise.resolve({ id: "op-1" }) });
		const body = await res.json();

		expect(res.status).toBe(400);
		expect(body.error).toContain("arreglo_id");
		expect(vi.mocked(operacionesService.update)).not.toHaveBeenCalled();
	});

	it("PUT actualiza una operación sin tocar el arreglo", async () => {
		vi.mocked(operacionesService.update).mockResolvedValue({
			data: {
				id: "op-1",
				tenant_id: "TEN-1",
				tipo: "VENTA",
				taller_id: "t1",
				fecha: new Date().toISOString(),
				created_at: new Date().toISOString(),
				operaciones_lineas: [],
			},
			error: null,
		} as Awaited<ReturnType<typeof operacionesService.update>>);

		const req = new NextRequest("http://localhost/api/operaciones/op-1", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				tipo: "VENTA",
				idempotency_key: "00000000-0000-4000-8000-000000000001",
			}),
		});

		const res = await PUT(req, { params: Promise.resolve({ id: "op-1" }) });

		expect(res.status).toBe(200);
		expect(vi.mocked(operacionesService.update)).toHaveBeenCalledWith(expect.anything(), "op-1", {
			tipo: "VENTA",
			idempotency_key: "00000000-0000-4000-8000-000000000001",
		});
		expect(statsService.onDataChanged).toHaveBeenCalledWith(expect.anything(), "TEN-1");
	});

	it("DELETE devuelve 409 y mensaje claro cuando falla por movimientos financieros inmutables", async () => {
		vi.mocked(operacionesService.getById).mockResolvedValue({
			data: {
				id: "op-1",
				tenant_id: "TEN-1",
				tipo: "VENTA",
				taller_id: "t1",
				fecha: new Date().toISOString(),
				created_at: new Date().toISOString(),
			},
			error: null,
		});
		vi.mocked(operacionesService.deleteById).mockResolvedValue({
			error: ServiceError.MovimientoFinancieroInmutable,
		});

		const req = new NextRequest("http://localhost/api/operaciones/op-1", {
			method: "DELETE",
			headers: { "x-idempotency-key": "00000000-0000-4000-8000-000000000001" },
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "op-1" }) });
		const body = await res.json();

		expect(res.status).toBe(409);
		expect(body.error).toBe("Los movimientos financieros registrados no se pueden modificar ni eliminar");
	});

	it("DELETE devuelve 409 cuando el stock es insuficiente", async () => {
		vi.mocked(operacionesService.getById).mockResolvedValue({
			data: {
				id: "op-1",
				tenant_id: "TEN-1",
				tipo: "COMPRA",
				taller_id: "t1",
				fecha: new Date().toISOString(),
				created_at: new Date().toISOString(),
			},
			error: null,
		});
		vi.mocked(operacionesService.deleteById).mockResolvedValue({
			error: ServiceError.StockInsuficiente,
		});

		const req = new NextRequest("http://localhost/api/operaciones/op-1", {
			method: "DELETE",
			headers: { "x-idempotency-key": "00000000-0000-4000-8000-000000000001" },
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "op-1" }) });
		const body = await res.json();

		expect(res.status).toBe(409);
		expect(body.error).toBe("Stock insuficiente");
	});

	it("GET devuelve operacion con saldo_pendiente calculado cuando falta en el row", async () => {
		vi.mocked(operacionesService.getById).mockResolvedValue({
			data: {
				id: "op-1",
				tenant_id: "TEN-1",
				tipo: "VENTA",
				taller_id: "t1",
				fecha: new Date().toISOString(),
				created_at: new Date().toISOString(),
				monto_total: 10000,
				total_pagado: 4000,
				saldo_pendiente: undefined,
				operaciones_lineas: [],
			},
			error: null,
		});

		const req = new NextRequest("http://localhost/api/operaciones/op-1", {
			method: "GET",
		});

		const res = await GET(req, { params: Promise.resolve({ id: "op-1" }) });
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.data.saldo_pendiente).toBe(6000);
		expect(body.data.monto_total).toBe(10000);
		expect(body.data.total_pagado).toBe(4000);
	});
});
