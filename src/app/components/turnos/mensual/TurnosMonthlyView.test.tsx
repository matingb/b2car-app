import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/providers/TurnosProvider", () => ({
  useTurnos: () => ({
    getTurnosByDate: () => [],
  }),
}));

import TurnosMonthlyView from "./TurnosMonthlyView";

describe("TurnosMonthlyView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('la fecha actual en la vista mensual tiene data-testid "month-cell-today"', () => {
    const fechaActual = new Date(2026, 0, 15, 12);
    vi.setSystemTime(fechaActual);
    
    render(<TurnosMonthlyView fechaActual={fechaActual} onSelectTurno={vi.fn()} />);

    expect(screen.getAllByTestId("month-cell-today")).toHaveLength(1);
    expect(screen.getAllByTestId("month-cell-today")[0]).toHaveTextContent(fechaActual.getDate().toString());
  });
});

