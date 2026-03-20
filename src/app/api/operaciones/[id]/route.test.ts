import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUT } from "./route";

vi.mock("@/supabase/server", () => ({
	createClient: vi.fn(),
}));

vi.mock("../operacionesService", async () => {
	const actual = await vi.importActual<typeof import("../operacionesService")>("../operacionesService");
	return {
		...actual,
		operacionesService: {
			...actual.operacionesService,
			update: vi.fn(),
		},
	};
});

import { createClient } from "@/supabase/server";
import { operacionesService } from "../operacionesService";

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

	it("PUT actualiza una operaciÃ³n sin tocar el arreglo", async () => {
		vi.mocked(operacionesService.update).mockResolvedValue({
			data: {
				id: "op-1",
				tipo: "VENTA",
				taller_id: "t1",
				created_at: new Date().toISOString(),
				operaciones_lineas: [],
			},
			error: null,
		} as Awaited<ReturnType<typeof operacionesService.update>>);

		const req = new NextRequest("http://localhost/api/operaciones/op-1", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ tipo: "VENTA" }),
		});

		const res = await PUT(req, { params: Promise.resolve({ id: "op-1" }) });

		expect(res.status).toBe(200);
		expect(vi.mocked(operacionesService.update)).toHaveBeenCalledWith(expect.anything(), "op-1", { tipo: "VENTA" });
	});
});
