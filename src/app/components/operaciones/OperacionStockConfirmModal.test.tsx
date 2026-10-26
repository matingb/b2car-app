import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";
import OperacionStockConfirmModal from "./OperacionStockConfirmModal";
import type { Operacion } from "@/model/types";

const mockConfirmarStock = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/app/providers/OperacionesProvider", () => ({
  useOperaciones: () => ({
    confirmarStock: mockConfirmarStock,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

describe("OperacionStockConfirmModal", () => {
  const operacionCompra: Operacion = {
    id: "op-compra-1",
    tipo: "COMPRA",
    taller_id: "taller-1",
    fecha: "2026-10-21T12:00:00Z",
    created_at: "2026-10-21T12:00:00Z",
    monto_total: 50000,
    total_pagado: 50000,
    saldo_pendiente: 0,
    esta_pago: true,
    estado_pago: "PAGADO",
    estado_stock: "PENDIENTE",
    lineas: [
      {
        id: "linea-1",
        operacion_id: "op-compra-1",
        stock_id: "stock-1",
        nombre: "Filtro de Aceite",
        cantidad: 10,
        cantidad_cumplida: 0,
        monto_unitario: 5000,
        delta_cantidad: 0,
        created_at: "2026-10-21T12:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza las líneas con saldo pendiente y pre-carga la cantidad restante", async () => {
    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={operacionCompra}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByText("Confirmar Recepción de Stock")).toBeInTheDocument();
    expect(screen.getByText("Filtro de Aceite")).toBeInTheDocument();
    expect(screen.getByText(/Pactadas: 10/)).toBeInTheDocument();
    expect(screen.getByText(/Resta: 10/)).toBeInTheDocument();

    const inputCant = screen.getByTestId("stock-confirm-input-linea-1") as HTMLInputElement;
    expect(inputCant.value).toBe("10");
  });

  it("permite confirmar recepción parcial (7 de 10) y llama a confirmarStock con lineas", async () => {
    mockConfirmarStock.mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={operacionCompra}
        onClose={onClose}
      />
    );

    await runPendingPromises();

    const inputCant = screen.getByTestId("stock-confirm-input-linea-1");
    await userEvent.clear(inputCant);
    await userEvent.type(inputCant, "7");

    const submitBtn = screen.getByTestId("modal-submit");
    expect(submitBtn).toBeEnabled();
    expect(submitBtn).toHaveTextContent("Confirmar Recepción (7 u.)");

    await userEvent.click(submitBtn);
    await runPendingPromises();

    await waitFor(() => {
      expect(mockConfirmarStock).toHaveBeenCalledWith("op-compra-1", expect.objectContaining({
        lineas: [{
          lineaId: "linea-1",
          stockId: "stock-1",
          cantidad: 7,
        }],
      }));
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Recepción confirmada",
        "Se confirmaron 7 unidad(es) de recepción."
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("deshabilita el botón si la cantidad a confirmar es 0", async () => {
    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={operacionCompra}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    const inputCant = screen.getByTestId("stock-confirm-input-linea-1");
    await userEvent.clear(inputCant);
    await userEvent.type(inputCant, "0");

    expect(screen.getByTestId("modal-submit")).toBeDisabled();
  });
});
