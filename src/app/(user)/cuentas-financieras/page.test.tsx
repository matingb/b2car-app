import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CuentaFinanciera } from "@/model/finanzas";

const listarCuentas = vi.fn();
const crearIngresoManual = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/app/components/ui/ScreenHeader", () => ({
  __esModule: true,
  default: () => <div data-testid="screen-header" />,
}));
vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/clients/finanzasClient", () => ({
  finanzasClient: {
    listarCuentas: (...args: unknown[]) => listarCuentas(...args),
    crearIngresoManual: (...args: unknown[]) => crearIngresoManual(...args),
  },
}));

import { CuentasFinancierasProvider } from "@/app/providers/CuentasFinancierasProvider";
import CuentasFinancierasPage from "./page";

const cuentas: CuentaFinanciera[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    nombre: "Caja activa",
    tipo: "EFECTIVO",
    saldoInicial: 0,
    saldoActual: 1000,
    activo: true,
    favorita: false,
    createdAt: "2026-09-24T00:00:00Z",
    updatedAt: "2026-09-24T00:00:00Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    nombre: "Caja inactiva",
    tipo: "CUENTA_BANCARIA",
    saldoInicial: 0,
    saldoActual: 0,
    activo: false,
    favorita: false,
    createdAt: "2026-09-24T00:00:00Z",
    updatedAt: "2026-09-24T00:00:00Z",
  },
];

describe("CuentasFinancierasPage", () => {
  beforeEach(() => {
    listarCuentas.mockReset().mockResolvedValue({ data: cuentas, error: null });
    crearIngresoManual.mockReset().mockResolvedValue({
      data: {
        id: "33333333-3333-4333-8333-333333333333",
        cuentaId: cuentas[0].id,
        importe: 50,
        fecha: "2026-09-24T12:00:00.000Z",
        descripcion: "Aporte",
        createdAt: "2026-09-24T12:00:00.000Z",
      },
      error: null,
    });
  });

  it("permite abrir el alta desde el listado y enviar solo una cuenta activa", async () => {
    render(
      <CuentasFinancierasProvider>
        <CuentasFinancierasPage />
      </CuentasFinancierasProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Nuevo ingreso" }));
    const accountSelector = await screen.findByTestId("ingreso-manual-cuenta");
    expect(accountSelector).toHaveTextContent("Caja activa");
    fireEvent.click(accountSelector);
    expect(screen.getByRole("option", { name: /Caja activa/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Caja inactiva/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ingreso-manual-importe"), { target: { value: "50" } });
    fireEvent.change(screen.getByTestId("ingreso-manual-descripcion"), { target: { value: "Aporte" } });
    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => expect(crearIngresoManual).toHaveBeenCalledTimes(1));
    expect(crearIngresoManual.mock.calls[0][0]).toMatchObject({
      cuentaId: cuentas[0].id,
      importe: 50,
      descripcion: "Aporte",
    });
    await waitFor(() => expect(listarCuentas).toHaveBeenCalledTimes(2));
  });
});
