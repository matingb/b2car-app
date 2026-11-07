import { describe, expect, it } from "vitest";
import {
  getStockStatus,
  getStockCalculado,
  getStockPercentage,
  getProductoStockBreakdown,
  getStockBreakdown,
} from "./stock";

describe("getStockCalculado", () => {
  it("calcula disponible - reservado + pendiente con valores explícitos", () => {
    expect(
      getStockCalculado({
        stockActual: 10,
        stockDisponible: 7,
        stockReservado: 3,
        stockPendiente: 2,
        stockMinimo: 0,
        stockMaximo: 0,
      })
    ).toBe(6); // 7 - 3 + 2 = 6
  });

  it("calcula disponible como stockActual - stockReservado cuando no viene stockDisponible", () => {
    expect(
      getStockCalculado({
        stockActual: 10,
        stockReservado: 4,
        stockPendiente: 1,
        stockMinimo: 0,
        stockMaximo: 0,
      })
    ).toBe(3); // (10 - 4) - 4 + 1 = 6 - 4 + 1 = 3
  });

  it("devuelve stockActual cuando reservado y pendiente son 0", () => {
    expect(
      getStockCalculado({
        stockActual: 8,
        stockMinimo: 0,
        stockMaximo: 0,
      })
    ).toBe(8);
  });
});

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

  it("calcula el estado a partir de disponible - reservado + pendiente", () => {
    // Caso critico aunque stockActual sea alto (ej. 10 físico pero disponible 2, reservado 2, pendiente 0 => 0)
    expect(
      getStockStatus({
        stockActual: 10,
        stockDisponible: 2,
        stockReservado: 2,
        stockPendiente: 0,
        stockMinimo: 3,
        stockMaximo: 20,
      })
    ).toBe("critico"); // 2 - 2 + 0 = 0 <= 0 => critico

    // Caso bajo: disponible 4, reservado 2, pendiente 0 => 2 < stockMinimo 3
    expect(
      getStockStatus({
        stockActual: 10,
        stockDisponible: 4,
        stockReservado: 2,
        stockPendiente: 0,
        stockMinimo: 3,
        stockMaximo: 20,
      })
    ).toBe("bajo");

    // Caso normal: disponible 5, reservado 2, pendiente 1 => 4 (entre 3 y 20)
    expect(
      getStockStatus({
        stockActual: 10,
        stockDisponible: 5,
        stockReservado: 2,
        stockPendiente: 1,
        stockMinimo: 3,
        stockMaximo: 20,
      })
    ).toBe("normal");

    // Caso alto: disponible 15, reservado 1, pendiente 10 => 24 > stockMaximo 20
    expect(
      getStockStatus({
        stockActual: 10,
        stockDisponible: 15,
        stockReservado: 1,
        stockPendiente: 10,
        stockMinimo: 3,
        stockMaximo: 20,
      })
    ).toBe("alto");
  });
});

describe("getStockPercentage", () => {
  it("calcula el porcentaje en base a stockActual sobre stockMaximo", () => {
    expect(
      getStockPercentage({
        stockActual: 10,
        stockMinimo: 2,
        stockMaximo: 20,
      })
    ).toBe(50);
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

  it("calculates fallback disponible as (actual - reservado) when stockDisponible is missing, allowing negative deficit", () => {
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

    const productoDeficit = {
      stocks: [
        {
          tallerId: "t1",
          stockActual: 2,
          stockReservado: 5,
        },
      ],
    };

    expect(getProductoStockBreakdown(productoDeficit)).toEqual({
      fisico: 2,
      disponible: -3,
      reservado: 5,
      pendiente: 0,
    });
  });
});

describe("getStockBreakdown", () => {
  it("returns zeros when stock is missing and no override is passed", () => {
    expect(getStockBreakdown(null)).toEqual({
      fisico: 0,
      disponible: 0,
      reservado: 0,
      pendiente: 0,
    });
  });

  it("calculates breakdown with explicit stockDisponible", () => {
    expect(
      getStockBreakdown({
        stockActual: 20,
        stockDisponible: 15,
        stockReservado: 5,
        stockPendiente: 2,
      })
    ).toEqual({
      fisico: 20,
      disponible: 15,
      reservado: 5,
      pendiente: 2,
    });
  });

  it("calculates fallback disponible as max(0, actual - reservado)", () => {
    expect(
      getStockBreakdown({
        stockActual: 10,
        stockReservado: 4,
      })
    ).toEqual({
      fisico: 10,
      disponible: 6,
      reservado: 4,
      pendiente: 0,
    });
  });

  it("respects stockActualOverride when provided", () => {
    expect(
      getStockBreakdown(
        {
          stockActual: 10,
          stockReservado: 3,
        },
        25
      )
    ).toEqual({
      fisico: 25,
      disponible: 22,
      reservado: 3,
      pendiente: 0,
    });
  });

  it("recalculates disponible when stockActualOverride is provided even if stock has stockDisponible", () => {
    expect(
      getStockBreakdown(
        {
          stockActual: 10,
          stockDisponible: 7,
          stockReservado: 3,
        },
        25
      )
    ).toEqual({
      fisico: 25,
      disponible: 22,
      reservado: 3,
      pendiente: 0,
    });
  });
});
