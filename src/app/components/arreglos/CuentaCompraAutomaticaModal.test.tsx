import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import CuentaCompraAutomaticaModal from "./CuentaCompraAutomaticaModal";
import { TenantTestProvider, mockHasPermission } from "@/tests/testUtils";
import { UserRole } from "@/lib/permissions";

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
  default: ({
    value,
    dataTestId,
    allowCreate,
  }: {
    value: string;
    dataTestId?: string;
    allowCreate?: boolean;
  }) => (
    <input
      data-testid={dataTestId}
      value={value}
      data-allow-create={allowCreate ? "true" : "false"}
      readOnly
    />
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
      <TenantTestProvider>
        <CuentaCompraAutomaticaModal
          open
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      </TenantTestProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("arreglo-compra-automatica-cuenta")).toHaveValue("C-FAVORITA");
    });
  });

  it("deshabilita la creación de cuenta para un usuario operativo", async () => {
    render(
      <TenantTestProvider
        hasPermission={mockHasPermission(UserRole.Operativo)}
      >
        <CuentaCompraAutomaticaModal
          open
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      </TenantTestProvider>
    );

    await waitFor(() => {
      const input = screen.getByTestId("arreglo-compra-automatica-cuenta");
      expect(input).toHaveAttribute("data-allow-create", "false");
    });
  });
});
