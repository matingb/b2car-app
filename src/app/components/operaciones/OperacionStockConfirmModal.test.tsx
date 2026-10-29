import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";
import OperacionStockConfirmModal from "./OperacionStockConfirmModal";
import type { Operacion } from "@/model/types";

const mockConfirmarStock = vi.fn();
const mockRevertirStock = vi.fn();
const mockFetchById = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockConfirm = vi.fn();

vi.mock("@/app/providers/OperacionesProvider", () => ({
  useOperaciones: () => ({
    confirmarStock: mockConfirmarStock,
    revertirStock: mockRevertirStock,
    fetchById: mockFetchById,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: mockConfirm,
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

  const operacionVentaEntregada: Operacion = {
    id: "op-venta-entregada",
    tipo: "VENTA",
    taller_id: "taller-1",
    fecha: "2026-10-21T12:00:00Z",
    created_at: "2026-10-21T12:00:00Z",
    monto_total: 10000,
    total_pagado: 10000,
    saldo_pendiente: 0,
    esta_pago: true,
    estado_pago: "PAGADO",
    estado_stock: "ENTREGADO",
    lineas: [
      {
        id: "linea-1",
        operacion_id: "op-venta-entregada",
        stock_id: "stock-1",
        nombre: "Filtro de Aceite",
        codigo: "FLT-001",
        cantidad: 2,
        cantidad_cumplida: 2,
        monto_unitario: 5000,
        delta_cantidad: -2,
        created_at: "2026-10-21T12:00:00Z",
      },
    ],
    movimientos_stock: [
      {
        id: "mov-stock-1",
        fecha: "2026-10-21T12:00:00Z",
        cantidad: -2,
        saldo_anterior: 10,
        saldo_posterior: 8,
        producto_id: "prod-1",
        stock_id: "stock-1",
        producto_nombre: "Filtro de Aceite",
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
    });
  });

  it("renderiza la vista completada cuando todo el stock fue entregado con alerta, historial y botón Cerrar", async () => {
    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={operacionVentaEntregada}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByText("Gestión de Entrega de Stock")).toBeInTheDocument();
    expect(screen.getByTestId("stock-completado-alert")).toBeInTheDocument();
    expect(
      screen.getByText("Todo el stock de esta operación se encuentra entregado.")
    ).toBeInTheDocument();

    // No debe haber botón de submit
    expect(screen.queryByTestId("modal-submit")).not.toBeInTheDocument();
    expect(screen.getByTestId("operacion-stock-close-btn")).toBeInTheDocument();

    // Debe mostrar la fila de resumen
    expect(screen.getByTestId("stock-summary-row-linea-1")).toBeInTheDocument();

    // Debe mostrar el historial de entregas desplegable
    expect(screen.getByTestId("operacion-stock-historial-toggle")).toBeInTheDocument();
  });

  it("permite revertir un movimiento de stock llamando a confirm y revertirStock", async () => {
    mockConfirm.mockResolvedValue(true);
    mockRevertirStock.mockResolvedValue({
      ...operacionVentaEntregada,
      estado_stock: "PENDIENTE",
      movimientos_stock: [],
      lineas: [
        {
          ...operacionVentaEntregada.lineas[0],
          cantidad_cumplida: 0,
        },
      ],
    });

    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={operacionVentaEntregada}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    // Desplegar historial
    const toggle = screen.getByTestId("operacion-stock-historial-toggle");
    await userEvent.click(toggle);

    const btnRevertir = screen.getByTestId("btn-revertir-stock-mov-stock-1");
    expect(btnRevertir).toBeInTheDocument();

    await userEvent.click(btnRevertir);
    await runPendingPromises();

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Revertir"),
        acceptLabel: "Revertir",
        cancelLabel: "Cancelar",
      })
    );

    expect(mockRevertirStock).toHaveBeenCalledWith("op-venta-entregada", "mov-stock-1");
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Entrega revertida",
      expect.stringContaining("2 u.")
    );
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

  it("no muestra reversiones en el modal y no permite revertir movimientos revertidos", async () => {
    const opConReversion: Operacion = {
      ...operacionVentaEntregada,
      movimientos_stock: [
        {
          id: "mov-original-revertido",
          fecha: "2026-10-21T12:00:00Z",
          cantidad: -2,
          saldo_anterior: 10,
          saldo_posterior: 8,
          producto_id: "prod-1",
          stock_id: "stock-1",
          producto_nombre: "Filtro de Aceite",
          created_at: "2026-10-21T12:00:00Z",
          revertido: true,
        },
        {
          id: "mov-reversion",
          fecha: "2026-10-22T10:00:00Z",
          cantidad: 2,
          saldo_anterior: 8,
          saldo_posterior: 10,
          producto_id: "prod-1",
          stock_id: "stock-1",
          producto_nombre: "Filtro de Aceite",
          created_at: "2026-10-22T10:00:00Z",
          tipo_movimiento: "REVERSION",
          reversion_de_id: "mov-original-revertido",
        },
      ],
    };

    render(
      <OperacionStockConfirmModal
        open={true}
        operacion={opConReversion}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    // Desplegar historial
    const toggle = screen.getByTestId("operacion-stock-historial-toggle");
    await userEvent.click(toggle);

    // La reversión NO debe aparecer en el modal
    expect(screen.queryByTestId("stock-historial-item-mov-reversion")).not.toBeInTheDocument();

    // El movimiento original revertido aparece marcado como Revertido y SIN botón de revertir
    expect(screen.getByTestId("stock-historial-item-mov-original-revertido")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-revertir-stock-mov-original-revertido")).not.toBeInTheDocument();
    expect(mockRevertirStock).not.toHaveBeenCalled();
  });
});
