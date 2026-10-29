import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";
import OperacionStockBadge from "./OperacionStockBadge";
import type { Operacion } from "@/model/types";

// Mock del modal para verificar apertura e interacción directa
vi.mock("@/app/components/operaciones/OperacionStockConfirmModal", () => ({
  default: ({
    open,
    operacion,
    onClose,
    onSuccess,
  }: {
    open: boolean;
    operacion: Operacion;
    onClose: () => void;
    onSuccess?: () => void;
  }) =>
    open ? (
      <div data-testid="mock-stock-confirm-modal">
        <span>Modal Stock para {operacion.id}</span>
        <button type="button" onClick={onClose} data-testid="mock-modal-close">
          Cerrar
        </button>
        <button
          type="button"
          onClick={() => {
            onSuccess?.();
            onClose();
          }}
          data-testid="mock-modal-confirm"
        >
          Confirmar
        </button>
      </div>
    ) : null,
}));

describe("OperacionStockBadge", () => {
  const operacionCompraPendiente: Operacion = {
    id: "op-compra-1",
    tipo: "COMPRA",
    taller_id: "taller-1",
    fecha: "2026-10-21T12:00:00Z",
    created_at: "2026-10-21T12:00:00Z",
    monto_total: 10000,
    estado_pago: "PAGADO",
    estado_stock: "PENDIENTE",
    lineas: [],
  };

  const operacionVentaParcial: Operacion = {
    id: "op-venta-1",
    tipo: "VENTA",
    taller_id: "taller-1",
    fecha: "2026-10-21T12:00:00Z",
    created_at: "2026-10-21T12:00:00Z",
    monto_total: 15000,
    estado_pago: "PAGADO",
    estado_stock: "PARCIAL",
    lineas: [],
  };

  const operacionVentaEntregada: Operacion = {
    id: "op-venta-2",
    tipo: "VENTA",
    taller_id: "taller-1",
    fecha: "2026-10-21T12:00:00Z",
    created_at: "2026-10-21T12:00:00Z",
    monto_total: 15000,
    estado_pago: "PAGADO",
    estado_stock: "ENTREGADO",
    lineas: [],
  };

  it("renderiza etiqueta adecuada según tipo y estado de stock", () => {
    const { rerender } = render(
      <OperacionStockBadge operacion={operacionCompraPendiente} />
    );
    expect(screen.getByText("En camino")).toBeInTheDocument();

    rerender(<OperacionStockBadge operacion={operacionVentaParcial} />);
    expect(screen.getByText("Entrega parcial")).toBeInTheDocument();

    rerender(<OperacionStockBadge operacion={operacionVentaEntregada} />);
    expect(screen.getByText("Entregado")).toBeInTheDocument();
  });

  it("abre el modal de confirmación de stock al hacer click en el badge interactivo", async () => {
    const onStockUpdated = vi.fn();

    render(
      <OperacionStockBadge
        operacion={operacionCompraPendiente}
        onStockUpdated={onStockUpdated}
      />
    );

    const badge = screen.getByTestId("operacion-estado-stock-badge");
    expect(badge).toBeInTheDocument();
    expect(screen.queryByTestId("mock-stock-confirm-modal")).not.toBeInTheDocument();

    await userEvent.click(badge);
    await runPendingPromises();

    expect(screen.getByTestId("mock-stock-confirm-modal")).toBeInTheDocument();
    expect(screen.getByText("Modal Stock para op-compra-1")).toBeInTheDocument();

    // Confirmar en el modal llama a onStockUpdated
    await userEvent.click(screen.getByTestId("mock-modal-confirm"));
    await runPendingPromises();

    expect(onStockUpdated).toHaveBeenCalled();
    expect(screen.queryByTestId("mock-stock-confirm-modal")).not.toBeInTheDocument();
  });

  it("es interactivo y abre el modal cuando el stock ya está ENTREGADO", async () => {
    render(<OperacionStockBadge operacion={operacionVentaEntregada} />);

    const badge = screen.getByTestId("operacion-estado-stock-badge");
    expect(badge).toHaveAttribute("role", "button");

    await userEvent.click(badge);
    await runPendingPromises();

    expect(screen.getByTestId("mock-stock-confirm-modal")).toBeInTheDocument();
    expect(screen.getByText("Modal Stock para op-venta-2")).toBeInTheDocument();
  });

  it("detiene la propagación del evento click para evitar colapsar/expandir el card contenedor", async () => {
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick} data-testid="parent-card">
        <OperacionStockBadge operacion={operacionVentaParcial} />
      </div>
    );

    const badge = screen.getByTestId("operacion-estado-stock-badge");
    await userEvent.click(badge);
    await runPendingPromises();

    expect(parentClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("mock-stock-confirm-modal")).toBeInTheDocument();
  });
});
