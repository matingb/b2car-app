import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/providers/TurnosProvider", () => ({
  useTurnos: () => ({
    filterTurnosByDate: () => [],
    // Evitamos updates async (setTurnos) durante el test
    getWithFilters: () => new Promise(() => {}),
  }),
}));

import TurnosWeeklyGridHView from "./TurnosWeeklyGridHView";

describe("TurnosWeeklyGridHView", () => {
  it("al hacer click en una celda válida llama onSelectDia con día y hora", () => {
    const fechaActual = new Date(2026, 0, 15, 12); // Jue 15 Ene 2026
    const onSelectDia = vi.fn();

    render(
      <TurnosWeeklyGridHView
        fechaActual={fechaActual}
        onSelectTurno={vi.fn()}
        onSelectDia={onSelectDia}
      />
    );

    fireEvent.click(screen.getByTestId("week-slot-2026-01-15-10:00"));

    expect(onSelectDia).toHaveBeenCalledTimes(1);
    expect(onSelectDia.mock.calls[0][0]).toEqual(new Date(2026, 0, 15));
    expect(onSelectDia.mock.calls[0][1]).toBe("10:00");
  });
});

