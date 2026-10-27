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
			movimientos_stock: [],
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

	it("getById mapea y ordena correctamente movimientos_stock con producto", async () => {
		const rawRow = {
			id: "op-con-movs",
			tenant_id: "tenant-1",
			tipo: "VENTA",
			movimientos_stock: [
				{
					id: "mov-1",
					fecha: "2026-10-20T10:00:00Z",
					cantidad: -2,
					saldo_anterior: 10,
					saldo_posterior: 8,
					motivo: "Primera entrega",
					created_at: "2026-10-20T10:00:00Z",
					producto_id: "prod-1",
					stock_id: "stock-1",
					producto: { nombre: "Filtro Aceite", codigo: "FA-01" },
				},
				{
					id: "mov-2",
					fecha: "2026-10-22T15:00:00Z",
					cantidad: -3,
					saldo_anterior: 8,
					saldo_posterior: 5,
					motivo: "Segunda entrega",
					created_at: "2026-10-22T15:00:00Z",
					producto_id: "prod-1",
					stock_id: "stock-1",
					producto: { nombre: "Filtro Aceite", codigo: "FA-01" },
				},
			],
		};

		const single = vi.fn().mockResolvedValue({ data: rawRow, error: null });
		const eq = vi.fn().mockReturnValue({ single });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const supabase = { from } as unknown as SupabaseClient;

		const res = await operacionRepository.getById(supabase, "op-con-movs");

		expect(res.data?.movimientos_stock).toHaveLength(2);
		// El más reciente (22/10) debe ser el primero
		expect(res.data?.movimientos_stock?.[0]).toEqual({
			id: "mov-2",
			fecha: "2026-10-22T15:00:00Z",
			cantidad: -3,
			saldo_anterior: 8,
			saldo_posterior: 5,
			motivo: "Segunda entrega",
			created_at: "2026-10-22T15:00:00Z",
			created_by: null,
			producto_id: "prod-1",
			stock_id: "stock-1",
			producto_nombre: "Filtro Aceite",
			producto_codigo: "FA-01",
		});
		expect(res.data?.movimientos_stock?.[1]?.id).toBe("mov-1");
		expect(res.error).toBeNull();
	});
});
