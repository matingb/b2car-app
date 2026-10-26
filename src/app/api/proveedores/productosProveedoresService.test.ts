import { describe, expect, it, vi, beforeEach } from "vitest";
import { createProductosProveedoresService } from "./productosProveedoresService";
import type { ProductosProveedoresRepository } from "./productosProveedoresRepository";
import { ServiceError } from "@/app/api/serviceError";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("productosProveedoresService", () => {
	const mockRepo: ProductosProveedoresRepository = {
		listarPorProveedor: vi.fn(),
		listarPorProducto: vi.fn(),
		asociar: vi.fn(),
		actualizar: vi.fn(),
		desvincular: vi.fn(),
	};

	const service = createProductosProveedoresService(mockRepo);
	const mockSupabase = {} as SupabaseClient;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rechaza listarPorProveedor con UUID inválido", async () => {
		const res = await service.listarPorProveedor(mockSupabase, "invalido");
		expect(res.error).toBe(ServiceError.Validation);
		expect(mockRepo.listarPorProveedor).not.toHaveBeenCalled();
	});

	it("lista productos por proveedor con UUID válido", async () => {
		const validUuid = "00000000-0000-0000-0000-000000000001";
		vi.mocked(mockRepo.listarPorProveedor).mockResolvedValue({ data: [], error: null });

		const res = await service.listarPorProveedor(mockSupabase, validUuid);
		expect(res.error).toBeNull();
		expect(mockRepo.listarPorProveedor).toHaveBeenCalledWith(mockSupabase, validUuid);
	});

	it("valida y delega asociar producto", async () => {
		const provId = "00000000-0000-0000-0000-000000000001";
		const prodId = "00000000-0000-0000-0000-000000000002";

		vi.mocked(mockRepo.asociar).mockResolvedValue({
			data: {
				id: "pp-1",
				proveedor_id: provId,
				producto_id: prodId,
				codigo_proveedor: "SKU-99",
				costo_referencia: 1500,
				es_predeterminado: true,
			},
			error: null,
		});

		const res = await service.asociar(mockSupabase, {
			proveedor_id: provId,
			producto_id: prodId,
			codigo_proveedor: "  SKU-99  ",
			costo_referencia: 1500,
			es_predeterminado: true,
		});

		expect(res.error).toBeNull();
		expect(mockRepo.asociar).toHaveBeenCalledWith(mockSupabase, {
			proveedor_id: provId,
			producto_id: prodId,
			codigo_proveedor: "SKU-99",
			costo_referencia: 1500,
			es_predeterminado: true,
		});
	});

	it("rechaza asociar con costo negativo", async () => {
		const provId = "00000000-0000-0000-0000-000000000001";
		const prodId = "00000000-0000-0000-0000-000000000002";

		const res = await service.asociar(mockSupabase, {
			proveedor_id: provId,
			producto_id: prodId,
			costo_referencia: -10,
		});

		expect(res.error).toBe(ServiceError.Validation);
		expect(mockRepo.asociar).not.toHaveBeenCalled();
	});

	it("actualiza vinculación correctamente", async () => {
		const provId = "00000000-0000-0000-0000-000000000001";
		const prodId = "00000000-0000-0000-0000-000000000002";

		vi.mocked(mockRepo.actualizar).mockResolvedValue({
			data: null,
			error: null,
		});

		const res = await service.actualizar(mockSupabase, provId, prodId, {
			costo_referencia: 2000,
		});

		expect(res.error).toBeNull();
		expect(mockRepo.actualizar).toHaveBeenCalledWith(mockSupabase, provId, prodId, {
			costo_referencia: 2000,
		});
	});

	it("desvincula producto correctamente", async () => {
		const provId = "00000000-0000-0000-0000-000000000001";
		const prodId = "00000000-0000-0000-0000-000000000002";

		vi.mocked(mockRepo.desvincular).mockResolvedValue({ error: null });

		const res = await service.desvincular(mockSupabase, provId, prodId);
		expect(res.error).toBeNull();
		expect(mockRepo.desvincular).toHaveBeenCalledWith(mockSupabase, provId, prodId);
	});
});
