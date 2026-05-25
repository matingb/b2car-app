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
    proveedor: "",
    ubicacion: "",
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
});
