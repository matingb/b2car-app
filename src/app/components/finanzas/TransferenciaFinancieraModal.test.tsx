import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CuentaFinanciera } from "@/model/finanzas";
import TransferenciaFinancieraModal from "./TransferenciaFinancieraModal";

const cuentas: CuentaFinanciera[] = [
  {
    id: "caja",
    nombre: "Caja",
    tipo: "EFECTIVO",
    saldoInicial: 0,
    saldoActual: 5000,
    activo: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "banco",
    nombre: "Banco",
    tipo: "CUENTA_BANCARIA",
    saldoInicial: 0,
    saldoActual: 0,
    activo: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "vieja",
    nombre: "Cuenta vieja",
    tipo: "BILLETERA_DIGITAL",
    saldoInicial: 0,
    saldoActual: 0,
    activo: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

describe("TransferenciaFinancieraModal", () => {
  it("solo ofrece cuentas activas y envia una transferencia con el origen fijado", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <TransferenciaFinancieraModal
        open
        cuentas={cuentas}
        cuentaOrigenId="caja"
        onClose={vi.fn()}
        onCreate={onCreate}
      />
    );

    expect(screen.queryByRole("option", { name: "Cuenta vieja" })).not.toBeInTheDocument();
    expect(screen.getByTestId("transferencia-cuenta-origen")).toBeDisabled();
    await user.type(screen.getByTestId("transferencia-importe"), "2.000");
    await user.type(screen.getByTestId("transferencia-descripcion"), "Deposito diario");
    await user.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          cuentaOrigenId: "caja",
          cuentaDestinoId: "banco",
          importe: 2000,
          descripcion: "Deposito diario",
        })
      );
    });
  });
});
