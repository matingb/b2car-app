import { describe, it, expect } from "vitest";
import { testClient, SEED } from "@/tests/integration";
import { clienteFinanzasService } from "@/app/api/clientes/clienteFinanzasService";
import {
  dadoUnClienteParticularConVehiculo,
  dadoUnArreglo,
  dadoUnaCuentaFinanciera,
  cuandoSeCobraUnArreglo,
  expectSaldoCuenta,
  expectStockDetallado,
} from "../helpers/integrationFixtures";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";
import {
  crearOperacionViaRoute as crearOperacion,
  getClienteCuentaCorrienteViaRoute,
  getClienteResumenFinancieroViaRoute,
} from "../helpers/routeDrivers";
import { operacionesService } from "@/app/api/operaciones/operacionesService";

describe("Integration: Cuenta Corriente del Cliente", () => {
  it("construye el libro mayor con cargos (débitos) y cobros (créditos) respetando saldo acumulado", async () => {
    // Given: Un cliente con un arreglo terminado de $90.000 y un cobro registrado de $35.000
    const { cliente, vehiculo } = await dadoUnClienteParticularConVehiculo();
    const cuenta = await dadoUnaCuentaFinanciera({
      nombre: `Santander`,
      tipo: "CUENTA_BANCARIA",
    });

    const arreglo = await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 90000,
      descripcion: "Alineación y balanceo",
    });

    const detalleArreglo = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 35000,
      fecha_cobro: new Date().toISOString().slice(0, 10),
      descripcion: "Anticipo transferencia",
    });
    const opCobroId = detalleArreglo?.cobros?.[0]?.operacion_id;

    // When: Se consulta la cuenta corriente del cliente mediante el servicio
    const { data: movimientos } = await clienteFinanzasService.getCuentaCorriente(
      testClient,
      cliente.id
    );

    // Then: Movimientos obtenidos exitosamente
    expect(movimientos).toBeDefined();
    expect(movimientos).toHaveLength(2);

    // 1. Validar movimiento de COBRO (crédito)
    const movCobro = movimientos!.find((m) => m.tipo_movimiento === "COBRO");
    expect(movCobro).toBeDefined();
    expect(Number(movCobro?.debito)).toBe(0);
    expect(Number(movCobro?.credito)).toBe(35000);
    expect(movCobro?.arreglo_id).toBe(arreglo.id);
    expect(opCobroId).toBeDefined();
    expect(movCobro?.operacion_id).toBe(opCobroId);
    expect(movCobro?.cuenta_nombre).toBe(cuenta.nombre);

    // 2. Validar movimiento de CARGO_ARREGLO (débito)
    const movCargo = movimientos!.find((m) => m.tipo_movimiento === "CARGO_ARREGLO");
    expect(movCargo).toBeDefined();
    expect(Number(movCargo?.debito)).toBe(90000);
    expect(Number(movCargo?.credito)).toBe(0);
    expect(movCargo?.arreglo_id).toBe(arreglo.id);
    expect(movCargo?.concepto).toContain("Alineación y balanceo");

    // 3. Saldo resultante deudor neto (débito 90.000 - crédito 35.000 = 55.000)
    const totalDebito = movimientos!.reduce((acc, m) => acc + Number(m.debito), 0);
    const totalCredito = movimientos!.reduce((acc, m) => acc + Number(m.credito), 0);
    expect(totalDebito - totalCredito).toBe(55000);
  });

  it("permite filtrar los movimientos de cuenta corriente por rango de fechas (from / to)", async () => {
    // Given: Un cliente con un arreglo registrado hoy
    const { cliente, vehiculo } = await dadoUnClienteParticularConVehiculo();
    await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 45000,
      fecha: new Date().toISOString(),
    });

    // When: Consultamos el servicio con 'from' en el futuro (mañana)
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: movimientosFuturo, error: errFuturo } =
      await clienteFinanzasService.getCuentaCorriente(testClient, cliente.id, {
        from: manana,
      });

    // Then: No debe retornar movimientos fuera de rango
    expect(errFuturo).toBeNull();
    expect(movimientosFuturo).toEqual([]);

    // And When: Consultamos abarcando desde ayer hasta mañana
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: movimientosRango, error: errRango } =
      await clienteFinanzasService.getCuentaCorriente(testClient, cliente.id, {
        from: ayer,
        to: manana,
      });

    // Then: Retorna el movimiento del arreglo
    expect(errRango).toBeNull();
    expect(movimientosRango).toHaveLength(1);
    expect(Number(movimientosRango?.[0].debito)).toBe(45000);
  });

  it("al realizar una venta con cobro y entrega parcial, el resultado afecta a la cuenta del taller y al stock", async () => {
    const saldoInicial = 100000;
    const pagoVenta = 30000;
    const { cliente } = await dadoUnClienteParticularConVehiculo();
    const cuentaTaller = await dadoUnaCuentaFinanciera({
      nombre: "Banco Santander Taller",
      tipo: "CUENTA_BANCARIA",
      saldoInicial,
    });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 15, taller_id: SEED.tallerId },
      producto: { precio_unitario: 10000 },
    });

    const res = await crearOperacion({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: cliente.id,
      observaciones: "Venta parcial a cliente",
      lineas: [
        {
          stock_id: stockId,
          cantidad: 8,
          cantidad_cumplida: 5,
          monto_unitario: 10000,
          delta_cantidad: -8,
        },
      ],
      pagos: [
        {
          cuenta_id: cuentaTaller.id,
          monto: pagoVenta,
          descripcion: "Anticipo venta",
        },
      ],
    });

    const { data: operacion } = await res.json();
    expect(operacion.tipo).toBe("VENTA");
    expect(operacion.cliente_id).toBe(cliente.id);
    expect(operacion.monto_total).toBe(80000);
    expect(operacion.total_pagado).toBe(pagoVenta);
    expect(operacion.saldo_pendiente).toBe(80000 - pagoVenta);
    expect(operacion.estado_pago).toBe("PARCIAL");
    expect(operacion.estado_stock).toBe("PARCIAL");

    // 1. Afectación en cuenta financiera del taller
    await expectSaldoCuenta(cuentaTaller.id, saldoInicial + pagoVenta);

    // 2. Modificación parcial del stock
    await expectStockDetallado(stockId, {
      cantidad: 10,
      cantidad_reservada: 3,
      cantidad_pendiente: 0,
    });
  });

  it("al realizar una venta con cobro parcial, el resultado afecta a la cuenta corriente del cliente y a su resumen financiero", async () => {
    const pagoVenta = 30000;
    const { cliente } = await dadoUnClienteParticularConVehiculo();
    const cuentaTaller = await dadoUnaCuentaFinanciera({
      nombre: "Banco Santander Taller",
      tipo: "CUENTA_BANCARIA",
      saldoInicial: 50000,
    });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 10000 },
    });

    const res = await crearOperacion({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: cliente.id,
      observaciones: "Venta con cobro parcial",
      lineas: [
        {
          stock_id: stockId,
          cantidad: 8,
          cantidad_cumplida: 5,
          monto_unitario: 10000,
          delta_cantidad: -8,
        },
      ],
      pagos: [
        {
          cuenta_id: cuentaTaller.id,
          monto: pagoVenta,
          descripcion: "Anticipo venta",
        },
      ],
    });

    const { data: operacion } = await res.json();

    // 1. Cuenta Corriente del Cliente (cargos y cobros)
    const resCc = await getClienteCuentaCorrienteViaRoute(cliente.id);
    expect(resCc.status).toBe(200);
    const { data: movimientos } = await resCc.json();
    expect(movimientos).toBeDefined();

    const movCargo = movimientos.find(
      (m: { tipo_movimiento: string; operacion_id: string }) =>
        m.tipo_movimiento === "CARGO_VENTA" && m.operacion_id === operacion.id
    );
    expect(movCargo).toBeDefined();
    expect(Number(movCargo.debito)).toBe(80000);
    expect(Number(movCargo.credito)).toBe(0);

    const movCobro = movimientos.find(
      (m: { tipo_movimiento: string; operacion_id: string }) =>
        m.tipo_movimiento === "COBRO" && m.operacion_id === operacion.id
    );
    expect(movCobro).toBeDefined();
    expect(Number(movCobro.debito)).toBe(0);
    expect(Number(movCobro.credito)).toBe(30000);

    const totalDebito = movimientos.reduce((acc: number, m: { debito: number }) => acc + Number(m.debito), 0);
    const totalCredito = movimientos.reduce((acc: number, m: { credito: number }) => acc + Number(m.credito), 0);
    expect(totalDebito - totalCredito).toBe(50000);

    // 2. Resumen financiero del cliente refleja la deuda
    const resResumen = await getClienteResumenFinancieroViaRoute(cliente.id);
    const { data: resumen } = await resResumen.json();
    expect(resumen.saldo_cuenta).toBe(50000);
    expect(resumen.total_historico_trabajos).toBe(80000);
    expect(resumen.total_historico_cobrado).toBe(30000);
    expect(resumen.cantidad_arreglos_pendientes_pago).toBe(1);
  });

  it("al anular un cobro de venta, revierte el saldo de la cuenta financiera y restablece la deuda en la cuenta corriente del cliente", async () => {
    const saldoInicial = 50000;
    const cobroVenta = 30000;
    const { cliente } = await dadoUnClienteParticularConVehiculo();
    const cuentaTaller = await dadoUnaCuentaFinanciera({
      nombre: "Banco Taller Anulacion Cobro",
      tipo: "CUENTA_BANCARIA",
      saldoInicial,
    });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
      producto: { precio_unitario: 10000 },
    });

    const res = await crearOperacion({
      tipo: "VENTA",
      taller_id: SEED.tallerId,
      cliente_id: cliente.id,
      observaciones: "Venta con cobro para anular",
      lineas: [
        {
          stock_id: stockId,
          cantidad: 5,
          cantidad_cumplida: 5,
          monto_unitario: 10000,
          delta_cantidad: -5,
        },
      ],
      pagos: [
        {
          cuenta_id: cuentaTaller.id,
          monto: cobroVenta,
          descripcion: "Anticipo venta",
        },
      ],
    });

    const { data: operacion } = await res.json();
    await expectSaldoCuenta(cuentaTaller.id, saldoInicial + cobroVenta);

    const { data: opConDetalle } = await operacionesService.getById(testClient, operacion.id);
    const pagoId = opConDetalle?.operaciones_pagos?.[0]?.id;
    expect(pagoId).toBeDefined();

    const { data: opActualizada } = await operacionesService.anularPago(
      testClient,
      operacion.id,
      pagoId!
    );

    expect(opActualizada?.monto_total).toBe(50000);
    expect(opActualizada?.total_pagado).toBe(0);
    expect(opActualizada?.esta_pago).toBe(false);
    expect(opActualizada?.estado_pago).toBe("PENDIENTE");

    await expectSaldoCuenta(cuentaTaller.id, saldoInicial);

    const resCc = await getClienteCuentaCorrienteViaRoute(cliente.id);
    const { data: movimientos } = await resCc.json();
    const movCobro = movimientos.find(
      (m: { tipo_movimiento: string; operacion_id: string }) =>
        m.tipo_movimiento === "COBRO" && m.operacion_id === operacion.id
    );
    expect(movCobro).toBeUndefined();

    const totalDebito = movimientos.reduce((acc: number, m: { debito: number }) => acc + Number(m.debito), 0);
    const totalCredito = movimientos.reduce((acc: number, m: { credito: number }) => acc + Number(m.credito), 0);
    expect(totalDebito - totalCredito).toBe(50000);
  });
});


