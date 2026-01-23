import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/providers/TurnosProvider", () => ({
  useTurnos: () => ({
    filterTurnosByDate: () => [],
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

  it("al hacer click en una celda válida llama onSelectDia con el día clickeado", () => {
    const fechaActual = new Date(2026, 0, 15, 12);
    vi.setSystemTime(fechaActual);
    const onSelectDia = vi.fn();

    render(
      <TurnosMonthlyView
        fechaActual={fechaActual}
        onSelectTurno={vi.fn()}
        onSelectDia={onSelectDia}
      />
    );

    fireEvent.click(screen.getAllByTestId("month-cell-today")[0]);

    expect(onSelectDia).toHaveBeenCalledWith(fechaActual);
  });
});

