import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";
import OperacionPagoModal from "./OperacionPagoModal";
import type { Operacion } from "@/model/types";

const mockRegistrarPago = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/app/providers/OperacionesProvider", () => ({
  useOperaciones: () => ({
    registrarPago: mockRegistrarPago,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => ({
    cuentas: [],
    cuentasActivas: [{ id: "cuenta-fav-1", nombre: "Caja Chica", tipo: "EFECTIVO", saldoActual: 10000, activo: true }],
    cuentaFavorita: { id: "cuenta-fav-1", nombre: "Caja Chica", tipo: "EFECTIVO", saldoActual: 10000, activo: true, favorita: true },
    loading: false,
    createCuenta: vi.fn(),
  }),
}));

vi.mock("@/app/components/finanzas/CuentaFinancieraAutocomplete", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    dataTestId,
  }: {
    value: string;
    onChange: (val: string) => void;
    dataTestId?: string;
  }) => (
    <input
      data-testid={dataTestId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  CREATE_CUENTA_VALUE: "__create_cuenta__",
}));

describe("OperacionPagoModal", () => {
  const operacion: Operacion = {
    id: "op-1",
    tipo: "VENTA",
    taller_id: "taller-1",
    fecha: "2026-10-21T12:00:00Z",
    created_at: "2026-10-21T12:00:00Z",
    monto_total: 10000,
    total_pagado: 4000,
    saldo_pendiente: 6000,
    esta_pago: false,
    estado_pago: "PARCIAL",
    estado_stock: "ENTREGADO",
    lineas: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el saldo pendiente y preselecciona la cuenta favorita en vista simple", async () => {
    render(
      <OperacionPagoModal
        open={true}
        operacion={operacion}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByText("Registrar Cobro")).toBeInTheDocument();
    expect(screen.getByText("$6.000")).toBeInTheDocument();
    expect(screen.getByTestId("operacion-pago-simple")).toBeInTheDocument();
    expect(screen.getByText("Caja Chica")).toBeInTheDocument();
    expect(screen.getByText("Importe: $6.000")).toBeInTheDocument();
  });

  it("permite registrar un cobro por el saldo y llama a registrarPago", async () => {
    mockRegistrarPago.mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <OperacionPagoModal
        open={true}
        operacion={operacion}
        onClose={onClose}
      />
    );

    await runPendingPromises();

    const submitBtn = screen.getByTestId("modal-submit");
    expect(submitBtn).toBeEnabled();
    expect(submitBtn).toHaveTextContent("Cobrar $6.000");

    await userEvent.click(submitBtn);
    await runPendingPromises();

    await waitFor(() => {
      expect(mockRegistrarPago).toHaveBeenCalledWith("op-1", expect.objectContaining({
        cuentaId: "cuenta-fav-1",
        monto: 6000,
      }));
      expect(mockToastSuccess).toHaveBeenCalledWith("Cobro registrado", expect.any(String));
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("permite alternar a modo avanzado, editar monto y valida el saldo", async () => {
    render(
      <OperacionPagoModal
        open={true}
        operacion={operacion}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    // Alternar a avanzado
    const toggleBtn = screen.getByTestId("operacion-pago-advanced-toggle");
    await userEvent.click(toggleBtn);
    await runPendingPromises();

    const inputMonto = screen.getByTestId("pago-monto-0");
    await userEvent.clear(inputMonto);
    await userEvent.type(inputMonto, "0");

    expect(screen.getByTestId("modal-submit")).toBeDisabled();

    await userEvent.clear(inputMonto);
    await userEvent.type(inputMonto, "7000");

    expect(screen.getByTestId("modal-submit")).toBeDisabled();

    await userEvent.clear(inputMonto);
    await userEvent.type(inputMonto, "3000");

    expect(screen.getByTestId("modal-submit")).toBeEnabled();
    expect(screen.getByTestId("modal-submit")).toHaveTextContent("Cobrar $3.000");
  });

  it("calcula y renderiza el saldo pendiente si la operacion no trae saldo_pendiente explícito", async () => {
    const opSinSaldo: Operacion = {
      ...operacion,
      saldo_pendiente: undefined,
      monto_total: 15000,
      total_pagado: 5000,
    };

    render(
      <OperacionPagoModal
        open={true}
        operacion={opSinSaldo}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByText("Registrar Cobro")).toBeInTheDocument();
    expect(screen.getByText("$10.000")).toBeInTheDocument();
    expect(screen.getByText("Importe: $10.000")).toBeInTheDocument();
    expect(screen.getByTestId("modal-submit")).toHaveTextContent("Cobrar $10.000");
  });
});

