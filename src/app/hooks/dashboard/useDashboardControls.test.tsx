import React from "react";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardPeriodo, DashboardStats } from "@/lib/dashboard/types";

const { fetchStatsMock, ensurePeriodoMock, dashboard } = vi.hoisted(() => ({
  fetchStatsMock: vi.fn(),
  ensurePeriodoMock: vi.fn(),
  dashboard: { stats: null as DashboardStats | null },
}));

vi.mock("@/app/providers/DashboardProvider", () => ({
  useDashboard: () => ({
    stats: dashboard.stats,
    loading: false,
    error: null,
    fetchStats: fetchStatsMock,
    periodos: {},
    ensurePeriodo: ensurePeriodoMock,
    reloadPeriodo: vi.fn(),
  }),
}));

import PeriodSelector from "@/app/components/dashboard/PeriodSelector";
import { COMPARISON_STORAGE_KEY, DASHBOARD_MONTH_ROW_ID } from "@/lib/dashboard/comparison";
import { useDashboardControls } from "./useDashboardControls";

function DashboardControlsProbe() {
  const { period, handlePeriodChange } = useDashboardControls();

  return (
    <>
      <output data-testid="dashboard-period">{period.label}|{period.from}|{period.to}</output>
      <PeriodSelector value={period} onChange={handlePeriodChange} />
    </>
  );
}

const agosto2026: DashboardPeriodo = {
  resumen: {
    total: 2,
    cobrados: 1,
    pendientes: 1,
    parciales: 0,
    montoIngresos: 3000,
    montoCobradoTotal: 1000,
    montoCobradoParcial: 0,
    montoPendienteParcial: 0,
    montoPendiente: 2000,
  },
  series: {
    arreglos: [{ fecha: "2026-08-03", cantidad: 2 }],
    ingresos: [{ fecha: "2026-08-03", mano_de_obra: 2000, repuestos: 1000, ventas: 0 }],
    gastos: [{ fecha: "2026-08-03", repuestos: 0, sueldos: 500, eventuales: 0 }],
  },
};

describe("useDashboardControls", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", "America/Argentina/Buenos_Aires");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T01:00:00.000Z"));
    fetchStatsMock.mockReset().mockResolvedValue(null);
    ensurePeriodoMock.mockReset();
    dashboard.stats = null;
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("keeps the UTC server period through hydration, then loads the local month", async () => {
    const serverMarkup = renderToString(<DashboardControlsProbe />);

    expect(serverMarkup).toContain("Septiembre 2026");
    expect(serverMarkup).toContain("2026-09-01T00:00:00.000Z");
    expect(serverMarkup).toContain("2026-10-01T00:00:00.000Z");
    expect(serverMarkup).toContain(">Septiembre 2026</span>");

    render(<DashboardControlsProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-period")).toHaveTextContent(
        "Agosto 2026|2026-08-01T03:00:00.000Z|2026-09-01T03:00:00.000Z",
      );
    });

    expect(fetchStatsMock).toHaveBeenCalledTimes(1);
    expect(fetchStatsMock).toHaveBeenCalledWith({
      from: "2026-08-01T03:00:00.000Z",
      to: "2026-09-01T03:00:00.000Z",
    });
  });

  it("la fila del mes del dashboard usa las stats ya cargadas y solo pide los demás períodos", async () => {
    dashboard.stats = { periodo: agosto2026 };
    const { result } = renderHook(() => useDashboardControls());
    await waitFor(() => expect(result.current.period.label).toBe("Agosto 2026"));

    expect(result.current.comparison.rows).toMatchObject([
      { id: DASHBOARD_MONTH_ROW_ID, label: "Agosto 2026", status: "ready", usesDashboardData: true, isReference: true },
    ]);
    expect(result.current.comparison.rows[0].totals?.facturacion).toBe(3000);

    act(() => {
      expect(result.current.comparison.add({ kind: "mes-anterior" })).toEqual({ ok: true });
    });

    // La fila nueva entra arriba de todo y pasa a ser la referencia.
    expect(result.current.comparison.rows.map((r) => [r.label, r.isReference])).toEqual([
      ["Julio 2026", true],
      ["Agosto 2026", false],
    ]);
    await waitFor(() =>
      expect(ensurePeriodoMock).toHaveBeenCalledWith({
        from: "2026-07-01T03:00:00.000Z",
        to: "2026-08-01T03:00:00.000Z",
      }),
    );
    expect(ensurePeriodoMock).not.toHaveBeenCalledWith({
      from: "2026-08-01T03:00:00.000Z",
      to: "2026-09-01T03:00:00.000Z",
    });
  });

  it("con la tabla vacía, los gráficos muestran el mes del header", async () => {
    dashboard.stats = { periodo: agosto2026 };
    window.localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify({ open: true, rows: [] }));

    const { result } = renderHook(() => useDashboardControls());
    await waitFor(() => expect(result.current.period.label).toBe("Agosto 2026"));

    expect(result.current.comparison.rows).toEqual([]);
    expect(result.current.chartPeriods.facturacion).toHaveLength(1);
    expect(result.current.chartPeriods.facturacion[0]).toMatchObject({
      label: "Agosto 2026",
      buckets: [{ key: "2026-08-03", label: "03/08", mano_de_obra: 2000, repuestos: 1000, ventas: 0 }],
    });
  });

  it("con filas en la tabla, los gráficos muestran solo las que tienen el ojo", async () => {
    dashboard.stats = { periodo: agosto2026 };
    const { result } = renderHook(() => useDashboardControls());
    await waitFor(() => expect(result.current.period.label).toBe("Agosto 2026"));

    act(() => {
      result.current.comparison.add({ kind: "mes-anterior" });
    });
    act(() => {
      result.current.comparison.toggleVisibility(DASHBOARD_MONTH_ROW_ID);
    });

    // Julio todavía no cargó y agosto está oculto: no hay nada para graficar.
    expect(result.current.chartPeriods.arreglos).toEqual([]);
  });

  it("al reordenar, la referencia pasa a ser la primera fila y el orden se guarda", async () => {
    dashboard.stats = { periodo: agosto2026 };
    const { result } = renderHook(() => useDashboardControls());
    await waitFor(() => expect(result.current.period.label).toBe("Agosto 2026"));

    act(() => {
      result.current.comparison.add({ kind: "mes-anterior" });
    });
    act(() => {
      result.current.comparison.move(DASHBOARD_MONTH_ROW_ID, 0);
    });

    expect(result.current.comparison.rows.map((r) => [r.label, r.isReference])).toEqual([
      ["Agosto 2026", true],
      ["Julio 2026", false],
    ]);
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(COMPARISON_STORAGE_KEY) ?? "{}");
      expect(saved.rows.map((r: { def: { kind: string } }) => r.def.kind)).toEqual(["mes-dashboard", "mes-anterior"]);
    });
  });
});
