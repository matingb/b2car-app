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
		registrarPago: vi.fn(),
		getById: vi.fn(),
	},
}));

import { createClient } from "@/supabase/server";
import { ServiceError } from "@/app/api/serviceError";
import { operacionesService, type OperacionRow } from "@/app/api/operaciones/operacionesService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { POST } from "./route";

describe("POST /api/operaciones/[id]/pagos", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createClient).mockResolvedValue({} as unknown as SupabaseClient);
	});

	it("valida que el id sea un UUID válido", async () => {
		const req = new Request("http://localhost/api/operaciones/invalido/pagos", {
			method: "POST",
			body: JSON.stringify({ cuenta_id: "22222222-2222-4222-8222-222222222222", monto: 100 }),
		}) as unknown as NextRequest;

		const response = await POST(req, { params: Promise.resolve({ id: "invalido" }) });
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ data: null, error: "ID de operación inválido" });
	});

	it("valida que cuenta_id sea requerida y sea UUID", async () => {
		const opId = "11111111-1111-4111-8111-111111111111";
		const req = new Request(`http://localhost/api/operaciones/${opId}/pagos`, {
			method: "POST",
			body: JSON.stringify({ monto: 100 }),
		}) as unknown as NextRequest;

		const response = await POST(req, { params: Promise.resolve({ id: opId }) });
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ data: null, error: "Seleccioná una cuenta financiera válida" });
	});

	it("valida que el monto sea un número mayor a cero", async () => {
		const opId = "11111111-1111-4111-8111-111111111111";
		const req = new Request(`http://localhost/api/operaciones/${opId}/pagos`, {
			method: "POST",
			body: JSON.stringify({ cuenta_id: "22222222-2222-4222-8222-222222222222", monto: 0 }),
		}) as unknown as NextRequest;

		const response = await POST(req, { params: Promise.resolve({ id: opId }) });
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ data: null, error: "El monto debe ser mayor a 0" });
	});

	it("registra un pago exitosamente", async () => {
		const opId = "11111111-1111-4111-8111-111111111111";
		const cuentaId = "22222222-2222-4222-8222-222222222222";
		vi.mocked(operacionesService.registrarPago).mockResolvedValue({
			data: { ok: true, total_pagado: 500, saldo_pendiente: 0, esta_pago: true, estado_pago: "PAGADO" },
			error: null,
		});
		vi.mocked(operacionesService.getById).mockResolvedValue({
			data: { id: opId, tenant_id: "tenant-1" } as OperacionRow,
			error: null,
		});

		const req = new Request(`http://localhost/api/operaciones/${opId}/pagos`, {
			method: "POST",
			body: JSON.stringify({
				cuenta_id: cuentaId,
				monto: 500,
				descripcion: "Pago diferido cancelado",
			}),
		}) as unknown as NextRequest;

		const response = await POST(req, { params: Promise.resolve({ id: opId }) });
		expect(response.status).toBe(201);
		const json = await response.json();
		expect(json.data.ok).toBe(true);
		expect(operacionesService.registrarPago).toHaveBeenCalledWith(
			expect.anything(),
			opId,
			expect.objectContaining({
				cuentaId,
				monto: 500,
				descripcion: "Pago diferido cancelado",
			})
		);
		expect(statsService.onDataChanged).toHaveBeenCalledWith(expect.anything(), "tenant-1");
	});

	it("devuelve 404 si la operación no existe", async () => {
		const opId = "11111111-1111-4111-8111-111111111111";
		vi.mocked(operacionesService.registrarPago).mockResolvedValue({
			data: null,
			error: ServiceError.NotFound,
		});

		const req = new Request(`http://localhost/api/operaciones/${opId}/pagos`, {
			method: "POST",
			body: JSON.stringify({ cuenta_id: "22222222-2222-4222-8222-222222222222", monto: 100 }),
		}) as unknown as NextRequest;

		const response = await POST(req, { params: Promise.resolve({ id: opId }) });
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ data: null, error: "Operación no encontrada" });
	});
});
