import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ProductoStockMatrix from "./ProductoStockMatrix";

describe("ProductoStockMatrix", () => {
  it("ofrece registrar operación solo para el taller con stock configurado", () => {
    const onRegisterOperation = vi.fn();
    const stock = {
      id: "S-1",
      productoId: "P-1",
      tallerId: "T-1",
      stockActual: 5,
      stockMinimo: 1,
      stockMaximo: 10,
      ultimaActualizacion: "27/08/2026",
      historialMovimientos: [],
    };
    const talleres = [
      { id: "T-1", nombre: "Taller Centro", ubicacion: "Centro" },
      { id: "T-2", nombre: "Taller Norte", ubicacion: "Norte" },
    ];

    render(
      <ProductoStockMatrix
        productoId="P-1"
        talleres={talleres}
        stocks={[stock]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onRegisterOperation={onRegisterOperation}
      />
    );

    fireEvent.click(screen.getByTestId("producto-stock-S-1-registrar-operacion"));

    expect(onRegisterOperation).toHaveBeenCalledWith(stock, talleres[0]);
    expect(screen.getByRole("button", { name: "Registrar operación en Taller Centro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar stock de Taller Centro" })).toBeInTheDocument();
  });
});
