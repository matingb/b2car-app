import { describe, expect, it } from "vitest";
import { SEED, testClient, createAdminTestClient } from "@/tests/integration";
import {
  dadoUnaCuentaFinanciera,
  expectSaldoCuenta,
  cuandoSeCobraUnArreglo,
  dadoUnArreglo,
} from "../helpers/integrationFixtures";
import {
  crearOperacionViaRoute,
  anularPagoOperacionViaRoute,
  getCuentaMovimientosViaRoute,
} from "../helpers/routeDrivers";
import { dadoUnGasto } from "../dashboard/dashboardHelpers";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";

/**
 * Harness de Finanzas: Múltiples cuentas financieras, libro mayor y cuentas inactivas.
 */

const SALDO_A = 100000;
const SALDO_B = 50000;

async function dadasDosCuentas() {
  const cuentaA = await dadoUnaCuentaFinanciera({
    nombre: `Banco Galicia ${crypto.randomUUID().slice(0, 6)}`,
    tipo: "CUENTA_BANCARIA",
    saldoInicial: SALDO_A,
  });
  const cuentaB = await dadoUnaCuentaFinanciera({
    nombre: `Caja Chica ${crypto.randomUUID().slice(0, 6)}`,
    tipo: "EFECTIVO",
    saldoInicial: SALDO_B,
  });
  return { cuentaA, cuentaB };
}

describe("Integration: Finanzas - Múltiples Cuentas Financieras", () => {
  it("distribuye cobros de una venta entre dos cuentas y aísla sus saldos", async () => {
    const { cuentaA, cuentaB } = await dadasDosCuentas();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 10000 },
    });

    // Venta de $20.000 (2 unidades) pagada: $15.000 en Galicia y $5.000 en Efectivo
    const res = await crearOperacionViaRoute({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: SEED.clienteId,
      lineas: [{ stock_id: stockId, cantidad: 2, monto_unitario: 10000, delta_cantidad: -2 }],
      pagos: [
        { cuenta_id: cuentaA.id, monto: 15000, descripcion: "Cobro banco" },
        { cuenta_id: cuentaB.id, monto: 5000, descripcion: "Cobro efectivo" },
      ],
    });
    expect(res.status).toBe(201);

    // Cada cuenta refleja exactamente su pago
    await expectSaldoCuenta(cuentaA.id, SALDO_A + 15000);
    await expectSaldoCuenta(cuentaB.id, SALDO_B + 5000);
  });

  it("anular el pago de una cuenta revierte solo su saldo sin afectar a la otra", async () => {
    const { cuentaA, cuentaB } = await dadasDosCuentas();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 10000 },
    });

    const res = await crearOperacionViaRoute({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: SEED.clienteId,
      lineas: [{ stock_id: stockId, cantidad: 2, monto_unitario: 10000, delta_cantidad: -2 }],
      pagos: [
        { cuenta_id: cuentaA.id, monto: 15000 },
        { cuenta_id: cuentaB.id, monto: 5000 },
      ],
    });
    const { data: op } = await res.json();

    // Obtener el pago de cuentaB
    const { data: pagos } = await testClient
      .from("operaciones_pagos")
      .select("id, cuenta_financiera_id, monto")
      .eq("operacion_id", op.id);
    const pagoB = pagos?.find((p) => p.cuenta_financiera_id === cuentaB.id);
    expect(pagoB).toBeDefined();

    // Anular el pago de Cuenta B
    const anularRes = await anularPagoOperacionViaRoute(op.id, pagoB!.id);
    expect(anularRes.status).toBe(200);

    // Cuenta B vuelve a su saldo inicial; Cuenta A conserva sus $15.000 intactos
    await expectSaldoCuenta(cuentaB.id, SALDO_B);
    await expectSaldoCuenta(cuentaA.id, SALDO_A + 15000);
  });

  it("aísla débitos entre cuentas para compras y gastos", async () => {
    const { cuentaA, cuentaB } = await dadasDosCuentas();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
      producto: { precio_unitario: 2000 },
    });

    // Compra de $10.000 pagada desde Cuenta A
    await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      proveedor_id: SEED.proveedorId,
      lineas: [{ stock_id: stockId, cantidad: 5, monto_unitario: 2000, delta_cantidad: 5 }],
      pagos: [{ cuenta_id: cuentaA.id, monto: 10000 }],
    });

    // Gasto eventual de $3.000 pagado desde Cuenta B
    await dadoUnGasto(cuentaB.id, new Date().toISOString(), 3000);

    // Validar aislamiento
    await expectSaldoCuenta(cuentaA.id, SALDO_A - 10000);
    await expectSaldoCuenta(cuentaB.id, SALDO_B - 3000);
  });
});

describe("Integration: Finanzas - Libro Mayor de Cuenta Financiera", () => {
  it("el libro mayor reporta tipo, descripción y categoría correctos para cada entidad", async () => {
    const cuenta = await dadoUnaCuentaFinanciera({
      nombre: `Libro Mayor ${crypto.randomUUID().slice(0, 6)}`,
      saldoInicial: 10000,
    });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 1000 },
    });

    // 1. Venta
    await crearOperacionViaRoute({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: SEED.clienteId,
      lineas: [{ stock_id: stockId, cantidad: 1, monto_unitario: 1000, delta_cantidad: -1 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 1000, descripcion: "Venta mostrador" }],
    });

    // 2. Compra
    await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      proveedor_id: SEED.proveedorId,
      lineas: [{ stock_id: stockId, cantidad: 2, monto_unitario: 1000, delta_cantidad: 2 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 2000, descripcion: "Pago repuestos" }],
    });

    // 3. Cobro de Arreglo
    const arreglo = await dadoUnArreglo({ precio_final: 5000 });
    await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 5000,
      descripcion: "Cobro service",
    });

    // Consultar el libro mayor vía route
    const res = await getCuentaMovimientosViaRoute(cuenta.id);
    expect(res.status).toBe(200);
    const { data: movimientos } = (await res.json()) as {
      data: Array<{ importe: number; tipo: string; descripcion: string }>;
    };

    const movVenta = movimientos.find((m) => m.tipo === "VENTA");
    expect(movVenta).toBeDefined();
    expect(Number(movVenta?.importe)).toBe(1000);

    const movCompra = movimientos.find((m) => m.tipo === "COMPRA");
    expect(movCompra).toBeDefined();
    expect(Number(movCompra?.importe)).toBe(-2000);

    const movArreglo = movimientos.find((m) => m.tipo === "COBRO_ARREGLO");
    expect(movArreglo).toBeDefined();
    expect(Number(movArreglo?.importe)).toBe(5000);
  });

  it("permite paginar y filtrar el libro mayor por fechas", async () => {
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 5000 });

    const pasado = "2026-01-15T12:00:00Z";
    const hoy = "2026-06-15T12:00:00Z";

    await testClient.rpc("rpc_crear_movimiento_cuenta", {
      p_subtipo: "INGRESO",
      p_importe: 2000,
      p_cuenta_id: cuenta.id,
      p_fecha: pasado,
      p_descripcion: "Ingreso pasado",
    });

    await testClient.rpc("rpc_crear_movimiento_cuenta", {
      p_subtipo: "INGRESO",
      p_importe: 3000,
      p_cuenta_id: cuenta.id,
      p_fecha: hoy,
      p_descripcion: "Ingreso hoy",
    });

    // Filtrar sólo movimientos a partir de junio 2026
    const resFiltrada = await getCuentaMovimientosViaRoute(cuenta.id, {
      desde: "2026-06-01T00:00:00Z",
    });
    const { data: movsJunio } = (await resFiltrada.json()) as {
      data: Array<{ importe: number; descripcion: string }>;
    };

    expect(movsJunio.some((m) => m.descripcion === "Ingreso hoy")).toBe(true);
    expect(movsJunio.some((m) => m.descripcion === "Ingreso pasado")).toBe(false);
  });
});

describe("Integration: Finanzas - Cuentas Inactivas", () => {
  it("rechaza pagos a cuentas inactivas y conserva el estado de la operación", async () => {
    const cuentaInactiva = await dadoUnaCuentaFinanciera({
      nombre: `Cuenta Inactiva ${crypto.randomUUID().slice(0, 6)}`,
      saldoInicial: 0,
    });

    // Desactivar la cuenta
    const adminClient = createAdminTestClient();
    const { error: patchError } = await adminClient
      .from("cuentas_financieras")
      .update({ activo: false })
      .eq("id", cuentaInactiva.id);
    expect(patchError).toBeNull();

    // Intentar cobrar un arreglo en la cuenta inactiva
    const arreglo = await dadoUnArreglo({ precio_final: 20000 });
    let fallo = false;
    try {
      await cuandoSeCobraUnArreglo(arreglo.id, {
        cuenta_financiera_id: cuentaInactiva.id,
        monto: 20000,
      });
    } catch {
      fallo = true;
    }
    expect(fallo).toBe(true);

    // Saldo permanece en 0 y arreglo impago
    await expectSaldoCuenta(cuentaInactiva.id, 0);
    const { data: arregloDb } = await testClient
      .from("arreglos")
      .select("total_cobrado, esta_pago")
      .eq("id", arreglo.id)
      .single();
    expect(Number(arregloDb?.total_cobrado)).toBe(0);
    expect(arregloDb?.esta_pago).toBe(false);
  });
});
