import { describe, expect, it } from "vitest";
import { SEED } from "@/tests/integration";
import {
  dadoUnClienteParticularConVehiculo,
  dadoUnArreglo,
  dadoUnaCuentaFinanciera,
  cuandoSeCobraUnArreglo,
} from "../helpers/integrationFixtures";
import {
  crearOperacionViaRoute,
  registrarPagoOperacionViaRoute,
  anularPagoOperacionViaRoute,
  anularCobroArregloViaRoute,
  borrarArregloViaRoute,
  borrarOperacionViaRoute,
  getClienteCuentaCorrienteViaRoute,
  getClienteResumenFinancieroViaRoute,
  getProveedorOperacionesViaRoute,
  crearProveedorViaRoute,
} from "../helpers/routeDrivers";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";

/**
 * Harness de Finanzas: Impacto en Cuenta Corriente y Saldos de Clientes y Proveedores.
 * Cubre Arreglos, Ventas, Compras y sus reversiones (anulación y borrado).
 */

describe("Integration: Finanzas - Cuenta Corriente del Cliente (Arreglos)", () => {
  it("un arreglo terminado incrementa la deuda del cliente y un cobro parcial la reduce", async () => {
    const { cliente, vehiculo } = await dadoUnClienteParticularConVehiculo();
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 0 });

    // 1. Arreglo terminado por $80.000
    const arreglo = await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 80000,
      total_cobrado: 0,
      esta_pago: false,
      descripcion: "Cambio de embrague",
    });

    // Validar resumen financiero: deuda = $80.000
    const resResumen1 = await getClienteResumenFinancieroViaRoute(cliente.id);
    const { data: resumen1 } = await resResumen1.json();
    expect(Number(resumen1.saldo_cuenta)).toBe(80000);

    // Validar libro de cuenta corriente: 1 débito por $80.000
    const resCC1 = await getClienteCuentaCorrienteViaRoute(cliente.id);
    const { data: cc1 } = await resCC1.json();
    expect(cc1).toHaveLength(1);
    expect(cc1[0].tipo_movimiento).toBe("CARGO_ARREGLO");
    expect(Number(cc1[0].debito)).toBe(80000);
    expect(Number(cc1[0].credito)).toBe(0);

    // 2. Cobro parcial de $30.000
    const detalleCobro = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 30000,
      descripcion: "Anticipo",
    });
    const cobroOpId = detalleCobro?.cobros?.[0]?.operacion_id;
    expect(cobroOpId).toBeDefined();

    // Deuda se reduce a $50.000
    const resResumen2 = await getClienteResumenFinancieroViaRoute(cliente.id);
    const { data: resumen2 } = await resResumen2.json();
    expect(Number(resumen2.saldo_cuenta)).toBe(50000);

    // Cuenta corriente tiene 2 movimientos: Débito $80.000 y Crédito $30.000
    const resCC2 = await getClienteCuentaCorrienteViaRoute(cliente.id);
    const { data: cc2 } = await resCC2.json();
    expect(cc2).toHaveLength(2);
    const movCobro = cc2.find((m: { tipo_movimiento: string }) => m.tipo_movimiento === "COBRO");
    expect(Number(movCobro?.credito)).toBe(30000);
  });

  it("anular el cobro del arreglo reabre la deuda en la cuenta corriente del cliente", async () => {
    const { cliente, vehiculo } = await dadoUnClienteParticularConVehiculo();
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 0 });

    const arreglo = await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 60000,
    });

    const detalleCobro = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 60000,
    });
    const cobroOpId = detalleCobro?.cobros?.[0]?.operacion_id ?? "";

    // Totalmente saldado: deuda = 0
    const resResumenAntes = await getClienteResumenFinancieroViaRoute(cliente.id);
    const { data: resumenAntes } = await resResumenAntes.json();
    expect(Number(resumenAntes.saldo_cuenta)).toBe(0);

    // Anular el cobro
    await anularCobroArregloViaRoute(arreglo.id, cobroOpId);

    // Deuda reabierta a $60.000
    const resResumenDespues = await getClienteResumenFinancieroViaRoute(cliente.id);
    const { data: resumenDespues } = await resResumenDespues.json();
    expect(Number(resumenDespues.saldo_cuenta)).toBe(60000);
  });

  it("borrar el arreglo elimina su cargo de la cuenta corriente del cliente", async () => {
    const { cliente, vehiculo } = await dadoUnClienteParticularConVehiculo();

    const arreglo = await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 40000,
    });

    // Borrar el arreglo
    const borrarRes = await borrarArregloViaRoute(arreglo.id);
    expect(borrarRes.status).toBe(200);

    // Cuenta corriente y resumen financiero vuelven a cero
    const resCC = await getClienteCuentaCorrienteViaRoute(cliente.id);
    const { data: cc } = await resCC.json();
    expect(cc).toHaveLength(0);

    const resResumen = await getClienteResumenFinancieroViaRoute(cliente.id);
    const { data: resumen } = await resResumen.json();
    expect(Number(resumen.saldo_cuenta)).toBe(0);
  });
});

describe("Integration: Finanzas - Cuenta Corriente del Cliente (Ventas)", () => {
  it("venta parcial registra deuda en el resumen del cliente y segundo pago la salda", async () => {
    const { cliente } = await dadoUnClienteParticularConVehiculo();
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 0 });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 5000 },
    });

    // Venta de $15.000 con pago inicial de $5.000 (deuda pendiente $10.000)
    const res = await crearOperacionViaRoute({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: cliente.id,
      lineas: [{ stock_id: stockId, cantidad: 3, monto_unitario: 5000, delta_cantidad: -3 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 5000 }],
    });
    const { data: op } = await res.json();

    const resResumen1 = await getClienteResumenFinancieroViaRoute(cliente.id);
    const { data: resumen1 } = await resResumen1.json();
    expect(Number(resumen1.saldo_cuenta)).toBe(10000);

    // Segundo pago que cancela los $10.000 restantes
    await registrarPagoOperacionViaRoute(op.id, {
      cuenta_id: cuenta.id,
      monto: 10000,
    });

    const resResumen2 = await getClienteResumenFinancieroViaRoute(cliente.id);
    const { data: resumen2 } = await resResumen2.json();
    expect(Number(resumen2.saldo_cuenta)).toBe(0);
  });

  it("borrar la venta revierte completamente el impacto en la cuenta del cliente", async () => {
    const { cliente } = await dadoUnClienteParticularConVehiculo();
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 0 });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 5000 },
    });

    const res = await crearOperacionViaRoute({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: cliente.id,
      lineas: [{ stock_id: stockId, cantidad: 2, monto_unitario: 5000, delta_cantidad: -2 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 3000 }],
    });
    const { data: op } = await res.json();

    // Borrar la venta vía route
    const borrarRes = await borrarOperacionViaRoute(op.id);
    expect(borrarRes.status).toBe(200);

    // Resumen del cliente limpio
    const resResumen = await getClienteResumenFinancieroViaRoute(cliente.id);
    const { data: resumen } = await resResumen.json();
    expect(Number(resumen.saldo_cuenta)).toBe(0);
  });
});

describe("Integration: Finanzas - Cuenta Corriente del Proveedor (Compras)", () => {
  it("compra impaga incrementa total comprado y saldo adeudado del proveedor", async () => {
    const provRes = await crearProveedorViaRoute({
      nombre: `Proveedor Test ${crypto.randomUUID().slice(0, 6)}`,
      cuit: "30-11223344-9",
    });
    const { data: prov } = await provRes.json();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
      producto: { precio_unitario: 2500 },
    });

    // Compra de $25.000 sin pago inicial (impaga)
    const compRes = await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      proveedor_id: prov.id,
      estado_pago: "PENDIENTE",
      lineas: [{ stock_id: stockId, cantidad: 10, monto_unitario: 2500, delta_cantidad: 10 }],
      pagos: [],
    });
    expect(compRes.status).toBe(201);

    const resCC = await getProveedorOperacionesViaRoute(prov.id);
    const { data: cc } = await resCC.json();
    expect(Number(cc.totalComprado)).toBe(25000);
    expect(Number(cc.totalPagado)).toBe(0);
    expect(Number(cc.saldoAdeudado)).toBe(25000);
    expect(cc.operaciones).toHaveLength(1);
    expect(cc.operaciones[0].estado_pago).toBe("PENDIENTE");
  });

  it("pago a proveedor disminuye el saldo adeudado y anulación de pago lo restaura", async () => {
    const provRes = await crearProveedorViaRoute({
      nombre: `Proveedor Test ${crypto.randomUUID().slice(0, 6)}`,
    });
    const { data: prov } = await provRes.json();
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 50000 });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
      producto: { precio_unitario: 1000 },
    });

    // Compra de $10.000 con pago inicial de $4.000
    const compRes = await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      proveedor_id: prov.id,
      lineas: [{ stock_id: stockId, cantidad: 10, monto_unitario: 1000, delta_cantidad: 10 }],
      pagos: [{ cuenta_id: cuenta.id, monto: 4000 }],
    });
    const { data: op } = await compRes.json();

    // Estado inicial: comprado 10.000, pagado 4.000, adeudado 6.000
    const cc1 = await (await getProveedorOperacionesViaRoute(prov.id)).json();
    expect(Number(cc1.data.totalComprado)).toBe(10000);
    expect(Number(cc1.data.totalPagado)).toBe(4000);
    expect(Number(cc1.data.saldoAdeudado)).toBe(6000);

    // Segundo pago de $6.000 que cancela la compra
    const pagoRes = await registrarPagoOperacionViaRoute(op.id, {
      cuenta_id: cuenta.id,
      monto: 6000,
    });
    const { data: pagoData } = await pagoRes.json();
    const pagoId = pagoData.pago_id ?? pagoData.id;

    // Estado cancelado: saldo adeudado 0
    const cc2 = await (await getProveedorOperacionesViaRoute(prov.id)).json();
    expect(Number(cc2.data.totalPagado)).toBe(10000);
    expect(Number(cc2.data.saldoAdeudado)).toBe(0);

    // Anular el pago de $6.000
    await anularPagoOperacionViaRoute(op.id, pagoId);

    // Saldo adeudado vuelve a $6.000
    const cc3 = await (await getProveedorOperacionesViaRoute(prov.id)).json();
    expect(Number(cc3.data.totalPagado)).toBe(4000);
    expect(Number(cc3.data.saldoAdeudado)).toBe(6000);
  });

  it("borrar la compra elimina la deuda y las operaciones asociadas al proveedor", async () => {
    const provRes = await crearProveedorViaRoute({
      nombre: `Proveedor Test ${crypto.randomUUID().slice(0, 6)}`,
    });
    const { data: prov } = await provRes.json();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
      producto: { precio_unitario: 3000 },
    });

    const compRes = await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      proveedor_id: prov.id,
      estado_pago: "PENDIENTE",
      lineas: [{ stock_id: stockId, cantidad: 5, monto_unitario: 3000, delta_cantidad: 5 }],
      pagos: [],
    });
    expect(compRes.status).toBe(201);
    const { data: op } = await compRes.json();

    // Borrar la compra
    const borrarRes = await borrarOperacionViaRoute(op.id);
    expect(borrarRes.status).toBe(200);

    // Proveedor vuelve a estado limpio sin compras ni deuda
    const cc = await (await getProveedorOperacionesViaRoute(prov.id)).json();
    expect(Number(cc.data.totalComprado)).toBe(0);
    expect(Number(cc.data.totalPagado)).toBe(0);
    expect(Number(cc.data.saldoAdeudado)).toBe(0);
    expect(cc.data.operaciones).toHaveLength(0);
  });
});
