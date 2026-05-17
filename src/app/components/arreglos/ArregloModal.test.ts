import { afterEach, describe, expect, it, vi } from "vitest";
import { getArregloModalFecha } from "./ArregloModal";

describe("getArregloModalFecha", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa la fecha local de hoy cuando se crea un arreglo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 16, 10, 30, 0));

    expect(getArregloModalFecha()).toBe("2026-05-16");
  });

  it("respeta la fecha inicial cuando se edita un arreglo", () => {
    expect(getArregloModalFecha("2026-03-19T12:00:00.000Z")).toBe("2026-03-19");
  });
});
