import { describe, it, expect } from "vitest";
import { testClient, SEED } from "@/tests/integration";
import {
  dadoUnProveedor,
  dadoUnaCuentaFinanciera,
  expectCantidadDeStock,
  expectSaldoCuenta,
  expectStockDetallado,
} from "../helpers/integrationFixtures";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";
import {
  crearOperacionViaRoute,
  registrarPagoOperacionViaRoute,
  getProveedorOperacionesViaRoute,
} from "../helpers/routeDrivers";
import { operacionesService } from "@/app/api/operaciones/operacionesService";
import { proveedorService } from "@/app/api/proveedores/proveedorService";

describe("Integration: Proveedores - Compras, Pagos y Deuda en Cuenta Corriente", () => {
  it("al generar una operación de compra a crédito, se verifica que figure deuda en la operación y en la cuenta corriente del proveedor", async () => {
    // Given: Un proveedor registrado y un repuesto en el taller con stock inicial de 10 unidades
    const proveedor = await dadoUnProveedor();
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
    });

    // Verificamos que la cuenta corriente inicial del proveedor esté en cero (sin operaciones ni deuda)
    const { data: ccInicial } = await proveedorService.getCuentaCorriente(
      testClient,
      proveedor.id
    );
    expect(ccInicial?.saldoAdeudado).toBe(0);
    expect(ccInicial?.totalComprado).toBe(0);
    expect(ccInicial?.totalPagado).toBe(0);
    expect(ccInicial?.operaciones).toEqual([]);

    // When: Se genera una operación de compra a crédito (estado_pago PENDIENTE) por 5 unidades a $12.000 ($60.000 total)
    const idempotencyKey = crypto.randomUUID();
    const montoUnitario = 12000;
    const cantidad = 5;
    const totalCompraEsperado = montoUnitario * cantidad; // $60.000

    const res = await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      proveedor_id: proveedor.id,
      estado_pago: "PENDIENTE",
      idempotency_key: idempotencyKey,
      observaciones: "Compra de repuestos a plazo proveedor",
      lineas: [
        {
          stock_id: stockId,
          cantidad,
          monto_unitario: montoUnitario,
          delta_cantidad: cantidad,
        },
      ],
    });

    // Then: La API route procesa la compra con status 201
    expect(res.status).toBe(201);
    const body = await res.json();
    const operacionCreada = body.data;
    expect(operacionCreada).toBeDefined();
    expect(operacionCreada.id).toBeDefined();

    // 1. Assert: La operación refleja la deuda generada
    expect(operacionCreada.tipo).toBe("COMPRA");
    expect(operacionCreada.proveedor_id).toBe(proveedor.id);
    expect(operacionCreada.monto_total).toBe(totalCompraEsperado);
    expect(operacionCreada.total_pagado).toBe(0);
    expect(operacionCreada.saldo_pendiente).toBe(totalCompraEsperado);
    expect(operacionCreada.estado_pago).toBe("PENDIENTE");
    expect(operacionCreada.esta_pago).toBe(false);

    // 2. Assert: En la cuenta corriente del proveedor figura la deuda acumulada
    const resCcRoute = await getProveedorOperacionesViaRoute(proveedor.id);
    expect(resCcRoute.status).toBe(200);
    const bodyCc = await resCcRoute.json();
    const resumenCc = bodyCc.data;

    expect(resumenCc).toBeDefined();
    expect(resumenCc.saldoAdeudado).toBe(totalCompraEsperado); // <-- ASSERT CENTRAL: Verificación de deuda
    expect(resumenCc.totalComprado).toBe(totalCompraEsperado);
    expect(resumenCc.totalPagado).toBe(0);
    expect(resumenCc.operaciones).toHaveLength(1);

    const operacionCc = resumenCc.operaciones[0];
    expect(operacionCc.id).toBe(operacionCreada.id);
    expect(operacionCc.tipo).toBe("COMPRA");
    expect(operacionCc.monto_total).toBe(totalCompraEsperado);
    expect(operacionCc.total_pagado).toBe(0);
    expect(operacionCc.saldo_pendiente).toBe(totalCompraEsperado);
    expect(operacionCc.estado_pago).toBe("PENDIENTE");

    // 3. Assert complementario: El stock físico aumentó efectivamente en el taller (10 inicial + 5 ingresadas = 15)
    await expectCantidadDeStock(stockId, 15);
  });

  it("a partir de una operación con deuda, al registrar el pago total, se cancela la deuda y la cuenta corriente queda saldada", async () => {
    // Given: Un proveedor con una compra a crédito por $40.000 y una cuenta financiera con $100.000 disponibles
    const proveedor = await dadoUnProveedor();
    const cuentaFinanciera = await dadoUnaCuentaFinanciera({
      saldoInicial: 100000,
      nombre: "Banco Galicia Tesorería",
    });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 4, taller_id: SEED.tallerId },
    });

    // Se crea la compra con deuda ($40.000 pendiente)
    const montoUnitario = 10000;
    const cantidad = 4;
    const totalCompra = montoUnitario * cantidad; // $40.000

    const resCompra = await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      proveedor_id: proveedor.id,
      estado_pago: "PENDIENTE",
      idempotency_key: crypto.randomUUID(),
      observaciones: "Compra diferida pendiente de pago",
      lineas: [
        {
          stock_id: stockId,
          cantidad,
          monto_unitario: montoUnitario,
          delta_cantidad: cantidad,
        },
      ],
    });
    expect(resCompra.status).toBe(201);
    const { data: compra } = await resCompra.json();
    const operacionId = compra.id;

    // Se constata la deuda pre-existente antes del pago
    const { data: ccPrevia } = await proveedorService.getCuentaCorriente(
      testClient,
      proveedor.id
    );
    expect(ccPrevia?.saldoAdeudado).toBe(totalCompra);

    // When: Se registra el pago por la totalidad de la deuda ($40.000) imputado a la compra
    const idPago = crypto.randomUUID();
    const resPago = await registrarPagoOperacionViaRoute(operacionId, {
      cuenta_id: cuentaFinanciera.id,
      monto: totalCompra,
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: "Cancelación total compra proveedor vía transferencia",
      idempotency_key: idPago,
    });

    // Then: El pago se registra exitosamente con status 201
    expect(resPago.status).toBe(201);
    const bodyPago = await resPago.json();
    expect(bodyPago.data?.ok).toBe(true);
    expect(bodyPago.data?.monto_registrado).toBe(totalCompra);
    expect(bodyPago.data?.saldo_pendiente).toBe(0);
    expect(bodyPago.data?.estado_pago).toBe("PAGADO");

    // 1. Assert: La operación de compra ahora figura como totalmente pagada
    const { data: opActualizada } = await operacionesService.getById(
      testClient,
      operacionId
    );
    expect(opActualizada).toBeDefined();
    expect(opActualizada?.esta_pago).toBe(true);
    expect(opActualizada?.estado_pago).toBe("PAGADO");
    expect(Number(opActualizada?.total_pagado)).toBe(totalCompra);
    expect(Number(opActualizada?.monto_total) - Number(opActualizada?.total_pagado)).toBe(0);

    // 2. Assert: En la cuenta corriente del proveedor, la deuda fue totalmente cancelada ($0 adeudado)
    const resCcRoute = await getProveedorOperacionesViaRoute(proveedor.id);
    expect(resCcRoute.status).toBe(200);
    const bodyCc = await resCcRoute.json();
    const resumenCc = bodyCc.data;

    expect(resumenCc).toBeDefined();
    expect(resumenCc.saldoAdeudado).toBe(0); // <-- ASSERT CENTRAL: Deuda cancelada ($0)
    expect(resumenCc.totalComprado).toBe(totalCompra);
    expect(resumenCc.totalPagado).toBe(totalCompra);
    expect(resumenCc.operaciones).toHaveLength(1);

    const operacionCc = resumenCc.operaciones[0];
    expect(operacionCc.id).toBe(operacionId);
    expect(operacionCc.saldo_pendiente).toBe(0);
    expect(operacionCc.total_pagado).toBe(totalCompra);
    expect(operacionCc.estado_pago).toBe("PAGADO");

    // 3. Assert: La cuenta financiera del taller debitó los $40.000 ($100.000 inicial - $40.000 pago = $60.000)
    await expectSaldoCuenta(cuentaFinanciera.id, 60000);
  });

  it("al generar una operación de compra con pago y recepción parcial, se verifica el impacto en la cuenta corriente del proveedor, cuenta del taller y stock", async () => {
    // Given: Proveedor registrado, cuenta financiera con $80.000 y stock inicial de 6 unidades
    const proveedor = await dadoUnProveedor();
    const cuentaFinanciera = await dadoUnaCuentaFinanciera({
      saldoInicial: 80000,
      nombre: "Caja Chica Taller",
    });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 6, taller_id: SEED.tallerId },
    });

    // When: Se compra 10 unidades a $5.000 ($50.000 total)
    // con pago parcial de $20.000 y recepción física de 4 unidades (6 pendientes)
    const resCompra = await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      proveedor_id: proveedor.id,
      observaciones: "Compra con recepción y pago parcial",
      lineas: [
        {
          stock_id: stockId,
          cantidad: 10,
          cantidad_cumplida: 4,
          monto_unitario: 5000,
          delta_cantidad: 10,
        },
      ],
      pagos: [
        {
          cuenta_id: cuentaFinanciera.id,
          monto: 20000,
          descripcion: "Anticipo 40% compra",
        },
      ],
    });

    // Then: Operación creada con status 201
    expect(resCompra.status).toBe(201);
    const { data: compra } = await resCompra.json();
    expect(compra).toBeDefined();
    expect(compra.tipo).toBe("COMPRA");
    expect(compra.proveedor_id).toBe(proveedor.id);
    expect(compra.monto_total).toBe(50000);
    expect(compra.total_pagado).toBe(20000);
    expect(compra.saldo_pendiente).toBe(30000);
    expect(compra.estado_pago).toBe("PARCIAL");
    expect(compra.estado_stock).toBe("PARCIAL");

    // 1. Assert: La cuenta financiera del taller debitó los $20.000 ($80.000 - $20.000 = $60.000)
    await expectSaldoCuenta(cuentaFinanciera.id, 60000);

    // 2. Assert: El stock físico aumentó en 4 unidades y se registraron 6 pendientes
    await expectStockDetallado(stockId, {
      cantidad: 10, // 6 inicial + 4 recibidas
      cantidad_pendiente: 6, // 10 compradas - 4 recibidas
      cantidad_reservada: 0,
    });

    // 3. Assert: En la cuenta corriente del proveedor figura la deuda parcial ($30.000 adeudado)
    const resCcRoute = await getProveedorOperacionesViaRoute(proveedor.id);
    expect(resCcRoute.status).toBe(200);
    const bodyCc = await resCcRoute.json();
    const resumenCc = bodyCc.data;

    expect(resumenCc).toBeDefined();
    expect(resumenCc.saldoAdeudado).toBe(30000);
    expect(resumenCc.totalComprado).toBe(50000);
    expect(resumenCc.totalPagado).toBe(20000);
    expect(resumenCc.operaciones).toHaveLength(1);

    const operacionCc = resumenCc.operaciones[0];
    expect(operacionCc.id).toBe(compra.id);
    expect(operacionCc.tipo).toBe("COMPRA");
    expect(operacionCc.monto_total).toBe(50000);
    expect(operacionCc.total_pagado).toBe(20000);
    expect(operacionCc.saldo_pendiente).toBe(30000);
    expect(operacionCc.estado_pago).toBe("PARCIAL");
    expect(operacionCc.estado_stock).toBe("PARCIAL");
  });
});

