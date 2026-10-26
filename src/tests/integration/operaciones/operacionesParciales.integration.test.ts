import { describe, it, expect } from "vitest";
import { testClient, SEED } from "@/tests/integration";
import {
  dadoUnProveedor,
  dadoUnClienteParticularConVehiculo,
  dadoUnaCuentaFinanciera,
  expectSaldoCuenta,
  expectStockDetallado,
} from "../helpers/integrationFixtures";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";
import {
  crearOperacionViaRoute,
  registrarPagoOperacionViaRoute,
  confirmarStockOperacionViaRoute,
  getProveedorOperacionesViaRoute,
  getClienteCuentaCorrienteViaRoute,
  getClienteResumenFinancieroViaRoute,
} from "../helpers/routeDrivers";
import { clienteFinanzasService } from "@/app/api/clientes/clienteFinanzasService";

describe("Integration: Operaciones Parciales (Ventas y Compras)", () => {
  describe("Venta Parcial", () => {
    it("al realizar una venta con entrega parcial y cobro parcial, afecta a la cuenta corriente del cliente, a la cuenta financiera del taller y al stock de forma parcial", async () => {
      // 1. GIVEN:
      // - Cliente registrado con vehículo
      // - Cuenta bancaria del taller con saldo inicial de $200.000
      // - Stock con 20 unidades físicas disponibles en el taller
      const { cliente } = await dadoUnClienteParticularConVehiculo();
      const cuentaTaller = await dadoUnaCuentaFinanciera({
        nombre: "Banco Taller Ventas",
        tipo: "CUENTA_BANCARIA",
        saldoInicial: 200000,
      });

      const { stockId } = await dadoQueExisteUnProductoConStock({
        stock: { cantidad: 20, taller_id: SEED.tallerId },
        producto: { precio_unitario: 10000 },
      });

      // Verificamos estado inicial del stock (20 físicas, 0 reservadas, 0 pendientes)
      await expectStockDetallado(stockId, {
        cantidad: 20,
        cantidad_reservada: 0,
        cantidad_pendiente: 0,
      });

      // 2. WHEN:
      // Se genera una Venta por 10 unidades a $10.000 c/u = $100.000 total.
      // - Entrega parcial: se entregan 6 unidades inmediatamente (quedan 4 pendientes de entrega/reservadas).
      // - Cobro parcial: se cobran $40.000 en la cuenta del taller (queda saldo pendiente de $60.000).
      const idempotencyKey = crypto.randomUUID();
      const montoTotalEsperado = 100000;
      const montoCobrado = 40000;
      const saldoPendienteEsperado = 60000;
      const cantidadTotal = 10;
      const cantidadEntregada = 6;
      const cantidadReservadaEsperada = 4;

      const resVenta = await crearOperacionViaRoute({
        tipo: "VENTA",
        taller_id: SEED.tallerId,
        cliente_id: cliente.id,
        observaciones: "Venta con cobro y entrega parcial de repuestos",
        lineas: [
          {
            stock_id: stockId,
            cantidad: cantidadTotal,
            cantidad_cumplida: cantidadEntregada,
            monto_unitario: 10000,
            delta_cantidad: -cantidadTotal,
          },
        ],
        pagos: [
          {
            cuenta_id: cuentaTaller.id,
            monto: montoCobrado,
            descripcion: "Anticipo 40% venta",
          },
        ],
      });

      // 3. THEN: Operación creada con status 201
      expect(resVenta.status).toBe(201);
      const { data: operacion } = await resVenta.json();
      expect(operacion).toBeDefined();
      expect(operacion.id).toBeDefined();
      expect(operacion.tipo).toBe("VENTA");
      expect(operacion.cliente_id).toBe(cliente.id);
      expect(operacion.monto_total).toBe(montoTotalEsperado);
      expect(operacion.total_pagado).toBe(montoCobrado);
      expect(operacion.saldo_pendiente).toBe(saldoPendienteEsperado);
      expect(operacion.estado_pago).toBe("PARCIAL");
      expect(operacion.estado_stock).toBe("PARCIAL");

      // 4. ASSERT: Afectación de la Cuenta Financiera del Taller
      // El taller cobró $40.000 -> Saldo inicial 200.000 + 40.000 = 240.000
      await expectSaldoCuenta(cuentaTaller.id, 240000);

      // 5. ASSERT: Afectación del Stock de forma parcial
      // - Stock físico baja de 20 a 14 (las 6 unidades entregadas al cliente).
      // - Stock reservado sube de 0 a 4 (las 4 unidades comprometidas que restan entregar).
      // - Stock disponible real: 14 - 4 = 10 unidades.
      await expectStockDetallado(stockId, {
        cantidad: 14,
        cantidad_reservada: cantidadReservadaEsperada,
        cantidad_pendiente: 0,
      });

      // 6. ASSERT: Afectación de la Cuenta Corriente del Cliente
      // Consultamos tanto por API route como por clienteFinanzasService
      const resCcRoute = await getClienteCuentaCorrienteViaRoute(cliente.id);
      expect(resCcRoute.status).toBe(200);
      const { data: movimientos } = await resCcRoute.json();
      expect(movimientos).toBeDefined();
      expect(movimientos.length).toBeGreaterThanOrEqual(2);

      // Debe figurar el Cargo de la Venta (débito $100.000)
      const movCargo = movimientos.find(
        (m: { tipo_movimiento: string; operacion_id: string }) =>
          m.tipo_movimiento === "CARGO_VENTA" && m.operacion_id === operacion.id
      );
      expect(movCargo).toBeDefined();
      expect(Number(movCargo.debito)).toBe(montoTotalEsperado);
      expect(Number(movCargo.credito)).toBe(0);

      // Debe figurar el Cobro registrado en la cuenta del taller (crédito $40.000)
      const movCobro = movimientos.find(
        (m: { tipo_movimiento: string; operacion_id: string }) =>
          m.tipo_movimiento === "COBRO" && m.operacion_id === operacion.id
      );
      expect(movCobro).toBeDefined();
      expect(Number(movCobro.debito)).toBe(0);
      expect(Number(movCobro.credito)).toBe(montoCobrado);

      // El saldo neto deudor del cliente es $60.000
      const totalDebito = movimientos.reduce((acc: number, m: { debito: number }) => acc + Number(m.debito), 0);
      const totalCredito = movimientos.reduce((acc: number, m: { credito: number }) => acc + Number(m.credito), 0);
      expect(totalDebito - totalCredito).toBe(saldoPendienteEsperado);

      // Verificamos el resumen financiero del cliente vía API route
      const resResumen = await getClienteResumenFinancieroViaRoute(cliente.id);
      expect(resResumen.status).toBe(200);
      const { data: resumen } = await resResumen.json();
      expect(resumen).toBeDefined();
      expect(resumen.saldo_cuenta).toBe(saldoPendienteEsperado);
      expect(resumen.total_historico_trabajos).toBe(montoTotalEsperado);
      expect(resumen.total_historico_cobrado).toBe(montoCobrado);
      expect(resumen.cantidad_arreglos_pendientes_pago).toBe(1);

      // 7. FLUJO COMPLEMENTARIO: Regularización total posterior
      // a) Cobro del saldo pendiente ($60.000)
      const resSegundoCobro = await registrarPagoOperacionViaRoute(operacion.id, {
        cuenta_id: cuentaTaller.id,
        monto: saldoPendienteEsperado,
        descripcion: "Cancelación final saldo venta",
      });
      expect(resSegundoCobro.status).toBe(201);

      // La cuenta del taller ahora tiene $300.000 (200k base + 40k anticipo + 60k saldo)
      await expectSaldoCuenta(cuentaTaller.id, 300000);

      // La cuenta del cliente queda completamente saldada (deuda $0)
      const { data: ccFinal } = await clienteFinanzasService.getCuentaCorriente(testClient, cliente.id);
      const totalDebitoFinal = (ccFinal ?? []).reduce((acc, m) => acc + Number(m.debito), 0);
      const totalCreditoFinal = (ccFinal ?? []).reduce((acc, m) => acc + Number(m.credito), 0);
      expect(totalDebitoFinal - totalCreditoFinal).toBe(0);

      // b) Entrega del stock restante (4 unidades)
      const resConfirmarStock = await confirmarStockOperacionViaRoute(operacion.id, {
        lineas: [{ stockId, cantidad: cantidadReservadaEsperada }],
      });
      expect(resConfirmarStock.status).toBe(200);

      // Stock físico final: 14 - 4 = 10 unidades, 0 reservadas
      await expectStockDetallado(stockId, {
        cantidad: 10,
        cantidad_reservada: 0,
        cantidad_pendiente: 0,
      });
    });
  });

  describe("Compra Parcial", () => {
    it("al realizar una compra con recepción parcial y pago parcial, afecta a la cuenta corriente del proveedor, a la cuenta financiera del taller y al stock de forma parcial", async () => {
      // 1. GIVEN:
      // - Proveedor registrado en el sistema
      // - Cuenta bancaria del taller con saldo inicial de $150.000
      // - Stock con 5 unidades físicas iniciales en el taller
      const proveedor = await dadoUnProveedor();
      const cuentaTaller = await dadoUnaCuentaFinanciera({
        nombre: "Banco Taller Compras",
        tipo: "CUENTA_BANCARIA",
        saldoInicial: 150000,
      });

      const { stockId } = await dadoQueExisteUnProductoConStock({
        stock: { cantidad: 5, taller_id: SEED.tallerId },
        producto: { precio_unitario: 8000, costo_unitario: 8000 },
      });

      // Verificamos estado inicial del stock (5 físicas, 0 pendientes, 0 reservadas)
      await expectStockDetallado(stockId, {
        cantidad: 5,
        cantidad_reservada: 0,
        cantidad_pendiente: 0,
      });

      // 2. WHEN:
      // Se genera una Compra por 10 unidades a $8.000 c/u = $80.000 total.
      // - Recepción parcial: se reciben físicamente 4 unidades (quedan 6 pendientes de recepción).
      // - Pago parcial: se pagan $30.000 desde la cuenta del taller (queda una deuda con proveedor de $50.000).
      const idempotencyKey = crypto.randomUUID();
      const montoTotalEsperado = 80000;
      const montoPagado = 30000;
      const saldoAdeudadoEsperado = 50000;
      const cantidadTotal = 10;
      const cantidadRecibida = 4;
      const cantidadPendienteEsperada = 6;

      const resCompra = await crearOperacionViaRoute({
        tipo: "COMPRA",
        taller_id: SEED.tallerId,
        proveedor_id: proveedor.id,
        observaciones: "Compra con pago inicial y recepción parcial de stock",
        lineas: [
          {
            stock_id: stockId,
            cantidad: cantidadTotal,
            cantidad_cumplida: cantidadRecibida,
            monto_unitario: 8000,
            delta_cantidad: cantidadTotal,
          },
        ],
        pagos: [
          {
            cuenta_id: cuentaTaller.id,
            monto: montoPagado,
            descripcion: "Anticipo compra proveedor",
          },
        ],
      });

      // 3. THEN: Operación creada con status 201
      expect(resCompra.status).toBe(201);
      const { data: operacion } = await resCompra.json();
      expect(operacion).toBeDefined();
      expect(operacion.id).toBeDefined();
      expect(operacion.tipo).toBe("COMPRA");
      expect(operacion.proveedor_id).toBe(proveedor.id);
      expect(operacion.monto_total).toBe(montoTotalEsperado);
      expect(operacion.total_pagado).toBe(montoPagado);
      expect(operacion.saldo_pendiente).toBe(saldoAdeudadoEsperado);
      expect(operacion.estado_pago).toBe("PARCIAL");
      expect(operacion.estado_stock).toBe("PARCIAL");

      // 4. ASSERT: Afectación de la Cuenta Financiera del Taller
      // El taller pagó $30.000 -> Saldo inicial 150.000 - 30.000 = 120.000
      await expectSaldoCuenta(cuentaTaller.id, 120000);

      // 5. ASSERT: Afectación del Stock de forma parcial
      // - Stock físico sube de 5 a 9 (las 4 unidades recibidas físicamente del proveedor).
      // - Stock pendiente sube de 0 a 6 (las 6 unidades pendientes de llegar al taller).
      await expectStockDetallado(stockId, {
        cantidad: 9,
        cantidad_pendiente: cantidadPendienteEsperada,
        cantidad_reservada: 0,
      });

      // 6. ASSERT: Afectación de la Cuenta Corriente del Proveedor
      // Consultamos la cuenta corriente del proveedor vía API route
      const resCcProveedor = await getProveedorOperacionesViaRoute(proveedor.id);
      expect(resCcProveedor.status).toBe(200);
      const { data: resumenCc } = await resCcProveedor.json();

      expect(resumenCc).toBeDefined();
      expect(resumenCc.totalComprado).toBe(montoTotalEsperado);
      expect(resumenCc.totalPagado).toBe(montoPagado);
      expect(resumenCc.saldoAdeudado).toBe(saldoAdeudadoEsperado);
      expect(resumenCc.operaciones).toHaveLength(1);

      const opCc = resumenCc.operaciones[0];
      expect(opCc.id).toBe(operacion.id);
      expect(opCc.tipo).toBe("COMPRA");
      expect(opCc.monto_total).toBe(montoTotalEsperado);
      expect(opCc.total_pagado).toBe(montoPagado);
      expect(opCc.saldo_pendiente).toBe(saldoAdeudadoEsperado);
      expect(opCc.estado_pago).toBe("PARCIAL");
      expect(opCc.estado_stock).toBe("PARCIAL");

      // 7. FLUJO COMPLEMENTARIO: Regularización total posterior
      // a) Pago del saldo remanente al proveedor ($50.000)
      const resSegundoPago = await registrarPagoOperacionViaRoute(operacion.id, {
        cuenta_id: cuentaTaller.id,
        monto: saldoAdeudadoEsperado,
        descripcion: "Cancelación final saldo compra",
      });
      expect(resSegundoPago.status).toBe(201);

      // La cuenta del taller ahora tiene $70.000 (150k base - 30k inicial - 50k final)
      await expectSaldoCuenta(cuentaTaller.id, 70000);

      // La cuenta del proveedor queda saldada (saldo adeudado $0)
      const resCcFinal = await getProveedorOperacionesViaRoute(proveedor.id);
      const { data: resumenCcFinal } = await resCcFinal.json();
      expect(resumenCcFinal.saldoAdeudado).toBe(0);
      expect(resumenCcFinal.totalPagado).toBe(montoTotalEsperado);

      // b) Recepción del stock restante (6 unidades)
      const resConfirmarStock = await confirmarStockOperacionViaRoute(operacion.id, {
        lineas: [{ stockId, cantidad: cantidadPendienteEsperada }],
      });
      expect(resConfirmarStock.status).toBe(200);

      // Stock físico final: 9 + 6 = 15 unidades, 0 pendientes
      await expectStockDetallado(stockId, {
        cantidad: 15,
        cantidad_reservada: 0,
        cantidad_pendiente: 0,
      });
    });
  });
});
