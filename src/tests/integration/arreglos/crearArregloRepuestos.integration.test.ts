import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { supabaseArregloRepository } from "@/app/api/arreglos/arregloRepository";
import { arregloCompletoService } from "@/app/api/arreglos/arregloCompletoService";
import { testClient, SEED } from "@/tests/integration";
import { createCreateArregloRequest } from "@/tests/factories";
import { dadoUnaCuentaFinanciera, expectSaldoCuenta } from "../helpers/integrationFixtures";
import {
  dadoQueExisteUnProductoConStock,
  expectCantidadDeStock,
} from "../helpers/stockHelpers";
import {
  postArregloAndGetId,
  callPostArreglo,
  deleteRepuestoLinea,
  dadoQueExisteUnArregloConRepuesto,
  expectArregloSinRepuestos,
} from "./arreglosHelpers";

interface CompraRegistrada {
  operacionId: string;
  stockId: string;
  cantidad: number;
  movimientoStock: number;
  pago: {
    importe: number;
    idempotencyKey: string | null;
    cuentaId: string;
  } | null;
}

async function obtenerComprasRegistradas(stockIds: string[]): Promise<CompraRegistrada[]> {
  const { data: lineas, error: lineasError } = await testClient
    .from("operaciones_lineas")
    .select("operacion_id, stock_id")
    .in("stock_id", stockIds);
  expect(lineasError).toBeNull();

  const operacionIds = [...new Set((lineas ?? []).map((linea) => linea.operacion_id))];
  if (operacionIds.length === 0) return [];

  const { data: operaciones, error: operacionesError } = await testClient
    .from("operaciones")
    .select("id, tipo")
    .in("id", operacionIds);
  expect(operacionesError).toBeNull();

  const compras = (operaciones ?? []).filter((operacion) => operacion.tipo === "COMPRA");
  const compraIds = compras.map((compra) => compra.id);
  if (compraIds.length === 0) return [];

  const [lineasCompraResult, movimientosStockResult, pagosResult] = await Promise.all([
    testClient
      .from("operaciones_lineas")
      .select("operacion_id, stock_id, cantidad")
      .in("operacion_id", compraIds),
    testClient
      .from("operaciones_movimiento_stock")
      .select("operacion_id, stock_id, cantidad")
      .in("operacion_id", compraIds),
    testClient
      .from("operaciones_movimiento_cuenta")
      .select("operacion_id, importe, idempotency_key, cuenta_id")
      .in("operacion_id", compraIds),
  ]);

  expect(lineasCompraResult.error).toBeNull();
  expect(movimientosStockResult.error).toBeNull();
  expect(pagosResult.error).toBeNull();

  return compras.map((compra) => {
    const linea = lineasCompraResult.data?.find((item) => item.operacion_id === compra.id);
    const movimientoStock = movimientosStockResult.data?.find(
      (item) => item.operacion_id === compra.id
    );
    const pago = pagosResult.data?.find((item) => item.operacion_id === compra.id);
    expect(linea).toBeDefined();
    expect(movimientoStock).toBeDefined();

    return {
      operacionId: compra.id,
      stockId: linea!.stock_id,
      cantidad: linea!.cantidad,
      movimientoStock: movimientoStock!.cantidad,
      pago: pago
        ? {
            importe: Number(pago.importe),
            idempotencyKey: pago.idempotency_key,
            cuentaId: pago.cuenta_id,
          }
        : null,
    };
  });
}

describe("Integration - Creación de arreglos", () => {
  it("Crea un arreglo persistiendo los datos especificados", async () => {
    const precioFinal = 15000;

    const arregloId = await postArregloAndGetId(
      createCreateArregloRequest({
        vehiculo_id: SEED.vehiculoId,
        taller_id: SEED.tallerId,
        estado: "SIN_INICIAR",
        kilometraje_leido: 52000,
        fecha: "2026-09-05",
        observaciones: "Test de integración creación de arreglo",
        precio_final: precioFinal,
        detalles: [{
          descripcion: "Mano de obra",
          cantidad: 1,
          precio_hora_facturada: precioFinal,
          horas_facturadas: 1,
          horas_trabajadas: 1,
        }],
        esta_pago: false,
      })
    );

    const { data: arregloCreado } = await supabaseArregloRepository.getByIdWithVehiculo(
      testClient,
      arregloId
    );

    expect(arregloCreado).toMatchObject({
      taller_id: SEED.tallerId,
      estado: "SIN_INICIAR",
      kilometraje_leido: 52000,
      esta_pago: false,
      observaciones: "Test de integración creación de arreglo",
    });
    expect(Number(arregloCreado?.precio_final)).toBe(precioFinal);
  });

  it("Cuando se utilizan repuestos en un arreglo, se asigna el repuesto y se descuenta el stock", async () => {
    const stockAUsar = 3;
    const precioUnitario = 6500;
    const precioFinalTotal = stockAUsar * precioUnitario; // 19500
    const cantidadInicial = 200;

    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: cantidadInicial, taller_id: SEED.tallerId },
    });

    const arregloId = await postArregloAndGetId(
      createCreateArregloRequest({
        vehiculo_id: SEED.vehiculoId,
        taller_id: SEED.tallerId,
        precio_final: precioFinalTotal,
        repuestos: [{ stock_id: stockId, cantidad: stockAUsar, monto_unitario: precioUnitario }],
      })
    );

    await expectCantidadDeStock(stockId, cantidadInicial - stockAUsar);

    const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
      testClient,
      arregloId
    );

    expect(detalle?.asignaciones).toHaveLength(1);
    expect(detalle?.asignaciones[0]).toMatchObject({
      tipo: "ASIGNACION_ARREGLO",
      lineas: [
        expect.objectContaining({
          stock_id: stockId,
          cantidad: stockAUsar,
          monto_unitario: precioUnitario,
        }),
      ],
    });
  });

  it("compra cada faltante de varios repuestos y conserva una clave distinta por compra", async () => {
    const saldoInicial = 50000;
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial });
    const { stockId: stockA } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 1, taller_id: SEED.tallerId },
    });
    const { stockId: stockB } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
    });
    const idempotencyKey = randomUUID();

    const response = await callPostArreglo(
      createCreateArregloRequest({
        vehiculo_id: SEED.vehiculoId,
        taller_id: SEED.tallerId,
        estado: "SIN_INICIAR",
        cuenta_financiera_id: cuenta.id,
        idempotency_key: idempotencyKey,
        repuestos: [
          { stock_id: stockA, cantidad: 3, monto_unitario: 5000, precio_compra: 1200 },
          { stock_id: stockB, cantidad: 2, monto_unitario: 4000, precio_compra: 2500 },
        ],
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    const arregloId = String(body.data?.id);
    const { data: detalle, error: detalleError } = await arregloCompletoService.getArregloDetalleCompleto(
      testClient,
      arregloId
    );
    expect(detalleError).toBeNull();
    const asignaciones = detalle?.asignaciones.flatMap((asignacion) => asignacion.lineas) ?? [];
    expect(asignaciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stock_id: stockA, cantidad: 3 }),
        expect.objectContaining({ stock_id: stockB, cantidad: 2 }),
      ])
    );
    await expectCantidadDeStock(stockA, 0);
    await expectCantidadDeStock(stockB, 0);

    const compras = await obtenerComprasRegistradas([stockA, stockB]);
    expect(compras).toHaveLength(2);
    expect(compras.map((compra) => [compra.stockId, compra.cantidad, compra.movimientoStock])).toEqual(
      expect.arrayContaining([
        [stockA, 2, 2],
        [stockB, 2, 2],
      ])
    );
    const clavesDePago = compras.map((compra) => compra.pago?.idempotencyKey);
    expect(clavesDePago.every((key) => typeof key === "string")).toBe(true);
    expect(new Set(clavesDePago).size).toBe(2);
    expect(clavesDePago).not.toContain(idempotencyKey);
    expect(compras.map((compra) => compra.pago?.importe).sort((a, b) => a! - b!)).toEqual([
      -5000,
      -2400,
    ]);
    await expectSaldoCuenta(cuenta.id, saldoInicial - 7400);
  });

  it.each([1, 2])(
    "registra el cobro inicial aparte de las compras automáticas (%i faltante/s)",
    async (cantidadFaltantes) => {
      const saldoInicial = 100000;
      const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial });
      const stocks: Array<{ stockId: string; cantidad: number; costo: number; precio: number }> = [];

      for (let index = 0; index < cantidadFaltantes; index += 1) {
        const { stockId } = await dadoQueExisteUnProductoConStock({
          stock: { cantidad: 0, taller_id: SEED.tallerId },
        });
        stocks.push({
          stockId,
          cantidad: index + 1,
          costo: 1000 * (index + 1),
          precio: 5000 * (index + 1),
        });
      }

      const idempotencyKey = randomUUID();
      const response = await callPostArreglo(
        createCreateArregloRequest({
          vehiculo_id: SEED.vehiculoId,
          taller_id: SEED.tallerId,
          estado: "SIN_INICIAR",
          esta_pago: true,
          cuenta_financiera_id: cuenta.id,
          idempotency_key: idempotencyKey,
          repuestos: stocks.map(({ stockId, cantidad, costo, precio }) => ({
            stock_id: stockId,
            cantidad,
            monto_unitario: precio,
            precio_compra: costo,
          })),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      const arregloId = String(body.data?.id);
      const { data: arreglo, error: arregloError } = await testClient
        .from("arreglos")
        .select("precio_final, total_cobrado, esta_pago")
        .eq("id", arregloId)
        .single();
      expect(arregloError).toBeNull();
      expect(arreglo?.esta_pago).toBe(true);
      expect(Number(arreglo?.total_cobrado)).toBe(Number(arreglo?.precio_final));

      const stockIds = stocks.map((stock) => stock.stockId);
      const compras = await obtenerComprasRegistradas(stockIds);
      expect(compras).toHaveLength(cantidadFaltantes);
      expect(compras.map((compra) => compra.cantidad).sort((a, b) => a - b)).toEqual(
        stocks.map((stock) => stock.cantidad).sort((a, b) => a - b)
      );
      const clavesCompras = compras.map((compra) => compra.pago?.idempotencyKey);
      expect(clavesCompras.every((key) => typeof key === "string")).toBe(true);
      expect(new Set(clavesCompras).size).toBe(cantidadFaltantes);
      expect(clavesCompras).not.toContain(idempotencyKey);

      const { data: cobro, error: cobroError } = await testClient
        .from("operaciones_movimiento_cuenta")
        .select("operacion_id, importe, idempotency_key")
        .eq("idempotency_key", idempotencyKey)
        .single();
      expect(cobroError).toBeNull();
      expect(cobro?.idempotency_key).toBe(idempotencyKey);
      expect(compras.map((compra) => compra.operacionId)).not.toContain(cobro?.operacion_id);
      expect(Number(cobro?.importe)).toBe(Number(arreglo?.precio_final));

      const costoTotal = stocks.reduce((total, stock) => total + stock.costo * stock.cantidad, 0);
      for (const stock of stocks) await expectCantidadDeStock(stock.stockId, 0);
      const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
        testClient,
        arregloId
      );
      const asignaciones = detalle?.asignaciones.flatMap((asignacion) => asignacion.lineas) ?? [];
      expect(asignaciones).toHaveLength(cantidadFaltantes);
      for (const stock of stocks) {
        expect(asignaciones).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ stock_id: stock.stockId, cantidad: stock.cantidad }),
          ])
        );
      }
      await expectSaldoCuenta(
        cuenta.id,
        saldoInicial - costoTotal + Number(arreglo?.precio_final)
      );
    }
  );

  it("compra primero con costo, luego repone sin costo y omite el repuesto que ya tiene stock", async () => {
    const saldoInicial = 50000;
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial });
    const { stockId: stockConCosto } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
    });
    const { stockId: stockBonificado } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
    });
    const { stockId: stockSuficiente } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 6, taller_id: SEED.tallerId },
    });
    const idempotencyKey = randomUUID();

    const response = await callPostArreglo(
      createCreateArregloRequest({
        vehiculo_id: SEED.vehiculoId,
        taller_id: SEED.tallerId,
        estado: "SIN_INICIAR",
        cuenta_financiera_id: cuenta.id,
        idempotency_key: idempotencyKey,
        repuestos: [
          { stock_id: stockConCosto, cantidad: 2, monto_unitario: 5000, precio_compra: 1200 },
          { stock_id: stockBonificado, cantidad: 3, monto_unitario: 2500, precio_compra: 0 },
          { stock_id: stockSuficiente, cantidad: 2, monto_unitario: 1800, precio_compra: 0 },
        ],
      })
    );

    expect(response.status).toBe(201);
    const compras = await obtenerComprasRegistradas([stockConCosto, stockBonificado, stockSuficiente]);
    expect(compras).toHaveLength(2);
    expect(compras.map((compra) => [compra.stockId, compra.cantidad, compra.movimientoStock])).toEqual(
      expect.arrayContaining([
        [stockConCosto, 2, 2],
        [stockBonificado, 3, 3],
      ])
    );
    const pagos = compras.flatMap((compra) => (compra.pago ? [compra.pago] : []));
    expect(pagos).toHaveLength(1);
    expect(pagos[0].importe).toBe(-2400);
    expect(pagos[0].idempotencyKey).not.toBe(idempotencyKey);
    await expectCantidadDeStock(stockConCosto, 0);
    await expectCantidadDeStock(stockBonificado, 0);
    await expectCantidadDeStock(stockSuficiente, 4);
    await expectSaldoCuenta(cuenta.id, saldoInicial - 2400);
  });

  it("no crea compras cuando todos los repuestos tienen stock suficiente", async () => {
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 8, taller_id: SEED.tallerId },
    });

    const response = await callPostArreglo(
      createCreateArregloRequest({
        vehiculo_id: SEED.vehiculoId,
        taller_id: SEED.tallerId,
        estado: "SIN_INICIAR",
        repuestos: [{ stock_id: stockId, cantidad: 3, monto_unitario: 4000 }],
      })
    );

    expect(response.status).toBe(201);
    expect(await obtenerComprasRegistradas([stockId])).toEqual([]);
    await expectCantidadDeStock(stockId, 5);
  });

  it("revierte el alta y sus movimientos si falta el costo de compra de un faltante posterior", async () => {
    const saldoInicial = 40000;
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial });
    const { stockId: stockValido } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
    });
    const { stockId: stockSinCosto } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 0, taller_id: SEED.tallerId },
    });
    const observaciones = `rollback compras ${randomUUID()}`;
    const stockIds = [stockValido, stockSinCosto];

    const { data: pagosAntes, error: pagosAntesError } = await testClient
      .from("operaciones_movimiento_cuenta")
      .select("id")
      .eq("cuenta_id", cuenta.id);
    const { data: asientosAntes, error: asientosAntesError } = await testClient
      .from("movimientos_financieros")
      .select("id")
      .eq("cuenta_financiera_id", cuenta.id);
    expect(pagosAntesError).toBeNull();
    expect(asientosAntesError).toBeNull();

    const response = await callPostArreglo(
      createCreateArregloRequest({
        vehiculo_id: SEED.vehiculoId,
        taller_id: SEED.tallerId,
        estado: "SIN_INICIAR",
        observaciones,
        cuenta_financiera_id: cuenta.id,
        idempotency_key: randomUUID(),
        repuestos: [
          { stock_id: stockValido, cantidad: 2, monto_unitario: 5000, precio_compra: 1500 },
          { stock_id: stockSinCosto, cantidad: 1, monto_unitario: 3000 },
        ],
      })
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("No se pudieron guardar los repuestos.");

    const { data: arreglos, error: arreglosError } = await testClient
      .from("arreglos")
      .select("id")
      .eq("observaciones", observaciones);
    const { data: lineas, error: lineasError } = await testClient
      .from("operaciones_lineas")
      .select("id")
      .in("stock_id", stockIds);
    const { data: movimientosStock, error: movimientosStockError } = await testClient
      .from("operaciones_movimiento_stock")
      .select("id")
      .in("stock_id", stockIds);
    const { data: ledgerStock, error: ledgerStockError } = await testClient
      .from("movimientos_stock")
      .select("id")
      .in("stock_id", stockIds);
    const { data: pagosDespues, error: pagosDespuesError } = await testClient
      .from("operaciones_movimiento_cuenta")
      .select("id")
      .eq("cuenta_id", cuenta.id);
    const { data: asientosDespues, error: asientosDespuesError } = await testClient
      .from("movimientos_financieros")
      .select("id")
      .eq("cuenta_financiera_id", cuenta.id);

    expect(arreglosError).toBeNull();
    expect(lineasError).toBeNull();
    expect(movimientosStockError).toBeNull();
    expect(ledgerStockError).toBeNull();
    expect(pagosDespuesError).toBeNull();
    expect(asientosDespuesError).toBeNull();
    expect(arreglos).toEqual([]);
    expect(lineas).toEqual([]);
    expect(movimientosStock).toEqual([]);
    expect(ledgerStock).toEqual([]);
    expect(pagosDespues).toHaveLength(pagosAntes?.length ?? 0);
    expect(asientosDespues).toHaveLength(asientosAntes?.length ?? 0);
    await expectCantidadDeStock(stockValido, 0);
    await expectCantidadDeStock(stockSinCosto, 0);
    await expectSaldoCuenta(cuenta.id, saldoInicial);
  });

  it("Cuando se elimina un repuesto de un arreglo, se revierte la asignación y devuelve el item al stock total", async () => {
    const { arregloId, stockId, lineaId, cantidadInicial } = await dadoQueExisteUnArregloConRepuesto({
      stock: { cantidad: 200, taller_id: SEED.tallerId },
      repuesto: { cantidad: 3, monto_unitario: 6500 },
    });

    const deleteResponse = await deleteRepuestoLinea(arregloId, lineaId);
    expect(deleteResponse.error).toBeNull();

    await expectCantidadDeStock(stockId, cantidadInicial);
    await expectArregloSinRepuestos(arregloId);
  });
});
