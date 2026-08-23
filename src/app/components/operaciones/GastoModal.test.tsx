import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GastoModal from "./GastoModal";

const listarCuentas = vi.fn();
const crearGasto = vi.fn();
const actualizarGasto = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock("@/clients/finanzasClient", () => ({
  finanzasClient: {
    listarCuentas: (...args: unknown[]) => listarCuentas(...args),
    crearGasto: (...args: unknown[]) => crearGasto(...args),
    actualizarGasto: (...args: unknown[]) => actualizarGasto(...args),
  },
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => toast,
}));

import { CuentasFinancierasProvider } from "@/app/providers/CuentasFinancierasProvider";

const CUENTA_ID = "11111111-1111-4111-8111-111111111111";

describe("GastoModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarCuentas.mockResolvedValue({
      data: [
        {
          id: CUENTA_ID,
          nombre: "Caja principal",
          tipo: "EFECTIVO",
          saldoInicial: 0,
          saldoActual: 50000,
          activo: true,
          createdAt: "2026-07-31T00:00:00.000Z",
          updatedAt: "2026-07-31T00:00:00.000Z",
        },
      ],
      error: null,
    });
    crearGasto.mockResolvedValue({
      data: {
        id: "22222222-2222-4222-8222-222222222222",
        cuentaId: CUENTA_ID,
        categoria: "ALQUILER",
        importe: 125000,
        fecha: "2026-07-31",
        descripcion: "Alquiler de julio",
        createdAt: "2026-07-31T00:00:00.000Z",
      },
      error: null,
    });
  });

  it("registra un gasto con cuenta, categoría, monto, fecha e idempotencia", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(
      <CuentasFinancierasProvider>
        <GastoModal open onClose={onClose} onSaved={onSaved} />
      </CuentasFinancierasProvider>
    );

    await waitFor(() => expect(screen.getByTestId("gasto-cuenta")).toBeEnabled());
    await user.click(screen.getByTestId("gasto-cuenta"));
    await user.click(await screen.findByText("Caja principal"));
    await user.type(screen.getByTestId("gasto-importe"), "125000");
    await user.type(screen.getByTestId("gasto-descripcion"), "Alquiler de julio");
    await user.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(crearGasto).toHaveBeenCalledWith(expect.objectContaining({
        cuentaId: CUENTA_ID,
        categoria: "ALQUILER",
        importe: 125000,
        descripcion: "Alquiler de julio",
        idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      }));
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
