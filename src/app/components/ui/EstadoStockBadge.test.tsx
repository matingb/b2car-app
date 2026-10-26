import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EstadoStockBadge, {
  getEstadoStockColor,
  getEstadoStockLabel,
} from "./EstadoStockBadge";

describe("getEstadoStockLabel", () => {
  it("retorna etiquetas compactas por defecto para compras", () => {
    expect(getEstadoStockLabel({ estado: "ENTREGADO" })).toBe("Recibido");
    expect(getEstadoStockLabel({ estado: "PARCIAL" })).toBe("Parcial");
    expect(getEstadoStockLabel({ estado: "PENDIENTE" })).toBe("Pendiente");
    expect(getEstadoStockLabel({ estado: "NO_APLICA" })).toBe("N/A");
    expect(getEstadoStockLabel({ estado: null })).toBe("N/A");
  });

  it("retorna etiquetas descriptivas cuando compact es false para compras", () => {
    expect(
      getEstadoStockLabel({ estado: "ENTREGADO", tipo: "COMPRA", compact: false })
    ).toBe("Recibido");
    expect(
      getEstadoStockLabel({ estado: "PARCIAL", tipo: "COMPRA", compact: false })
    ).toBe("Recepción parcial");
    expect(
      getEstadoStockLabel({ estado: "PENDIENTE", tipo: "COMPRA", compact: false })
    ).toBe("En camino");
  });

  it("retorna etiquetas para ventas", () => {
    expect(getEstadoStockLabel({ estado: "ENTREGADO", tipo: "VENTA" })).toBe(
      "Entregado"
    );
    expect(
      getEstadoStockLabel({ estado: "PARCIAL", tipo: "VENTA", compact: false })
    ).toBe("Entrega parcial");
    expect(
      getEstadoStockLabel({ estado: "PENDIENTE", tipo: "VENTA", compact: false })
    ).toBe("Mercadería reservada");
  });
});

describe("getEstadoStockColor", () => {
  it("asigna los colores correspondientes", () => {
    expect(getEstadoStockColor("ENTREGADO")).toBe("success");
    expect(getEstadoStockColor("PARCIAL")).toBe("warning");
    expect(getEstadoStockColor("PENDIENTE")).toBe("info");
    expect(getEstadoStockColor("NO_APLICA")).toBe("neutral");
    expect(getEstadoStockColor(undefined)).toBe("neutral");
  });
});

describe("EstadoStockBadge", () => {
  it("renderiza correctamente el badge de ENTREGADO", () => {
    render(<EstadoStockBadge estado="ENTREGADO" />);
    const badge = screen.getByTestId("estado-stock-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Recibido");
  });

  it("renderiza correctamente PARCIAL", () => {
    render(<EstadoStockBadge estado="PARCIAL" />);
    expect(screen.getByTestId("estado-stock-badge")).toHaveTextContent("Parcial");
  });

  it("renderiza correctamente PENDIENTE", () => {
    render(<EstadoStockBadge estado="PENDIENTE" />);
    expect(screen.getByTestId("estado-stock-badge")).toHaveTextContent("Pendiente");
  });

  it("renderiza N/A para NO_APLICA", () => {
    render(<EstadoStockBadge estado="NO_APLICA" />);
    expect(screen.getByTestId("estado-stock-badge")).toHaveTextContent("N/A");
  });

  it("soporta interactividad onClick", () => {
    const handleClick = vi.fn();
    render(<EstadoStockBadge estado="ENTREGADO" onClick={handleClick} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
