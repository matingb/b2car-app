import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { operacionRepository } from "./operacionRepository";

describe("operacionRepository", () => {
	it("getById consulta la tabla operaciones con los joins necesarios y filtra por id", async () => {
		const mockRow = {
			id: "op-1",
			tenant_id: "tenant-1",
			tipo: "VENTA",
			operaciones_lineas: [],
			operaciones_pagos: [],
		};

		const single = vi.fn().mockResolvedValue({ data: mockRow, error: null });
		const eq = vi.fn().mockReturnValue({ single });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const supabase = { from } as unknown as SupabaseClient;

		const res = await operacionRepository.getById(supabase, "op-1");

		expect(from).toHaveBeenCalledWith("operaciones");
		expect(select).toHaveBeenCalledWith(expect.stringContaining("operaciones_lineas(*)"));
		expect(eq).toHaveBeenCalledWith("id", "op-1");
		expect(res.data).toEqual({
			...mockRow,
			cliente_id: null,
			cliente_nombre: undefined,
			proveedor_id: null,
			proveedor_nombre: undefined,
		});
		expect(res.error).toBeNull();
	});

	it("getById mapea correctamente operaciones_venta con particular", async () => {
		const rawRow = {
			id: "op-venta",
			tenant_id: "tenant-1",
			tipo: "VENTA",
			operaciones_venta: {
				cliente_id: "cli-1",
				clientes: {
					tipo_cliente: "PARTICULAR",
					particulares: { nombre: "Juan", apellido: "Pérez" },
				},
			},
		};

		const single = vi.fn().mockResolvedValue({ data: rawRow, error: null });
		const eq = vi.fn().mockReturnValue({ single });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const supabase = { from } as unknown as SupabaseClient;

		const res = await operacionRepository.getById(supabase, "op-venta");

		expect(res.data).toEqual(
			expect.objectContaining({
				id: "op-venta",
				cliente_id: "cli-1",
				cliente_nombre: "Juan Pérez",
				proveedor_id: null,
				proveedor_nombre: undefined,
			})
		);
		expect(res.error).toBeNull();
	});

	it("getById mapea correctamente operaciones_compra con proveedor", async () => {
		const rawRow = {
			id: "op-compra",
			tenant_id: "tenant-1",
			tipo: "COMPRA",
			operaciones_compra: {
				proveedor_id: "prov-1",
				proveedores: { nombre: "Repuestos SA" },
			},
		};

		const single = vi.fn().mockResolvedValue({ data: rawRow, error: null });
		const eq = vi.fn().mockReturnValue({ single });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const supabase = { from } as unknown as SupabaseClient;

		const res = await operacionRepository.getById(supabase, "op-compra");

		expect(res.data).toEqual(
			expect.objectContaining({
				id: "op-compra",
				cliente_id: null,
				cliente_nombre: undefined,
				proveedor_id: "prov-1",
				proveedor_nombre: "Repuestos SA",
			})
		);
		expect(res.error).toBeNull();
	});
});
