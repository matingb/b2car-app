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
				tenant_id: "tenant-1",
				tipo: "VENTA",
				taller_id: "taller-1",
				fecha: "2026-07-15T00:00:00.000Z",
				created_at: "2026-07-15T00:00:00.000Z",
				operaciones_lineas: [],
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
});
