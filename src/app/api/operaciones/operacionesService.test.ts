import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { operacionesService } from "./operacionesService";

describe("operacionesService.list", () => {
	it("pagina operaciones y gastos en una única RPC con total estable", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: [{ total_count: 123 }],
			error: null,
		});

		const supabase = { rpc } as unknown as SupabaseClient;

		const result = await operacionesService.list(
			supabase,
			{ from: "2026-07-01T00:00:00.000Z", to: "2026-08-01T00:00:00.000Z" },
			{ page: 2, pageSize: 50 }
		);

		expect(rpc).toHaveBeenCalledWith("rpc_listar_operaciones_con_gastos", {
			p_from: "2026-07-01T00:00:00.000Z",
			p_to: "2026-08-01T00:00:00.000Z",
			p_tipos: null,
			p_page: 2,
			p_page_size: 50,
		});
		expect(result.total).toBe(123);
		expect(result.error).toBeNull();
	});
});

describe("operacionesService.update", () => {
	afterEach(() => vi.restoreAllMocks());

	it("conserva la cuenta del evento vigente en una actualización parcial de venta", async () => {
		const operacionId = "11111111-1111-4111-8111-111111111111";
		const cuentaId = "22222222-2222-4222-8222-222222222222";
		const eventoId = "33333333-3333-4333-8333-333333333333";
		const idempotencyKey = "44444444-4444-4444-8444-444444444444";
		const current = {
			id: operacionId,
			tenant_id: "55555555-5555-4555-8555-555555555555",
			tipo: "VENTA" as const,
			taller_id: "66666666-6666-4666-8666-666666666666",
			fecha: "2026-07-31T00:00:00.000Z",
			created_at: "2026-07-31T00:00:00.000Z",
			movimiento_financiero_id: eventoId,
			operaciones_lineas: [],
		};
		const getById = vi.spyOn(operacionesService, "getById")
			.mockResolvedValueOnce({ data: current, error: null })
			.mockResolvedValueOnce({ data: current, error: null });
		const maybeSingle = vi.fn().mockResolvedValue({ data: { cuenta_financiera_id: cuentaId }, error: null });
		const eq = vi.fn().mockReturnValue({ maybeSingle });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const rpc = vi.fn().mockResolvedValue({ data: operacionId, error: null });
		const supabase = { from, rpc } as unknown as SupabaseClient;

		const result = await operacionesService.update(supabase, operacionId, { idempotency_key: idempotencyKey });

		expect(from).toHaveBeenCalledWith("movimientos_financieros");
		expect(rpc).toHaveBeenCalledWith("rpc_actualizar_operacion_con_stock", expect.objectContaining({
			p_operacion_id: operacionId,
			p_tipo: "VENTA",
			p_cuenta_id: cuentaId,
			p_idempotency_key: idempotencyKey,
		}));
		expect(result.error).toBeNull();
		expect(getById).toHaveBeenCalledTimes(2);
	});
});

describe("operacionesService.stats", () => {
	it("incluye los cobros de arreglos y trata las asignaciones como importe", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: [{ ventas: "100000", compras: "20000", asignaciones: "15000", cobros: "45000", gastos: "5000", neto: "120000" }],
			error: null,
		});
		const supabase = { rpc } as unknown as SupabaseClient;

		const result = await operacionesService.stats(supabase, {});

		expect(result).toEqual({
			data: { ventas: 100000, compras: 20000, asignaciones: 15000, cobros: 45000, gastos: 5000, neto: 120000 },
			error: null,
		});
	});
});
