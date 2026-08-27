import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import CuentaCompraAutomaticaModal from "./CuentaCompraAutomaticaModal";

const mockCreateCuenta = vi.fn();

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => ({
    loading: false,
    createCuenta: mockCreateCuenta,
    cuentaFavorita: {
      id: "C-FAVORITA",
      nombre: "Caja principal",
      tipo: "EFECTIVO",
      saldoActual: 10000,
      activo: true,
      favorita: true,
    },
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/app/components/finanzas/CuentaFinancieraAutocomplete", () => ({
  CREATE_CUENTA_VALUE: "__create_cuenta__",
  default: ({ value, dataTestId }: { value: string; dataTestId?: string }) => (
    <input data-testid={dataTestId} value={value} readOnly />
  ),
}));

vi.mock("@/app/components/ui/Modal", () => ({
  default: ({ open, children }: { open: boolean; children: ReactNode }) => (
    open ? <div>{children}</div> : null
  ),
}));

describe("CuentaCompraAutomaticaModal", () => {
  it("preselecciona la cuenta financiera favorita", async () => {
    render(
      <CuentaCompraAutomaticaModal
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("arreglo-compra-automatica-cuenta")).toHaveValue("C-FAVORITA");
    });
  });
});
