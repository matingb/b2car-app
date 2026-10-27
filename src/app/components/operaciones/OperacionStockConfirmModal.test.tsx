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
        codigo: "FLT-001",
        cantidad: 10,
        cantidad_cumplida: 0,
        monto_unitario: 5000,
        delta_cantidad: 0,
        created_at: "2026-10-21T12:00:00Z",
      },
      {
        id: "linea-2",
        operacion_id: "op-compra-1",
        stock_id: "stock-2",
        nombre: "Bujía Platino",
        codigo: "BUJ-002",
        cantidad: 4,
        cantidad_cumplida: 2,
        monto_unitario: 2500,
        delta_cantidad: 0,
        created_at: "2026-10-21T12:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza las líneas en formato tabla con saldo pendiente y pre-carga la cantidad restante", async () => {
    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={operacionCompra}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByText("Confirmar Recepción de Stock")).toBeInTheDocument();
    expect(screen.getByText("Producto / Ítem")).toBeInTheDocument();
    expect(screen.getByText("Pactadas")).toBeInTheDocument();
    expect(screen.getByText("Recibidas")).toBeInTheDocument();
    expect(screen.getByText("Resta")).toBeInTheDocument();

    expect(screen.getByText("Filtro de Aceite")).toBeInTheDocument();
    expect(screen.getByText("#FLT-001")).toBeInTheDocument();

    const inputCant1 = screen.getByTestId("stock-confirm-input-linea-1") as HTMLInputElement;
    expect(inputCant1.value).toBe("10");

    const inputCant2 = screen.getByTestId("stock-confirm-input-linea-2") as HTMLInputElement;
    expect(inputCant2.value).toBe("2");

    // Total a confirmar inicial: 10 + 2 = 12
    expect(screen.getByTestId("modal-submit")).toHaveTextContent("Confirmar Recepción (12 u.)");
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

    // Vaciamos primero para probar
    const clearBtn = screen.getByTestId("stock-confirm-clear-btn");
    await userEvent.click(clearBtn);

    const inputCant1 = screen.getByTestId("stock-confirm-input-linea-1") as HTMLInputElement;
    expect(inputCant1.value).toBe("0");

    // Escribimos 7 en linea-1
    await userEvent.clear(inputCant1);
    await userEvent.type(inputCant1, "7");

    const submitBtn = screen.getByTestId("modal-submit");
    expect(submitBtn).toBeEnabled();
    expect(submitBtn).toHaveTextContent("Confirmar Recepción (7 u.)");

    // Muestra alerta de recepción parcial
    expect(screen.getByText(/Recepción parcial/)).toBeInTheDocument();

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

  it("permite usar los botones 'Recibir todos' y 'Vaciar'", async () => {
    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={operacionCompra}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    const inputCant1 = screen.getByTestId("stock-confirm-input-linea-1") as HTMLInputElement;
    const inputCant2 = screen.getByTestId("stock-confirm-input-linea-2") as HTMLInputElement;

    // Vaciar
    await userEvent.click(screen.getByTestId("stock-confirm-clear-btn"));
    expect(inputCant1.value).toBe("0");
    expect(inputCant2.value).toBe("0");
    expect(screen.getByTestId("modal-submit")).toBeDisabled();

    // Recibir todos
    await userEvent.click(screen.getByTestId("stock-confirm-all-btn"));
    expect(inputCant1.value).toBe("10");
    expect(inputCant2.value).toBe("2");
    expect(screen.getByTestId("modal-submit")).toBeEnabled();
  });

  it("permite usar el botón 'Todo' en una fila individual", async () => {
    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={operacionCompra}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    // Vaciar todo
    await userEvent.click(screen.getByTestId("stock-confirm-clear-btn"));

    const inputCant1 = screen.getByTestId("stock-confirm-input-linea-1") as HTMLInputElement;
    expect(inputCant1.value).toBe("0");

    // Click 'Todo' en linea-1
    await userEvent.click(screen.getByTestId("stock-confirm-btn-todo-linea-1"));
    expect(inputCant1.value).toBe("10");
  });

  it("permite filtrar la tabla mediante el buscador", async () => {
    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={operacionCompra}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    const searchInput = screen.getByTestId("stock-confirm-search");
    await userEvent.type(searchInput, "Bujía");

    expect(screen.queryByText("Filtro de Aceite")).not.toBeInTheDocument();
    expect(screen.getByText("Bujía Platino")).toBeInTheDocument();

    // Filtrar por código
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, "FLT-001");
    expect(screen.getByText("Filtro de Aceite")).toBeInTheDocument();
    expect(screen.queryByText("Bujía Platino")).not.toBeInTheDocument();
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

    await userEvent.click(screen.getByTestId("stock-confirm-clear-btn"));
    expect(screen.getByTestId("modal-submit")).toBeDisabled();
  });

  it("renderiza el componente Calendar para la fecha del movimiento", async () => {
    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={operacionCompra}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    const fechaBtn = screen.getByTestId("stock-confirm-fecha");
    expect(fechaBtn).toBeInTheDocument();
    expect(fechaBtn).toHaveTextContent(/\d{2}\/\d{2}\/\d{4}/);
  });
});
