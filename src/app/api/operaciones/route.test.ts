import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/supabase/server", () => ({
	createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
	statsService: {
		onDataChanged: vi.fn(),
	},
}));

vi.mock("./operacionesService", () => ({
	OPERACIONES_PAGE_SIZE: 50,
	operacionesService: {
		list: vi.fn(),
		create: vi.fn(),
	},
}));

import { createClient } from "@/supabase/server";
import { ServiceError } from "@/app/api/serviceError";
import { operacionesService } from "./operacionesService";
import { GET, POST } from "./route";

describe("GET /api/operaciones", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createClient).mockResolvedValue({} as unknown as SupabaseClient);
	});

	it("limita la consulta a 50 operaciones y conserva el total para paginar", async () => {
		vi.mocked(operacionesService.list).mockResolvedValue({
			data: [{
				id: "op-2",
				tipo: "VENTA",
				taller_id: "taller-1",
				fecha: "2026-07-15T00:00:00.000Z",
				created_at: "2026-07-15T00:00:00.000Z",
				lineas: [],
				gasto_id: null,
				descripcion: null,
				categoria_gasto: null,
				cuenta_financiera_id: null,
				cuenta_financiera_nombre: null,
				monto: null,
				arreglo_id: null,
				total_count: 83,
			}],
			total: 83,
			error: null,
		} as Awaited<ReturnType<typeof operacionesService.list>>);

		const response = await GET(new Request(
			"http://localhost/api/operaciones?from=2026-07-01T00%3A00%3A00.000Z&to=2026-08-01T00%3A00%3A00.000Z&page=2&tipo=VENTA"
		));
		const body = await response.json();

		expect(operacionesService.list).toHaveBeenCalledWith(
			expect.any(Object),
			{
				from: "2026-07-01T00:00:00.000Z",
				to: "2026-08-01T00:00:00.000Z",
				fecha: undefined,
				tipo: ["VENTA"],
			},
			{ page: 2, pageSize: 50 }
		);
		expect(response.status).toBe(200);
		expect(body.pagination).toEqual({ page: 2, pageSize: 50, total: 83 });
		expect(body.data).toHaveLength(1);
	});

	it("conserva el tipo COBRO_ARREGLO para que no se presente como ajuste", async () => {
		vi.mocked(operacionesService.list).mockResolvedValue({
			data: [{
				id: "op-cobro",
				tipo: "COBRO_ARREGLO",
				taller_id: "taller-1",
				fecha: "2026-08-25T00:00:00.000Z",
				created_at: "2026-08-25T00:00:00.000Z",
				lineas: [],
				gasto_id: null,
				descripcion: "Cobro parcial",
				categoria_gasto: null,
				cuenta_financiera_id: "cuenta-1",
				cuenta_financiera_nombre: "Caja",
				monto: 12500,
				arreglo_id: "arreglo-1",
				total_count: 1,
			}],
			total: 1,
			error: null,
		} as Awaited<ReturnType<typeof operacionesService.list>>);

		const response = await GET(new Request("http://localhost/api/operaciones"));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data[0]).toMatchObject({
			tipo: "COBRO_ARREGLO",
			monto: 12500,
			arreglo_id: "arreglo-1",
		});
	});
});

describe("POST /api/operaciones", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createClient).mockResolvedValue({} as unknown as SupabaseClient);
	});

	it("devuelve conflicto y conserva el mensaje cuando la RPC rechaza una venta por stock insuficiente", async () => {
		vi.mocked(operacionesService.create).mockResolvedValue({
			data: null,
			error: ServiceError.StockInsuficiente,
		} as Awaited<ReturnType<typeof operacionesService.create>>);

		const response = await POST(new Request("http://localhost/api/operaciones", {
			method: "POST",
			body: JSON.stringify({
				tipo: "VENTA",
				taller_id: "11111111-1111-4111-8111-111111111111",
				cuenta_financiera_id: "22222222-2222-4222-8222-222222222222",
				idempotency_key: "33333333-3333-4333-8333-333333333333",
				lineas: [{
					stock_id: "44444444-4444-4444-8444-444444444444",
					cantidad: 2,
					monto_unitario: 3500,
					delta_cantidad: -2,
				}],
			}),
		}));

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ data: null, error: "Stock insuficiente" });
	});
});
