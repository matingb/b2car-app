import { describe, it, expect } from "vitest";
import { testClient, SEED } from "@/tests/integration";
import {
  dadoUnProveedor,
  dadoUnClienteParticularConVehiculo,
  expectStockDetallado,
} from "../helpers/integrationFixtures";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";
import { operacionesService } from "@/app/api/operaciones/operacionesService";

describe("Integration: Operaciones - Stock Parcial y Diferido", () => {
  describe("Venta con entrega parcial de stock", () => {
    it("reserva las unidades pendientes de entrega y descuenta solo las unidades entregadas", async () => {
      const { cliente } = await dadoUnClienteParticularConVehiculo();
      const { stockId } = await dadoQueExisteUnProductoConStock({
        stock: { cantidad: 20, taller_id: SEED.tallerId },
      });

      const { data: operacion } = await operacionesService.create(testClient, {
        tipo: "VENTA",
        taller_id: SEED.tallerId,
        cliente_id: cliente.id,
        estado_pago: "PENDIENTE",
        lineas: [
          {
            stock_id: stockId,
            cantidad: 10,
            cantidad_cumplida: 6,
            monto_unitario: 1000,
            delta_cantidad: -10,
          },
        ],
      });

      expect(operacion?.estado_stock).toBe("PARCIAL");

      await expectStockDetallado(stockId, {
        cantidad: 14,
        cantidad_reservada: 4,
        cantidad_pendiente: 0,
      });
    });

    it("al confirmar la entrega del remanente, descuenta el stock físico final y libera la reserva", async () => {
      const { cliente } = await dadoUnClienteParticularConVehiculo();
      const { stockId } = await dadoQueExisteUnProductoConStock({
        stock: { cantidad: 20, taller_id: SEED.tallerId },
      });

      const { data: operacion } = await operacionesService.create(testClient, {
        tipo: "VENTA",
        taller_id: SEED.tallerId,
        cliente_id: cliente.id,
        estado_pago: "PENDIENTE",
        lineas: [
          {
            stock_id: stockId,
            cantidad: 10,
            cantidad_cumplida: 6,
            monto_unitario: 1000,
            delta_cantidad: -10,
          },
        ],
      });

      await operacionesService.confirmarStock(testClient, operacion!.id, undefined, [
        { stockId, cantidad: 4 },
      ]);

      await expectStockDetallado(stockId, {
        cantidad: 10,
        cantidad_reservada: 0,
        cantidad_pendiente: 0,
      });
    });

    it("al revertir una entrega de stock, reincorpora las unidades físicas y las vuelve a reservar en la venta", async () => {
      const { cliente } = await dadoUnClienteParticularConVehiculo();
      const { stockId } = await dadoQueExisteUnProductoConStock({
        stock: { cantidad: 20, taller_id: SEED.tallerId },
      });

      const { data: operacion } = await operacionesService.create(testClient, {
        tipo: "VENTA",
        taller_id: SEED.tallerId,
        cliente_id: cliente.id,
        estado_pago: "PENDIENTE",
        lineas: [
          {
            stock_id: stockId,
            cantidad: 10,
            cantidad_cumplida: 6,
            monto_unitario: 1000,
            delta_cantidad: -10,
          },
        ],
      });

      await expectStockDetallado(stockId, {
        cantidad: 14,
        cantidad_reservada: 4,
        cantidad_pendiente: 0,
      });

      const movimientoEntrega = operacion?.movimientos_stock?.find(
        (m) => m.stock_id === stockId && m.cantidad === -6
      );
      expect(movimientoEntrega).toBeDefined();

      const { data: opRevertida, error } = await operacionesService.revertirStock(
        testClient,
        operacion!.id,
        movimientoEntrega!.id
      );
      expect(error).toBeNull();
      expect(opRevertida?.estado_stock).toBe("PENDIENTE");

      await expectStockDetallado(stockId, {
        cantidad: 20,
        cantidad_reservada: 10,
        cantidad_pendiente: 0,
      });
    });
  });

  describe("Compra con recepción parcial de stock", () => {
    it("incrementa el stock físico recibido y anota las unidades pendientes de llegada", async () => {
      const proveedor = await dadoUnProveedor();
      const { stockId } = await dadoQueExisteUnProductoConStock({
        stock: { cantidad: 5, taller_id: SEED.tallerId },
      });

      const { data: operacion } = await operacionesService.create(testClient, {
        tipo: "COMPRA",
        taller_id: SEED.tallerId,
        proveedor_id: proveedor.id,
        estado_pago: "PENDIENTE",
        lineas: [
          {
            stock_id: stockId,
            cantidad: 10,
            cantidad_cumplida: 4,
            monto_unitario: 1000,
            delta_cantidad: 10,
          },
        ],
      });

      expect(operacion?.estado_stock).toBe("PARCIAL");

      await expectStockDetallado(stockId, {
        cantidad: 9,
        cantidad_pendiente: 6,
        cantidad_reservada: 0,
      });
    });

    it("al confirmar la recepción del remanente, ingresa el stock físico final y cancela los pendientes", async () => {
      const proveedor = await dadoUnProveedor();
      const { stockId } = await dadoQueExisteUnProductoConStock({
        stock: { cantidad: 5, taller_id: SEED.tallerId },
      });

      const { data: operacion } = await operacionesService.create(testClient, {
        tipo: "COMPRA",
        taller_id: SEED.tallerId,
        proveedor_id: proveedor.id,
        estado_pago: "PENDIENTE",
        lineas: [
          {
            stock_id: stockId,
            cantidad: 10,
            cantidad_cumplida: 4,
            monto_unitario: 1000,
            delta_cantidad: 10,
          },
        ],
      });

      await operacionesService.confirmarStock(testClient, operacion!.id, undefined, [
        { stockId, cantidad: 6 },
      ]);

      await expectStockDetallado(stockId, {
        cantidad: 15,
        cantidad_reservada: 0,
        cantidad_pendiente: 0,
      });
    });

    it("al revertir una recepción de stock, descuenta las unidades físicas y las vuelve a marcar como pendientes", async () => {
      const proveedor = await dadoUnProveedor();
      const { stockId } = await dadoQueExisteUnProductoConStock({
        stock: { cantidad: 5, taller_id: SEED.tallerId },
      });

      const { data: operacion } = await operacionesService.create(testClient, {
        tipo: "COMPRA",
        taller_id: SEED.tallerId,
        proveedor_id: proveedor.id,
        estado_pago: "PENDIENTE",
        lineas: [
          {
            stock_id: stockId,
            cantidad: 10,
            cantidad_cumplida: 4,
            monto_unitario: 1000,
            delta_cantidad: 10,
          },
        ],
      });

      await expectStockDetallado(stockId, {
        cantidad: 9,
        cantidad_pendiente: 6,
        cantidad_reservada: 0,
      });

      const movimientoRecepcion = operacion?.movimientos_stock?.find(
        (m) => m.stock_id === stockId && m.cantidad === 4
      );
      expect(movimientoRecepcion).toBeDefined();

      const { data: opRevertida, error } = await operacionesService.revertirStock(
        testClient,
        operacion!.id,
        movimientoRecepcion!.id
      );
      expect(error).toBeNull();
      expect(opRevertida?.estado_stock).toBe("PENDIENTE");

      await expectStockDetallado(stockId, {
        cantidad: 5,
        cantidad_pendiente: 10,
        cantidad_reservada: 0,
      });
    });
  });
});
