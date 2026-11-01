import { describe, expect, it } from "vitest";
import { getStockStatus, getProductoStockBreakdown } from "./stock";

describe("getStockStatus", () => {
  it("does not report excess when no maximum is configured", () => {
    expect(getStockStatus({ stockActual: 8, stockMinimo: 0, stockMaximo: 0 })).toBe("normal");
  });

  it("keeps critical and low states when no maximum is configured", () => {
    expect(getStockStatus({ stockActual: 0, stockMinimo: 0, stockMaximo: 0 })).toBe("critico");
  });

  it("keeps critical and low states when no maximum is configured", () => {
    expect(getStockStatus({ stockActual: 2, stockMinimo: 3, stockMaximo: 0 })).toBe("bajo");
  });

  it("reports excess only after a configured maximum is exceeded", () => {
    expect(getStockStatus({ stockActual: 10, stockMinimo: 2, stockMaximo: 10 })).toBe("normal");
    expect(getStockStatus({ stockActual: 11, stockMinimo: 2, stockMaximo: 10 })).toBe("alto");
  });
});

describe("getProductoStockBreakdown", () => {
  it("returns all zeros for null or undefined producto or empty stocks", () => {
    expect(getProductoStockBreakdown(null)).toEqual({
      fisico: 0,
      disponible: 0,
      reservado: 0,
      pendiente: 0,
    });
    expect(getProductoStockBreakdown(undefined)).toEqual({
      fisico: 0,
      disponible: 0,
      reservado: 0,
      pendiente: 0,
    });
    expect(getProductoStockBreakdown({ stocks: [] })).toEqual({
      fisico: 0,
      disponible: 0,
      reservado: 0,
      pendiente: 0,
    });
  });

  it("accumulates all stocks across workshops when tallerId is omitted", () => {
    const producto = {
      stocks: [
        {
          tallerId: "t1",
          stockActual: 30,
          stockDisponible: 25,
          stockReservado: 5,
          stockPendiente: 10,
        },
        {
          tallerId: "t2",
          stockActual: 33,
          stockDisponible: 25,
          stockReservado: 8,
          stockPendiente: 11,
        },
      ],
    };

    expect(getProductoStockBreakdown(producto)).toEqual({
      fisico: 63,
      disponible: 50,
      reservado: 13,
      pendiente: 21,
    });
  });

  it("filters stock for a specific workshop when tallerId is provided", () => {
    const producto = {
      stocks: [
        {
          tallerId: "t1",
          stockActual: 30,
          stockDisponible: 25,
          stockReservado: 5,
          stockPendiente: 10,
        },
        {
          tallerId: "t2",
          stockActual: 33,
          stockDisponible: 25,
          stockReservado: 8,
          stockPendiente: 11,
        },
      ],
    };

    expect(getProductoStockBreakdown(producto, "t1")).toEqual({
      fisico: 30,
      disponible: 25,
      reservado: 5,
      pendiente: 10,
    });

    expect(getProductoStockBreakdown(producto, "t3")).toEqual({
      fisico: 0,
      disponible: 0,
      reservado: 0,
      pendiente: 0,
    });
  });

  it("calculates fallback disponible as max(0, actual - reservado) when stockDisponible is missing", () => {
    const producto = {
      stocks: [
        {
          tallerId: "t1",
          stockActual: 10,
          stockReservado: 3,
        },
      ],
    };

    expect(getProductoStockBreakdown(producto)).toEqual({
      fisico: 10,
      disponible: 7,
      reservado: 3,
      pendiente: 0,
    });
  });
});
