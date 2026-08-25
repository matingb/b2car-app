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
import { operacionesService } from "./operacionesService";
import { GET } from "./route";

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
