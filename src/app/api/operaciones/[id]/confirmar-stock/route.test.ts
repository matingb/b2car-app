import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

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

vi.mock("@/app/api/operaciones/operacionesService", () => ({
	operacionesService: {
		confirmarStock: vi.fn(),
		getById: vi.fn(),
	},
}));

import { createClient } from "@/supabase/server";
import { operacionesService, type OperacionRow } from "@/app/api/operaciones/operacionesService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { POST } from "./route";

describe("POST /api/operaciones/[id]/confirmar-stock", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createClient).mockResolvedValue({} as unknown as SupabaseClient);
	});

	it("valida que el id sea un UUID válido", async () => {
		const req = new Request("http://localhost/api/operaciones/invalido/confirmar-stock", {
			method: "POST",
		}) as unknown as NextRequest;

		const response = await POST(req, { params: Promise.resolve({ id: "invalido" }) });
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ data: null, error: "ID de operación inválido" });
	});

	it("confirma el stock diferido y notifica el cambio de datos", async () => {
		const opId = "11111111-1111-4111-8111-111111111111";
		vi.mocked(operacionesService.confirmarStock).mockResolvedValue({
			data: { ok: true, operacion_id: opId, estado_stock: "ENTREGADO", unidades_confirmadas: 5 },
			error: null,
		});
		vi.mocked(operacionesService.getById).mockResolvedValue({
			data: { id: opId, tenant_id: "tenant-1" } as unknown as OperacionRow,
			error: null,
		});

		const req = new Request(`http://localhost/api/operaciones/${opId}/confirmar-stock`, {
			method: "POST",
			body: JSON.stringify({ fecha: "2026-10-21T15:00:00Z" }),
		}) as unknown as NextRequest;

		const response = await POST(req, { params: Promise.resolve({ id: opId }) });
		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.data.ok).toBe(true);
		expect(operacionesService.confirmarStock).toHaveBeenCalledWith(
			expect.anything(),
			opId,
			"2026-10-21T15:00:00Z",
			undefined
		);
		expect(statsService.onDataChanged).toHaveBeenCalledWith(expect.anything(), "tenant-1");
	});

	it("permite confirmar stock parcial pasando el array de líneas", async () => {
		const opId = "11111111-1111-4111-8111-111111111111";
		vi.mocked(operacionesService.confirmarStock).mockResolvedValue({
			data: { ok: true, operacion_id: opId, estado_stock: "PARCIAL", unidades_confirmadas: 7 },
			error: null,
		});
		vi.mocked(operacionesService.getById).mockResolvedValue({
			data: { id: opId, tenant_id: "tenant-1" } as unknown as OperacionRow,
			error: null,
		});

		const lineas = [{ lineaId: "linea-1", cantidad: 7 }];
		const req = new Request(`http://localhost/api/operaciones/${opId}/confirmar-stock`, {
			method: "POST",
			body: JSON.stringify({ fecha: "2026-10-21T15:00:00Z", lineas }),
		}) as unknown as NextRequest;

		const response = await POST(req, { params: Promise.resolve({ id: opId }) });
		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.data.estado_stock).toBe("PARCIAL");
		expect(json.data.unidades_confirmadas).toBe(7);
		expect(operacionesService.confirmarStock).toHaveBeenCalledWith(
			expect.anything(),
			opId,
			"2026-10-21T15:00:00Z",
			lineas
		);
	});
});
