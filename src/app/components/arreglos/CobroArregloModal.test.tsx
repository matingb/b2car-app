import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CobroArregloModal from "./CobroArregloModal";

const mocks = vi.hoisted(() => ({
  fetchById: vi.fn(),
  cobrar: vi.fn(),
  anularCobro: vi.fn(),
}));

vi.mock("@/app/providers/ArreglosProvider", () => ({
  useArreglos: () => ({
    fetchById: mocks.fetchById,
    cobrar: mocks.cobrar,
    anularCobro: mocks.anularCobro,
  }),
}));

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => ({
    loading: false,
    createCuenta: vi.fn(),
    cuentaFavorita: {
      id: "11111111-1111-4111-8111-111111111111",
      nombre: "Caja principal",
      tipo: "EFECTIVO",
      saldoInicial: 0,
      saldoActual: 0,
      activo: true,
      favorita: true,
      createdAt: "2026-08-25T00:00:00Z",
      updatedAt: "2026-08-25T00:00:00Z",
    },
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({ confirm: vi.fn() }),
}));

describe("CobroArregloModal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mocks.fetchById.mockReset();
    mocks.fetchById.mockResolvedValue({
      arreglo: {
        id: "22222222-2222-4222-8222-222222222222",
        precio_final: 5000,
        total_cobrado: 1000,
        esta_pago: false,
      },
      cobros: [],
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now() + 500);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("muestra el cobro simplificado sobre la cuenta favorita y permite desplegar el reparto", async () => {
    render(
      <CobroArregloModal
        open
        arregloId="22222222-2222-4222-8222-222222222222"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByTestId("cobro-simple")).toBeInTheDocument());
    expect(screen.getByText("Caja principal")).toBeInTheDocument();
    expect(screen.queryByText("Registrar Pago")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cobro-advanced-toggle"));

    expect(screen.getByText("Registrar Pago")).toBeInTheDocument();
    expect(screen.getByText("Añadir otra cuenta")).toBeInTheDocument();
  });
});
