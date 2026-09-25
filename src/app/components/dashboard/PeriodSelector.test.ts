import { describe, expect, it } from "vitest";
import { buildPeriodOptions } from "./PeriodSelector";

describe("buildPeriodOptions", () => {
  it("usa comienzos locales de mes y del mes siguiente", () => {
    const now = new Date(2026, 8, 24, 12, 0, 0);
    const [period] = buildPeriodOptions(1, now);

    expect(period.label).toBe("Septiembre 2026");
    expect(period.from).toBe(new Date(2026, 8, 1).toISOString());
    expect(period.to).toBe(new Date(2026, 9, 1).toISOString());
  });

  it("mantiene un modo UTC determinista para el primer render SSR", () => {
    const now = new Date("2026-09-24T01:00:00.000Z");
    const [period] = buildPeriodOptions(1, now, "UTC");

    expect(period).toEqual({
      label: "Septiembre 2026",
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    });
  });
});
