import { describe, expect, it } from "vitest";
import { buildMonthPeriod, buildPeriodOptions, buildRangePeriod, monthOfPeriod } from "./periods";

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

  it("ordena del mes más reciente al más viejo cruzando el año", () => {
    const now = new Date(2026, 1, 10);
    expect(buildPeriodOptions(3, now).map((p) => p.label)).toEqual([
      "Febrero 2026",
      "Enero 2026",
      "Diciembre 2025",
    ]);
  });
});

describe("buildMonthPeriod", () => {
  it("normaliza meses fuera de rango al año correspondiente", () => {
    expect(buildMonthPeriod(2026, -1).label).toBe("Diciembre 2025");
    expect(buildMonthPeriod(2026, 12).label).toBe("Enero 2027");
  });
});

describe("buildRangePeriod", () => {
  it("toma los días como inclusivos, con el límite superior exclusivo", () => {
    expect(buildRangePeriod("2026-09-15", "2026-10-15")).toEqual({
      label: "15/09/26 – 15/10/26",
      from: new Date(2026, 8, 15).toISOString(),
      to: new Date(2026, 9, 16).toISOString(),
    });
  });

  it("acepta un rango de un solo día", () => {
    expect(buildRangePeriod("2026-10-05", "2026-10-05")?.to).toBe(new Date(2026, 9, 6).toISOString());
  });

  it("rechaza fechas inválidas o invertidas", () => {
    expect(buildRangePeriod("2026-10-15", "2026-10-01")).toBeNull();
    expect(buildRangePeriod("2026-02-30", "2026-03-01")).toBeNull();
  });
});

describe("monthOfPeriod", () => {
  it("resuelve el mes tanto para bounds locales como para los UTC del primer render", () => {
    expect(monthOfPeriod(buildMonthPeriod(2026, 9))).toEqual({ year: 2026, month: 9 });
    expect(monthOfPeriod(buildMonthPeriod(2026, 9, "UTC"))).toEqual({ year: 2026, month: 9 });
  });
});
