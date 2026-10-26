import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PagoBadge, { calcularEstadoPago } from "./PagoBadge";

describe("calcularEstadoPago", () => {
  it("retorna PENDIENTE si no se cobró nada y estaPago es falso", () => {
    expect(calcularEstadoPago({ totalCobrado: 0, precioFinal: 10000, estaPago: false })).toBe("PENDIENTE");
  });

  it("retorna PAGADO si estaPago es true sin monto cobrado", () => {
    expect(calcularEstadoPago({ totalCobrado: 0, precioFinal: 10000, estaPago: true })).toBe("PAGADO");
  });

  it("retorna PARCIAL si el monto cobrado es menor al precio final", () => {
    expect(calcularEstadoPago({ totalCobrado: 4000, precioFinal: 10000 })).toBe("PARCIAL");
  });

  it("retorna PAGADO si el monto cobrado es igual al precio final", () => {
    expect(calcularEstadoPago({ totalCobrado: 10000, precioFinal: 10000 })).toBe("PAGADO");
  });

  it("retorna SOBREPAGO si el monto cobrado supera al precio final", () => {
    expect(calcularEstadoPago({ totalCobrado: 12000, precioFinal: 10000 })).toBe("SOBREPAGO");
  });
});

describe("PagoBadge", () => {
  it("renderiza Pago pendiente cuando el total cobrado es 0", () => {
    render(<PagoBadge totalCobrado={0} precioFinal={10000} />);
    const badge = screen.getByTestId("pago-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Pago pendiente");
  });

  it("renderiza Pagado cuando se pasa estado PAGADO", () => {
    render(<PagoBadge estado="PAGADO" />);
    const badge = screen.getByTestId("pago-badge");
    expect(badge).toHaveTextContent("Pagado");
  });

  it("renderiza saldo pendiente en estado PARCIAL", () => {
    render(<PagoBadge totalCobrado={4000} precioFinal={10000} saldoPendiente={6000} />);
    expect(screen.getByTestId("pago-badge")).toHaveTextContent("$6.000");
  });

  it("renderiza 'Parcial' cuando estado es PARCIAL sin saldo pendiente", () => {
    render(<PagoBadge estado="PARCIAL" />);
    expect(screen.getByTestId("pago-badge")).toHaveTextContent("Parcial");
  });

  it("renderiza Saldo a favor en SOBREPAGO", () => {
    render(<PagoBadge estado="SOBREPAGO" />);
    expect(screen.getByTestId("pago-badge")).toHaveTextContent("Saldo a favor");
  });

  it("renderiza estado de carga cuando loading=true", () => {
    render(<PagoBadge loading />);
    expect(screen.getByTestId("pago-badge")).toHaveTextContent("Actualizando...");
  });

  it("ejecuta onClick y renderiza como botón cuando es interactivo", () => {
    const handleClick = vi.fn();
    render(<PagoBadge estado="PAGADO" onClick={handleClick} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
