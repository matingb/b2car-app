import { renderHook } from "@testing-library/react";
import type { StockItem } from "@/model/stock";
import { useStockStats } from "./useStockFilters";

function stockItem(overrides: Partial<StockItem>): StockItem {
  return {
    id: "stock-1",
    productoId: "producto-1",
    tallerId: "taller-1",
    nombre: "Filtro",
    codigo: "FIL-1",
    categorias: [],
    stockActual: 10,
    stockMinimo: 2,
    stockMaximo: 20,
    costoUnitario: 100,
    precioUnitario: 150,
    showInStock: true,
    ultimaActualizacion: "",
    historialMovimientos: [],
    ...overrides,
  };
}

describe("useStockStats", () => {
  it("excluye productos que no deben mostrarse en stock", () => {
    const items = [
      stockItem({ id: "visible-critico", stockActual: 0, showInStock: true }),
      stockItem({ id: "oculto-bajo", stockActual: 1, stockMinimo: 3, showInStock: false }),
      stockItem({ id: "oculto-alto", stockActual: 30, stockMaximo: 20, showInStock: false }),
    ];

    const { result } = renderHook(() => useStockStats(items));

    expect(result.current).toEqual({
      criticos: 1,
      bajos: 0,
      altos: 0,
      normales: 0,
      total: 1,
    });
  });

  it("no cuenta como exceso el stock sin máximo configurado", () => {
    const items = [
      stockItem({ id: "sin-maximo", stockActual: 30, stockMinimo: 0, stockMaximo: 0 }),
      stockItem({ id: "maximo-superado", stockActual: 30, stockMinimo: 0, stockMaximo: 20 }),
    ];

    const { result } = renderHook(() => useStockStats(items));

    expect(result.current).toEqual({ criticos: 0, bajos: 0, altos: 1, normales: 1, total: 2 });
  });

  it("calcula los estados a partir de disponible - reservado + pendiente", () => {
    const items = [
      // Físico 10, pero disponible 1, reservado 1, pendiente 0 => cuenta 0 => critico
      stockItem({
        id: "item-critico",
        stockActual: 10,
        stockDisponible: 1,
        stockReservado: 1,
        stockPendiente: 0,
        stockMinimo: 2,
        stockMaximo: 20,
      }),
      // Físico 10, disponible 3, reservado 2, pendiente 0 => cuenta 1 < stockMinimo 2 => bajo
      stockItem({
        id: "item-bajo",
        stockActual: 10,
        stockDisponible: 3,
        stockReservado: 2,
        stockPendiente: 0,
        stockMinimo: 2,
        stockMaximo: 20,
      }),
      // Físico 10, disponible 8, reservado 1, pendiente 0 => cuenta 7 => normal
      stockItem({
        id: "item-normal",
        stockActual: 10,
        stockDisponible: 8,
        stockReservado: 1,
        stockPendiente: 0,
        stockMinimo: 2,
        stockMaximo: 20,
      }),
      // Físico 10, disponible 15, reservado 1, pendiente 10 => cuenta 24 > stockMaximo 20 => alto
      stockItem({
        id: "item-alto",
        stockActual: 10,
        stockDisponible: 15,
        stockReservado: 1,
        stockPendiente: 10,
        stockMinimo: 2,
        stockMaximo: 20,
      }),
    ];

    const { result } = renderHook(() => useStockStats(items));

    expect(result.current).toEqual({
      criticos: 1,
      bajos: 1,
      altos: 1,
      normales: 1,
      total: 4,
    });
  });
});
