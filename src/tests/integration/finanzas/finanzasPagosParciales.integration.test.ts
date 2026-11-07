import { describe, expect, it } from "vitest";
import { testClient, SEED } from "@/tests/integration";
import {
  dadoUnaCuentaFinanciera,
  expectSaldoCuenta,
  dadoUnArreglo,
  cuandoSeCobraUnArreglo,
} from "../helpers/integrationFixtures";
import {
  crearOperacionViaRoute,
  registrarPagoOperacionViaRoute,
  anularPagoOperacionViaRoute,
  anularCobroArregloViaRoute,
  getCuentaMovimientosViaRoute,
} from "../helpers/routeDrivers";
import { operacionesService } from "@/app/api/operaciones/operacionesService";
import { supabaseArregloRepository } from "@/app/api/arreglos/arregloRepository";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";

/**
 * Harness de Finanzas: Pagos parciales, cancelaciones sucesivas y sus anulaciones.
 * Cubre Venta, Compra, Gasto y Arreglo.
 */

const SALDO_INICIAL = 50000;

async function dadaUnaCuenta() {
  return dadoUnaCuentaFinanciera({
    nombre: `Cuenta Test ${crypto.randomUUID().slice(0, 6)}`,
    saldoInicial: SALDO_INICIAL,
  });
}

async function obtenerImportesLibro(cuentaId: string): Promise<number[]> {
  const res = await getCuentaMovimientosViaRoute(cuentaId);
  const body = (await res.json()) as { data: { importe: number; createdAt: string }[] };
  return body.data
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => m.importe)
    .slice(1); // Excluir apertura
}

describe("Integration: Finanzas - Pagos parciales en Ventas", () => {
  it("venta con pago parcial inicial registra estado PARCIAL y acredita saldo", async () => {
    const cuenta = await dadaUnaCuenta();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 5000 },
    });

    // Venta de $10.000 (2 unidades) con pago inicial de $4.000
    const res = await crearOperacionViaRoute({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: SEED.clienteId,
      lineas: [{ stock_id: stockId, cantidad: 2, monto_unitario: 5000, delta_cantidad: -2 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 4000, descripcion: "Anticipo de venta" }],
    });
    const { data: op } = await res.json();

    expect(op.monto_total).toBe(10000);
    expect(op.total_pagado).toBe(4000);
    expect(op.saldo_pendiente).toBe(6000);
    expect(op.estado_pago).toBe("PARCIAL");

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL + 4000);
    expect(await obtenerImportesLibro(cuenta.id)).toEqual([4000]);
  });

  it("segundo pago salda completamente la venta y acumula en la cuenta", async () => {
    const cuenta = await dadaUnaCuenta();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 5000 },
    });

    const res = await crearOperacionViaRoute({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: SEED.clienteId,
      lineas: [{ stock_id: stockId, cantidad: 2, monto_unitario: 5000, delta_cantidad: -2 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 4000 }],
    });
    const { data: op } = await res.json();

    // Pago complementario de $6.000
    const pagoRes = await registrarPagoOperacionViaRoute(op.id, {
      cuenta_id: cuenta.id,
      monto: 6000,
      descripcion: "Saldo restante venta",
    });
    expect(pagoRes.status).toBe(201);

    const { data: opFinal } = await operacionesService.getById(testClient, op.id);
    expect(Number(opFinal?.total_pagado)).toBe(10000);
    expect(Number(opFinal?.monto_total) - Number(opFinal?.total_pagado)).toBe(0);
    expect(opFinal?.esta_pago).toBe(true);
    expect(opFinal?.estado_pago).toBe("PAGADO");

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL + 10000);
    expect(await obtenerImportesLibro(cuenta.id)).toEqual([4000, 6000]);
  });

  it("anular el segundo pago reabre la deuda y emite contraasiento en el ledger", async () => {
    const cuenta = await dadaUnaCuenta();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 5000 },
    });

    const res = await crearOperacionViaRoute({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: SEED.clienteId,
      lineas: [{ stock_id: stockId, cantidad: 2, monto_unitario: 5000, delta_cantidad: -2 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 4000 }],
    });
    const { data: op } = await res.json();

    const pagoRes = await registrarPagoOperacionViaRoute(op.id, {
      cuenta_id: cuenta.id,
      monto: 6000,
    });
    const { data: pagoData } = await pagoRes.json();
    const segundoPagoId = pagoData.pago_id ?? pagoData.id;

    // Anular el segundo pago de $6.000
    const anularRes = await anularPagoOperacionViaRoute(op.id, segundoPagoId);
    expect(anularRes.status).toBe(200);

    const { data: opReabierta } = await operacionesService.getById(testClient, op.id);
    expect(Number(opReabierta?.total_pagado)).toBe(4000);
    expect(Number(opReabierta?.monto_total) - Number(opReabierta?.total_pagado)).toBe(6000);
    expect(opReabierta?.esta_pago).toBe(false);
    expect(opReabierta?.estado_pago).toBe("PARCIAL");

    // Saldo en cuenta vuelve a SALDO_INICIAL + 4000 con contraasiento (-6000)
    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL + 4000);
    expect(await obtenerImportesLibro(cuenta.id)).toEqual([4000, 6000, -6000]);
  });

  it("rechaza pagos que exceden el saldo pendiente", async () => {
    const cuenta = await dadaUnaCuenta();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 5000 },
    });

    const res = await crearOperacionViaRoute({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: SEED.clienteId,
      lineas: [{ stock_id: stockId, cantidad: 2, monto_unitario: 5000, delta_cantidad: -2 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 7000 }],
    });
    const { data: op } = await res.json();

    // Intentar pagar $4.000 cuando el saldo pendiente es $3.000
    const excesoRes = await registrarPagoOperacionViaRoute(op.id, {
      cuenta_id: cuenta.id,
      monto: 4000,
    });
    expect(excesoRes.status).toBe(500);

    // Saldo intacto
    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL + 7000);
    expect(await obtenerImportesLibro(cuenta.id)).toEqual([7000]);
  });
});

describe("Integration: Finanzas - Pagos parciales en Compras", () => {
  it("compra con pago parcial debita de la cuenta y mantiene saldo adeudado", async () => {
    const cuenta = await dadaUnaCuenta();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
      producto: { precio_unitario: 1000 },
    });

    // Compra de $20.000 con entrega total y pago parcial de $8.000
    const res = await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      proveedor_id: SEED.proveedorId,
      lineas: [{ stock_id: stockId, cantidad: 20, monto_unitario: 1000, delta_cantidad: 20 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 8000, descripcion: "Anticipo compra" }],
    });
    const { data: op } = await res.json();

    expect(op.monto_total).toBe(20000);
    expect(op.total_pagado).toBe(8000);
    expect(op.saldo_pendiente).toBe(12000);
    expect(op.estado_pago).toBe("PARCIAL");

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL - 8000);
    expect(await obtenerImportesLibro(cuenta.id)).toEqual([-8000]);
  });

  it("segundo pago salda la compra y anulación restaura el débito", async () => {
    const cuenta = await dadaUnaCuenta();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
      producto: { precio_unitario: 1000 },
    });

    const res = await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      proveedor_id: SEED.proveedorId,
      lineas: [{ stock_id: stockId, cantidad: 20, monto_unitario: 1000, delta_cantidad: 20 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 8000 }],
    });
    const { data: op } = await res.json();

    // Pago complementario de $12.000
    const pagoRes = await registrarPagoOperacionViaRoute(op.id, {
      cuenta_id: cuenta.id,
      monto: 12000,
      descripcion: "Cancelación factura proveedor",
    });
    expect(pagoRes.status).toBe(201);
    const { data: pagoData } = await pagoRes.json();
    const segundoPagoId = pagoData.pago_id ?? pagoData.id;

    const { data: opSaldada } = await operacionesService.getById(testClient, op.id);
    expect(Number(opSaldada?.total_pagado)).toBe(20000);
    expect(Number(opSaldada?.monto_total) - Number(opSaldada?.total_pagado)).toBe(0);
    expect(opSaldada?.esta_pago).toBe(true);
    expect(opSaldada?.estado_pago).toBe("PAGADO");

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL - 20000);
    expect(await obtenerImportesLibro(cuenta.id)).toEqual([-8000, -12000]);

    // Anular el pago de $12.000: reabre deuda y contraasienta (+12000)
    const anularRes = await anularPagoOperacionViaRoute(op.id, segundoPagoId);
    expect(anularRes.status).toBe(200);

    const { data: opReabierta } = await operacionesService.getById(testClient, op.id);
    expect(Number(opReabierta?.total_pagado)).toBe(8000);
    expect(Number(opReabierta?.monto_total) - Number(opReabierta?.total_pagado)).toBe(12000);
    expect(opReabierta?.esta_pago).toBe(false);
    expect(opReabierta?.estado_pago).toBe("PARCIAL");

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL - 8000);
    expect(await obtenerImportesLibro(cuenta.id)).toEqual([-8000, -12000, 12000]);
  });
});

describe("Integration: Finanzas - Cobros parciales en Arreglos", () => {
  it("cobros parciales sucesivos acreditan escalonadamente y anulación selectiva reabre deuda", async () => {
    const cuenta = await dadaUnaCuenta();
    const arreglo = await dadoUnArreglo({
      precio_final: 50000,
      total_cobrado: 0,
      esta_pago: false,
    });

    // Cobro 1: $20.000
    const detalle1 = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 20000,
      descripcion: "Anticipo arreglo",
    });
    const cobro1Id = detalle1?.cobros?.[0]?.operacion_id ?? "";

    // Cobro 2: $30.000 (completa los $50.000)
    await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 30000,
      descripcion: "Saldo arreglo",
    });

    // Arreglo totalmente cobrado
    const { data: arregloCompleto } = await supabaseArregloRepository.getByIdWithVehiculo(testClient, arreglo.id);
    expect(Number(arregloCompleto?.total_cobrado)).toBe(50000);
    expect(arregloCompleto?.esta_pago).toBe(true);

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL + 50000);
    expect(await obtenerImportesLibro(cuenta.id)).toEqual([20000, 30000]);

    // Anular selectivamente el cobro 1 de $20.000
    const anularRes = await anularCobroArregloViaRoute(arreglo.id, cobro1Id);
    expect(anularRes.status).toBe(200);

    const { data: arregloParcial } = await supabaseArregloRepository.getByIdWithVehiculo(testClient, arreglo.id);
    expect(Number(arregloParcial?.total_cobrado)).toBe(30000);
    expect(arregloParcial?.esta_pago).toBe(false);

    // Saldo en cuenta disminuye en $20.000
    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL + 30000);
    expect(await obtenerImportesLibro(cuenta.id)).toEqual([20000, 30000, -20000]);
  });
});
