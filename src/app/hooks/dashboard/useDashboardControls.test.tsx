import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchStatsMock } = vi.hoisted(() => ({ fetchStatsMock: vi.fn() }));

vi.mock("@/app/providers/DashboardProvider", () => ({
  useDashboard: () => ({ stats: null, loading: false, error: null, fetchStats: fetchStatsMock }),
}));

import PeriodSelector from "@/app/components/dashboard/PeriodSelector";
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

describe("useDashboardControls period hydration", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", "America/Argentina/Buenos_Aires");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T01:00:00.000Z"));
    fetchStatsMock.mockReset().mockResolvedValue(null);
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
});
