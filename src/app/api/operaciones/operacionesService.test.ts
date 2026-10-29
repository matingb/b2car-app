import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { operacionesService, validateOperacionesDateFilters } from "./operacionesService";
import { ServiceError } from "../serviceError";

describe("operacionesService.list", () => {
	it("convierte el filtro por día a los límites de Buenos Aires", async () => {
		const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
		const supabase = { rpc } as unknown as SupabaseClient;

		await operacionesService.list(supabase, { fecha: "2026-09-18" });

		expect(rpc).toHaveBeenCalledWith("rpc_listar_operaciones_con_gastos", expect.objectContaining({
			p_from: "2026-09-18T03:00:00.000Z",
			p_to: "2026-09-19T03:00:00.000Z",
		}));
	});

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

	it("marca las ventas que ya tienen una factura asociada con una única consulta adicional", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: [
				{ id: "venta-facturada", tipo: "VENTA", total_count: 2 },
				{ id: "venta-sin-factura", tipo: "VENTA", total_count: 2 },
			],
			error: null,
		});
		const inFilter = vi.fn().mockResolvedValue({ data: [{ operacion_id: "venta-facturada" }], error: null });
		const eq = vi.fn().mockReturnValue({ in: inFilter });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const supabase = { rpc, from } as unknown as SupabaseClient;

		const result = await operacionesService.list(supabase);

		expect(from).toHaveBeenCalledWith("facturas_electronicas");
		expect(inFilter).toHaveBeenCalledWith("operacion_id", ["venta-facturada", "venta-sin-factura"]);
		expect(result.data).toEqual(expect.arrayContaining([
			expect.objectContaining({ id: "venta-facturada", factura_asociada: true }),
			expect.objectContaining({ id: "venta-sin-factura", factura_asociada: false }),
		]));
	});
});

describe("operacionesService.create", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("interpreta una fecha sin hora en la zona de Buenos Aires antes de llamar a la RPC", async () => {
		const operacionId = "11111111-1111-4111-8111-111111111111";
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-18T02:30:00.000Z"));
		const rpc = vi.fn().mockResolvedValue({ data: operacionId, error: null });
		const getById = vi.spyOn(operacionesService, "getById").mockResolvedValue({ data: null, error: null });
		const supabase = { rpc } as unknown as SupabaseClient;

		await operacionesService.create(supabase, {
			tipo: "VENTA",
			taller_id: "22222222-2222-4222-8222-222222222222",
			fecha: "2026-09-17",
			lineas: [],
		});

		expect(rpc).toHaveBeenCalledWith("rpc_crear_operacion_con_stock", expect.objectContaining({
			p_fecha: "2026-09-18T02:30:00.000Z",
		}));
		expect(getById).toHaveBeenCalledWith(expect.any(Object), operacionId);
	});

	it("reenvía cliente_id y proveedor_id a rpc_crear_operacion_con_stock", async () => {
		const operacionId = "11111111-1111-4111-8111-111111111111";
		const rpc = vi.fn().mockResolvedValue({ data: operacionId, error: null });
		vi.spyOn(operacionesService, "getById").mockResolvedValue({ data: null, error: null });
		const supabase = { rpc } as unknown as SupabaseClient;

		await operacionesService.create(supabase, {
			tipo: "VENTA",
			taller_id: "22222222-2222-4222-8222-222222222222",
			cliente_id: "33333333-3333-4333-8333-333333333333",
			proveedor_id: null,
			lineas: [],
		});

		expect(rpc).toHaveBeenCalledWith("rpc_crear_operacion_con_stock", expect.objectContaining({
			p_cliente_id: "33333333-3333-4333-8333-333333333333",
			p_proveedor_id: null,
		}));
	});

	it("reenvía parámetros de GASTO a rpc_crear_operacion_gasto", async () => {
		const operacionId = "11111111-1111-4111-8111-111111111111";
		const rpc = vi.fn().mockResolvedValue({ data: operacionId, error: null });
		vi.spyOn(operacionesService, "getById").mockResolvedValue({ data: null, error: null });
		const supabase = { rpc } as unknown as SupabaseClient;

		await operacionesService.create(supabase, {
			tipo: "GASTO",
			categoria_gasto: "SERVICIOS",
			monto: 35000,
			descripcion: "Luz y agua",
			estado_pago: "PENDIENTE",
		});

		expect(rpc).toHaveBeenCalledWith("rpc_crear_operacion_gasto", expect.objectContaining({
			p_categoria_gasto: "SERVICIOS",
			p_monto: 35000,
			p_descripcion: "Luz y agua",
			p_estado_pago: "PENDIENTE",
		}));
	});
});

describe("operacionesService.getById", () => {
	it("enriquece los datos con cliente_id y cliente_nombre desde operaciones_venta", async () => {
		const operacionId = "11111111-1111-4111-8111-111111111111";
		const clienteId = "22222222-2222-4222-8222-222222222222";
		const single = vi.fn().mockResolvedValue({
			data: {
				id: operacionId,
				tipo: "VENTA",
				operaciones_lineas: [],
				operaciones_pagos: [],
				operaciones_venta: {
					cliente_id: clienteId,
					clientes: { nombre: "Carlos", apellido: "García" },
				},
				operaciones_compra: null,
			},
			error: null,
		});
		const eq = vi.fn().mockReturnValue({ single });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const supabase = { from } as unknown as SupabaseClient;

		const result = await operacionesService.getById(supabase, operacionId);

		expect(from).toHaveBeenCalledWith("operaciones");
		expect(result.data).toEqual(expect.objectContaining({
			id: operacionId,
			cliente_id: clienteId,
			cliente_nombre: "Carlos García",
		}));
	});

	it("enriquece los datos con proveedor_id y proveedor_nombre desde operaciones_compra", async () => {
		const operacionId = "11111111-1111-4111-8111-111111111111";
		const proveedorId = "33333333-3333-4333-8333-333333333333";
		const single = vi.fn().mockResolvedValue({
			data: {
				id: operacionId,
				tipo: "COMPRA",
				operaciones_lineas: [],
				operaciones_pagos: [],
				operaciones_venta: null,
				operaciones_compra: {
					proveedor_id: proveedorId,
					proveedores: { nombre: "Distribuidora Repuestos" },
				},
			},
			error: null,
		});
		const eq = vi.fn().mockReturnValue({ single });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const supabase = { from } as unknown as SupabaseClient;

		const result = await operacionesService.getById(supabase, operacionId);

		expect(from).toHaveBeenCalledWith("operaciones");
		expect(result.data).toEqual(expect.objectContaining({
			id: operacionId,
			proveedor_id: proveedorId,
			proveedor_nombre: "Distribuidora Repuestos",
		}));
	});
});


describe("validateOperacionesDateFilters", () => {
	it("acepta límites ISO con zona y fecha-only válida", () => {
		expect(validateOperacionesDateFilters({
			from: "2026-09-01T03:00:00.000Z",
			to: "2026-09-14T03:00:00.000Z",
		})).toBeNull();
		expect(validateOperacionesDateFilters({ fecha: "2026-09-13" })).toBeNull();
	});

	it.each([
		{ from: "2026-09-01T00:00:00", to: "2026-09-02T00:00:00.000Z" },
		{ from: "2026-02-30" },
		{ from: "2026-09-02T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" },
		{ fecha: "2026-09-13", from: "2026-09-13" },
	])("rechaza rangos inválidos: %o", (filters) => {
		expect(validateOperacionesDateFilters(filters)).toBeTruthy();
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

	it.each([
		{ input: {}, expected: null },
		{ input: { observaciones: null }, expected: "" },
		{ input: { observaciones: "Entrega por la tarde" }, expected: "Entrega por la tarde" },
	])("traduce $input a p_observaciones=$expected (NULL conserva, vacío borra)", async ({ input, expected }) => {
		const operacionId = "11111111-1111-4111-8111-111111111111";
		const current = {
			id: operacionId,
			tenant_id: "55555555-5555-4555-8555-555555555555",
			tipo: "COMPRA" as const,
			taller_id: "66666666-6666-4666-8666-666666666666",
			fecha: "2026-07-31T00:00:00.000Z",
			created_at: "2026-07-31T00:00:00.000Z",
			observaciones: "Observación anterior",
			operaciones_lineas: [],
		};
		vi.spyOn(operacionesService, "getById")
			.mockResolvedValueOnce({ data: current, error: null })
			.mockResolvedValueOnce({ data: current, error: null });
		const rpc = vi.fn().mockResolvedValue({ data: operacionId, error: null });
		const supabase = { rpc } as unknown as SupabaseClient;

		await operacionesService.update(supabase, operacionId, { cuenta_financiera_id: null, ...input });

		expect(rpc).toHaveBeenCalledWith("rpc_actualizar_operacion_con_stock", expect.objectContaining({
			p_operacion_id: operacionId,
			p_observaciones: expected,
		}));
	});
});

describe("operacionesService.stats", () => {
	it("usa los mismos límites de Buenos Aires para una fecha sin hora", async () => {
		const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
		const supabase = { rpc } as unknown as SupabaseClient;

		await operacionesService.stats(supabase, { fecha: "2026-09-18" });

		expect(rpc).toHaveBeenCalledWith("rpc_operaciones_stats", {
			p_from: "2026-09-18T03:00:00.000Z",
			p_to: "2026-09-19T03:00:00.000Z",
			p_tipos: null,
		});
	});

	it("reenvía los mismos límites ISO de período sin sumar otro día", async () => {
		const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
		const supabase = { rpc } as unknown as SupabaseClient;

		await operacionesService.stats(supabase, {
			from: "2026-09-01T03:00:00.000Z",
			to: "2026-10-01T03:00:00.000Z",
		});

		expect(rpc).toHaveBeenCalledWith("rpc_operaciones_stats", {
			p_from: "2026-09-01T03:00:00.000Z",
			p_to: "2026-10-01T03:00:00.000Z",
			p_tipos: null,
		});
	});

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

describe("operacionesService.deleteById", () => {
	it("usa el dispatcher que contempla cobros y movimientos financieros", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: { eliminada: true, tipo: "COBRO_ARREGLO", arreglo_id: "arreglo-1" },
			error: null,
		});
		const supabase = { rpc } as unknown as SupabaseClient;

		const result = await operacionesService.deleteById(
			supabase,
			"operacion-1",
			"11111111-1111-4111-8111-111111111111"
		);

		expect(rpc).toHaveBeenCalledWith("rpc_borrar_operacion_completa", {
			p_operacion_id: "operacion-1",
			p_idempotency_key: "11111111-1111-4111-8111-111111111111",
		});
		expect(result.error).toBeNull();
	});

	it("maneja error devuelto por la RPC y lo loguea", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: null,
			error: { code: "55000", message: "Los movimientos del ledger son inmutables." },
		});
		const supabase = { rpc } as unknown as SupabaseClient;

		const result = await operacionesService.deleteById(
			supabase,
			"operacion-1"
		);

		expect(result.error).toBe(ServiceError.MovimientoFinancieroInmutable);
	});

	it("devuelve NotFound si data.eliminada es false o data es nulo", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: null,
			error: null,
		});
		const supabase = { rpc } as unknown as SupabaseClient;

		const result = await operacionesService.deleteById(
			supabase,
			"operacion-1"
		);

		expect(result.error).toBe("NotFound");
	});

	it("captura excepciones y devuelve ServiceError.Unknown", async () => {
		const rpc = vi.fn().mockRejectedValue(new Error("Network disconnect"));
		const supabase = { rpc } as unknown as SupabaseClient;

		const result = await operacionesService.deleteById(
			supabase,
			"operacion-1"
		);

		expect(result.error).toBe("Unknown");
	});
});

describe("operacionesService.anularPago", () => {
	it("llama a la RPC rpc_finanzas_anular_pago_operacion y devuelve la operación actualizada", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: { ok: true },
			error: null,
		});
		const single = vi.fn().mockResolvedValue({
			data: { id: "op-1", monto_total: 1000, total_pagado: 0, estado_pago: "PENDIENTE" },
			error: null,
		});
		const eq = vi.fn().mockReturnValue({ single });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const supabase = { rpc, from } as unknown as SupabaseClient;

		const result = await operacionesService.anularPago(
			supabase,
			"op-1",
			"pago-1"
		);

		expect(rpc).toHaveBeenCalledWith("rpc_finanzas_anular_pago_operacion", {
			p_operacion_id: "op-1",
			p_pago_id: "pago-1",
		});
		expect(result.data?.id).toBe("op-1");
		expect(result.error).toBeNull();
	});

	it("retorna error estandarizado cuando falla la RPC", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: null,
			error: { code: "P0002", message: "Pago no encontrado" },
		});
		const supabase = { rpc } as unknown as SupabaseClient;

		const result = await operacionesService.anularPago(
			supabase,
			"op-1",
			"pago-1"
		);

		expect(result.error).toBe(ServiceError.NotFound);
		expect(result.data).toBeNull();
	});
});

describe("operacionesService.revertirStock", () => {
	it("llama a la RPC rpc_revertir_movimiento_stock_operacion y devuelve la operación actualizada", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: { ok: true },
			error: null,
		});
		const single = vi.fn().mockResolvedValue({
			data: { id: "op-1", estado_stock: "PARCIAL" },
			error: null,
		});
		const eq = vi.fn().mockReturnValue({ single });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });
		const supabase = { rpc, from } as unknown as SupabaseClient;

		const result = await operacionesService.revertirStock(
			supabase,
			"op-1",
			"mov-1"
		);

		expect(rpc).toHaveBeenCalledWith("rpc_revertir_movimiento_stock_operacion", {
			p_operacion_id: "op-1",
			p_movimiento_id: "mov-1",
		});
		expect(result.data?.id).toBe("op-1");
		expect(result.error).toBeNull();
	});

	it("retorna error estandarizado cuando falla la RPC con stock insuficiente", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: null,
			error: { code: "P0001", message: "Stock insuficiente" },
		});
		const supabase = { rpc } as unknown as SupabaseClient;

		const result = await operacionesService.revertirStock(
			supabase,
			"op-1",
			"mov-1"
		);

		expect(result.error).toBe(ServiceError.StockInsuficiente);
		expect(result.data).toBeNull();
	});
});

