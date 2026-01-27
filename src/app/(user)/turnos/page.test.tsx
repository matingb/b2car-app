import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";

vi.mock("@/app/providers/TurnosProvider", () => ({
  useTurnos: () => ({
    loading: false,
    error: null,
    remove: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    alert: vi.fn(),
    confirm: vi.fn(),
    isOpen: false,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("@/app/components/turnos/mensual/TurnosMonthlyView", () => ({
  __esModule: true,
  default: () => <div data-testid="turnos-view-mensual" />,
}));

vi.mock("@/app/components/turnos/semanal/TurnosWeeklyGridHView", () => ({
  __esModule: true,
  default: () => <div data-testid="turnos-view-semanal" />,
}));

vi.mock("@/app/components/turnos/diaria/TurnosDailyView", () => ({
  __esModule: true,
  default: () => <div data-testid="turnos-view-diaria" />,
}));

vi.mock("@/app/components/turnos/TurnoDetailsModal", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/app/components/turnos/TurnoCreateModal", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/app/components/ui/ScreenHeader", () => ({
  __esModule: true,
  default: () => null,
}));

import TurnosPage from "./page";

describe("TurnosPage", () => {
  it("por defecto renderiza la vista semanal", () => {
    render(<TurnosPage />);
    expect(screen.getByTestId("turnos-view-semanal")).toBeInTheDocument();
    expect(screen.queryByTestId("turnos-view-mensual")).not.toBeInTheDocument();
    expect(screen.queryByTestId("turnos-view-diaria")).not.toBeInTheDocument();
  });

  it("renderiza una única vista según el chip seleccionado", async () => {
    const user = userEvent.setup();
    render(<TurnosPage />);

    // Semanal (default)
    expect(screen.getByTestId("turnos-view-semanal")).toBeInTheDocument();

    await user.click(screen.getByTestId("turnos-chip-mensual"));
    await runPendingPromises();
    expect(screen.getByTestId("turnos-view-mensual")).toBeInTheDocument();

    await user.click(screen.getByTestId("turnos-chip-diaria"));
    await runPendingPromises();
    expect(screen.getByTestId("turnos-view-diaria")).toBeInTheDocument();

    // Volver a Semanal
    await user.click(screen.getByTestId("turnos-chip-semanal"));
    await runPendingPromises();
    expect(screen.getByTestId("turnos-view-semanal")).toBeInTheDocument();
  });
});

