import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { CuentaFinanciera } from "@/model/finanzas";

const obtenerCuenta = vi.fn();
const listarMovimientos = vi.fn();
const listarCuentas = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "11111111-1111-4111-8111-111111111111" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/app/components/ui/ScreenHeader", () => ({
  __esModule: true,
  default: () => <div data-testid="screen-header" />,
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({ confirm: vi.fn().mockResolvedValue(false) }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/clients/finanzasClient", () => ({
  finanzasClient: {
    obtenerCuenta: (...args: unknown[]) => obtenerCuenta(...args),
    listarMovimientos: (...args: unknown[]) => listarMovimientos(...args),
    listarCuentas: (...args: unknown[]) => listarCuentas(...args),
    actualizarCuenta: vi.fn(),
    eliminarCuenta: vi.fn(),
    crearTransferencia: vi.fn(),
  },
}));

import { CuentasFinancierasProvider } from "@/app/providers/CuentasFinancierasProvider";
import CuentaFinancieraDetailPage from "./page";

const cuenta: CuentaFinanciera = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Caja principal",
  tipo: "EFECTIVO",
  saldoInicial: 1000,
  saldoActual: 1500,
  activo: true,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

describe("CuentaFinancieraDetailPage", () => {
  beforeEach(() => {
    obtenerCuenta.mockReset();
    listarMovimientos.mockReset();
    listarCuentas.mockReset();
    obtenerCuenta.mockResolvedValue({ data: cuenta, error: null });
    listarMovimientos.mockResolvedValue({ data: [], error: null });
    listarCuentas.mockResolvedValue({ data: [cuenta], error: null });
  });

  it("expone Nuevo gasto con la cuenta preseleccionada para Operaciones", async () => {
    render(
      <CuentasFinancierasProvider>
        <CuentaFinancieraDetailPage />
      </CuentasFinancierasProvider>
    );

    const gastoLink = await screen.findByTestId("cuenta-financiera-nuevo-gasto");
    expect(gastoLink).toHaveAttribute(
      "href",
      "/operaciones?nuevo=gasto&cuenta_financiera_id=11111111-1111-4111-8111-111111111111"
    );
    await waitFor(() => {
      expect(obtenerCuenta).toHaveBeenCalledWith(cuenta.id);
      expect(listarMovimientos).toHaveBeenCalledWith(cuenta.id);
    });
  });
});
