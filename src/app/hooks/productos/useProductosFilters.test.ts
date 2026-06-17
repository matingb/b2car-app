import { describe, expect, it } from "vitest";
import { filterProductos, getProductoStockSummary } from "./useProductosFilters";
import { createProducto } from "@/tests/factories";
import type { StockRegistro } from "@/app/providers/ProductosProvider";

function stock(overrides: Partial<StockRegistro>): StockRegistro {
  return {
    id: "STK-1",
    productoId: "PROD-1",
    tallerId: "TAL-1",
    stockActual: 10,
    stockMinimo: 2,
    stockMaximo: 20,
    ultimaActualizacion: "",
    historialMovimientos: [],
    ...overrides,
  };
}

describe("filterProductos", () => {
  it("filtra por taller y estado de stock", () => {
    const productos = [
      createProducto({
        id: "p1",
        nombre: "Filtro aceite",
        stocks: [stock({ tallerId: "TAL-1", stockActual: 0 })],
      }),
      createProducto({
        id: "p2",
        nombre: "Pastilla freno",
        stocks: [stock({ id: "STK-2", tallerId: "TAL-2", stockActual: 10 })],
      }),
    ];

    const result = filterProductos(productos, {
      search: "",
      filters: { categorias: [], tallerId: "TAL-1", estado: "critico", visibilidad: "inventario" },
    });

    expect(result.map((p) => p.id)).toEqual(["p1"]);
  });

  it("respeta visibilidad de productos esporadicos", () => {
    const productos = [
      createProducto({ id: "visible", showInStock: true }),
      createProducto({ id: "oculto", showInStock: false }),
    ];

    const result = filterProductos(productos, {
      search: "",
      filters: { categorias: [], tallerId: "", estado: "", visibilidad: "esporadico" },
    });

    expect(result.map((p) => p.id)).toEqual(["oculto"]);
  });

  it("considera sin stock a productos sin filas de stock configuradas", () => {
    const productos = [
      createProducto({ id: "sin-stock", stocks: [] }),
      createProducto({ id: "normal", stocks: [stock({ stockActual: 10, stockMinimo: 2, stockMaximo: 20 })] }),
    ];

    const result = filterProductos(productos, {
      search: "",
      filters: { categorias: [], tallerId: "", estado: "critico", visibilidad: "inventario" },
    });

    expect(result.map((p) => p.id)).toEqual(["sin-stock"]);
  });
});

describe("getProductoStockSummary", () => {
  it("calcula total y peor estado del producto", () => {
    const producto = createProducto({
      stocks: [
        stock({ id: "critico", stockActual: 0 }),
        stock({ id: "normal", tallerId: "TAL-2", stockActual: 8, stockMinimo: 2, stockMaximo: 20 }),
      ],
    });

    expect(getProductoStockSummary(producto)).toEqual({
      stockTotal: 8,
      talleresConStock: 2,
      worstStatus: "critico",
    });
  });
});
