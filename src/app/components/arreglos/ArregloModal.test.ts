import { afterEach, describe, expect, it, vi } from "vitest";
import { getArregloModalFecha, normalizeArregloObservaciones, parseCombustibleLeido } from "./ArregloModal";

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

describe("normalizeArregloObservaciones", () => {
  it("mantiene una cadena vacía al editar para eliminar las observaciones existentes", () => {
    expect(normalizeArregloObservaciones("   ", true)).toBe("");
  });

  it("omite una observación vacía al crear un arreglo", () => {
    expect(normalizeArregloObservaciones("   ", false)).toBeUndefined();
  });
});

describe("parseCombustibleLeido", () => {
  it("acepta porcentajes entre 0 y 100 y mantiene vacío como opcional", () => {
    expect(parseCombustibleLeido("0")).toBe(0);
    expect(parseCombustibleLeido("65")).toBe(65);
    expect(parseCombustibleLeido(" ")).toBeUndefined();
  });

  it("rechaza valores fuera del rango", () => {
    expect(parseCombustibleLeido("101")).toBeUndefined();
  });
});
