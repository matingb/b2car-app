import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { operacionesService } from "./operacionesService";

describe("operacionesService.list", () => {
	it("pagina en la base de datos antes de devolver las operaciones", async () => {
		const query = {
			select: vi.fn(),
			order: vi.fn(),
			gte: vi.fn(),
			lt: vi.fn(),
			in: vi.fn(),
			range: vi.fn().mockResolvedValue({ data: [], count: 123, error: null }),
		};
		query.select.mockReturnValue(query);
		query.order.mockReturnValue(query);
		query.gte.mockReturnValue(query);
		query.lt.mockReturnValue(query);
		query.in.mockReturnValue(query);

		const supabase = {
			from: vi.fn().mockReturnValue(query),
		} as unknown as SupabaseClient;

		const result = await operacionesService.list(
			supabase,
			{ from: "2026-07-01T00:00:00.000Z", to: "2026-08-01T00:00:00.000Z" },
			{ page: 2, pageSize: 50 }
		);

		expect(query.range).toHaveBeenCalledWith(50, 99);
		expect(result).toEqual({ data: [], total: 123, error: null });
	});
});
