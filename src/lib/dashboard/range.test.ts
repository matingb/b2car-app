import { describe, expect, it } from "vitest";
import { MAX_PERIODO_DIAS, parseDashboardRange } from "./range";

const params = (query: Record<string, string>) => new URLSearchParams(query);

describe("parseDashboardRange", () => {
  it("acepta un rango válido con zona horaria", () => {
    expect(parseDashboardRange(params({ from: "2026-10-01T03:00:00.000Z", to: "2026-11-01T03:00:00.000Z" }))).toEqual({
      ok: true,
      range: { from: "2026-10-01T03:00:00.000Z", to: "2026-11-01T03:00:00.000Z" },
    });
  });

  it("sin parámetros es válido salvo que sean obligatorios", () => {
    expect(parseDashboardRange(params({}))).toEqual({ ok: true, range: { from: undefined, to: undefined } });
    expect(parseDashboardRange(params({}), { required: true }).ok).toBe(false);
  });

  it("rechaza fechas sin zona horaria o mal formadas", () => {
    expect(parseDashboardRange(params({ from: "2026-10-01", to: "2026-11-01T03:00:00.000Z" })).ok).toBe(false);
    expect(parseDashboardRange(params({ from: "ayer", to: "hoy" })).ok).toBe(false);
  });

  it("rechaza rangos vacíos o invertidos", () => {
    const fecha = "2026-10-01T03:00:00.000Z";
    expect(parseDashboardRange(params({ from: fecha, to: fecha }))).toEqual({ ok: false, error: "from debe ser anterior a to" });
    expect(parseDashboardRange(params({ from: "2026-11-01T03:00:00.000Z", to: fecha })).ok).toBe(false);
  });

  it(`rechaza períodos de más de ${MAX_PERIODO_DIAS} días`, () => {
    // 2023-01-01 a 2026-01-01 son exactamente 1096 días (2024 es bisiesto).
    expect(parseDashboardRange(params({ from: "2023-01-01T03:00:00.000Z", to: "2026-01-01T03:00:00.000Z" })).ok).toBe(true);
    expect(parseDashboardRange(params({ from: "2023-01-01T03:00:00.000Z", to: "2026-01-02T03:00:00.000Z" })).ok).toBe(false);
  });
});
