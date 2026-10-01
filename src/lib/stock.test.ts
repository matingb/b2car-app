import { describe, expect, it } from "vitest";
import { getStockStatus } from "./stock";

describe("getStockStatus", () => {
  it("does not report excess when no maximum is configured", () => {
    expect(getStockStatus({ stockActual: 8, stockMinimo: 0, stockMaximo: 0 })).toBe("normal");
  });

  it("keeps critical and low states when no maximum is configured", () => {
    expect(getStockStatus({ stockActual: 0, stockMinimo: 0, stockMaximo: 0 })).toBe("critico");
    expect(getStockStatus({ stockActual: 2, stockMinimo: 3, stockMaximo: 0 })).toBe("bajo");
  });

  it("reports excess only after a configured maximum is exceeded", () => {
    expect(getStockStatus({ stockActual: 10, stockMinimo: 2, stockMaximo: 10 })).toBe("normal");
    expect(getStockStatus({ stockActual: 11, stockMinimo: 2, stockMaximo: 10 })).toBe("alto");
  });
});
