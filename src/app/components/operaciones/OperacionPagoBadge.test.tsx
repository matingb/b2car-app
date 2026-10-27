import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import OperacionPagoBadge from "./OperacionPagoBadge";
import type { Operacion } from "@/model/types";

vi.mock("./OperacionPagoModal", () => ({
  __esModule: true,
  default: ({
    open,
    onClose,
    onSuccess,
  }: {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }) =>
    open ? (
      <div data-testid="mock-operacion-pago-modal">
        <button type="button" onClick={onClose} data-testid="mock-modal-close">
          Cerrar
        </button>
        <button type="button" onClick={onSuccess} data-testid="mock-modal-confirm">
          Confirmar
        </button>
      </div>
    ) : null,
}));

describe("OperacionPagoBadge", () => {
  const baseVenta: Operacion = {
    id: "op-1",
    tipo: "VENTA",
    taller_id: "taller-1",
    fecha: "2026-10-26T12:00:00Z",
    created_at: "2026-10-26T12:00:00Z",
    monto_total: 10000,
    total_pagado: 0,
    saldo_pendiente: 10000,
    esta_pago: false,
    estado_pago: "PENDIENTE",
    lineas: [],
  };

  it("renderiza 'Pago pendiente' para una venta pendiente de cobro", () => {
    render(<OperacionPagoBadge operacion={baseVenta} />);

    expect(screen.getByText("Pago pendiente")).toBeInTheDocument();
    expect(screen.getByTestId("operacion-pago-badge")).toBeInTheDocument();
  });

  it("al hacer click en el badge, no propaga el evento al card y abre el modal de cobro", () => {
    const onCardClick = vi.fn();

    render(
      <div onClick={onCardClick} data-testid="parent-card">
        <OperacionPagoBadge operacion={baseVenta} />
      </div>
    );

    const badge = screen.getByRole("button", { name: /Pago pendiente/i });
    fireEvent.click(badge);

    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("mock-operacion-pago-modal")).toBeInTheDocument();
  });

  it("renderiza 'Pendiente: $X' para una venta con cobro parcial y permite registrar cobro", () => {
    const parcialVenta: Operacion = {
      ...baseVenta,
      estado_pago: "PARCIAL",
      total_pagado: 4000,
      saldo_pendiente: 6000,
    };

    const onCardClick = vi.fn();

    render(
      <div onClick={onCardClick}>
        <OperacionPagoBadge operacion={parcialVenta} />
      </div>
    );

    expect(screen.getByText("Pendiente: $6.000")).toBeInTheDocument();

    const badge = screen.getByRole("button", { name: /Pendiente: \$6\.000/i });
    fireEvent.click(badge);

    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("mock-operacion-pago-modal")).toBeInTheDocument();
  });

  it("renderiza 'Pagado' cuando la operacion esta completamente paga y click no despliega la card", () => {
    const pagadaVenta: Operacion = {
      ...baseVenta,
      estado_pago: "PAGADO",
      total_pagado: 10000,
      saldo_pendiente: 0,
      esta_pago: true,
    };

    const onCardClick = vi.fn();

    render(
      <div onClick={onCardClick}>
        <OperacionPagoBadge operacion={pagadaVenta} />
      </div>
    );

    expect(screen.getByText("Pagado")).toBeInTheDocument();
    const badge = screen.getByTestId("operacion-pago-badge");
    fireEvent.click(badge);

    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mock-operacion-pago-modal")).not.toBeInTheDocument();
  });

  it("no renderiza badge para operaciones no comerciales (como GASTO)", () => {
    const gasto: Operacion = {
      ...baseVenta,
      tipo: "GASTO",
    };

    const { container } = render(<OperacionPagoBadge operacion={gasto} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("no renderiza badge para compras sin cargo (monto total 0)", () => {
    const sinCargo: Operacion = {
      ...baseVenta,
      tipo: "COMPRA",
      monto_total: 0,
      total_pagado: 0,
      saldo_pendiente: 0,
    };

    const { container } = render(<OperacionPagoBadge operacion={sinCargo} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("llama a onPagoUpdated cuando el modal se completa exitosamente", () => {
    const onPagoUpdated = vi.fn();

    render(
      <OperacionPagoBadge operacion={baseVenta} onPagoUpdated={onPagoUpdated} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Pago pendiente/i }));
    expect(screen.getByTestId("mock-operacion-pago-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-modal-confirm"));
    expect(onPagoUpdated).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("mock-operacion-pago-modal")).not.toBeInTheDocument();
  });

  it("permite pasar un handler custom onClick y detiene la propagacion", () => {
    const onCardClick = vi.fn();
    const customClick = vi.fn();

    render(
      <div onClick={onCardClick}>
        <OperacionPagoBadge operacion={baseVenta} onClick={customClick} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: /Pago pendiente/i }));

    expect(onCardClick).not.toHaveBeenCalled();
    expect(customClick).toHaveBeenCalledTimes(1);
  });
});
