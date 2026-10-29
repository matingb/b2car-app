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
			categoria_gasto: null,
			descripcion: null,
			cliente_id: null,
			cliente_nombre: undefined,
			proveedor_id: null,
			proveedor_nombre: undefined,
			movimientos_stock: [],
		});
		expect(res.error).toBeNull();
	});

	it("getById mapea correctamente operaciones_gasto con categoria y descripcion", async () => {
		const rawRow = {
			id: "op-gasto",
			tenant_id: "tenant-1",
			tipo: "GASTO",
			operaciones_gasto: {
				categoria_gasto: "SERVICIOS",
				descripcion: "Luz y gas",
			},
		};

		const single = vi.fn().mockResolvedValue({ data: rawRow, error: null });
		const eq = vi.fn().mockReturnValue({ single });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const supabase = { from } as unknown as SupabaseClient;

		const res = await operacionRepository.getById(supabase, "op-gasto");

		expect(res.data).toEqual(
			expect.objectContaining({
				id: "op-gasto",
				categoria_gasto: "SERVICIOS",
				descripcion: "Luz y gas",
			})
		);
		expect(res.data?.proveedor_id).toBeNull();
		expect(res.data?.proveedor_nombre).toBeUndefined();
		expect(res.error).toBeNull();
	});

	it("create invoca rpc_crear_operacion_gasto cuando el tipo es GASTO", async () => {
		const rpc = vi.fn().mockResolvedValue({ data: "op-gasto-123", error: null });
		const supabase = { rpc } as unknown as SupabaseClient;

		const res = await operacionRepository.create(supabase, {
			p_tipo: "GASTO",
			p_categoria_gasto: "SERVICIOS",
			p_monto: 15000,
			p_descripcion: "Internet",
			p_estado_pago: "PENDIENTE",
		});

		expect(rpc).toHaveBeenCalledWith("rpc_crear_operacion_gasto", {
			p_categoria_gasto: "SERVICIOS",
			p_monto: 15000,
			p_descripcion: "Internet",
			p_fecha: undefined,
			p_observaciones: undefined,
			p_taller_id: undefined,
			p_proveedor_id: undefined,
			p_estado_pago: "PENDIENTE",
			p_cuenta_id: undefined,
			p_monto_inicial: undefined,
			p_pagos: undefined,
			p_idempotency_key: undefined,
		});
		expect(res.data).toBe("op-gasto-123");
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
			reversion_de_id: null,
			revertido: false,
		});
		expect(res.data?.movimientos_stock?.[1]?.id).toBe("mov-1");
		expect(res.error).toBeNull();
	});

	it("revertirStock invoca rpc_revertir_movimiento_stock_operacion", async () => {
		const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
		const supabase = { rpc } as unknown as SupabaseClient;

		const res = await operacionRepository.revertirStock(supabase, {
			p_operacion_id: "op-1",
			p_movimiento_id: "mov-1",
		});

		expect(rpc).toHaveBeenCalledWith("rpc_revertir_movimiento_stock_operacion", {
			p_operacion_id: "op-1",
			p_movimiento_id: "mov-1",
		});
		expect(res.data).toEqual({ ok: true });
	});
});
