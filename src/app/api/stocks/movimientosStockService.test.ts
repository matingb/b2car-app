import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMovimientosStockService } from "./movimientosStockService";
import type { MovimientosStockRepository } from "./movimientosStockRepository";
import { ServiceError } from "@/app/api/serviceError";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("movimientosStockService", () => {
	const mockRepo: MovimientosStockRepository = {
		listar: vi.fn(),
	};

	const service = createMovimientosStockService(mockRepo);
	const mockSupabase = {} as SupabaseClient;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rechaza listar si productoId es inválido", async () => {
		const res = await service.listar(mockSupabase, { productoId: "invalido" });
		expect(res.error).toBe(ServiceError.Validation);
		expect(mockRepo.listar).not.toHaveBeenCalled();
	});

	it("rechaza listar si tallerId es inválido", async () => {
		const prodId = "00000000-0000-0000-0000-000000000001";
		const res = await service.listar(mockSupabase, { productoId: prodId, tallerId: "invalido" });
		expect(res.error).toBe(ServiceError.Validation);
		expect(mockRepo.listar).not.toHaveBeenCalled();
	});

	it("normaliza límites y delega al repositorio", async () => {
		const prodId = "00000000-0000-0000-0000-000000000001";
		vi.mocked(mockRepo.listar).mockResolvedValue({ data: [], error: null });

		const res = await service.listar(mockSupabase, {
			productoId: prodId,
			limit: 500, // Debe clampear a 200
			offset: -5, // Debe clampear a 0
		});

		expect(res.error).toBeNull();
		expect(mockRepo.listar).toHaveBeenCalledWith(mockSupabase, {
			productoId: prodId,
			tallerId: null,
			limit: 200,
			offset: 0,
		});
	});
});
