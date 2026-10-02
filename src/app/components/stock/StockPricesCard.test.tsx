import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StockPricesCard from "./StockPricesCard";
import type { StockItem } from "@/model/stock";

const mockStock: StockItem = {
  id: "stock-1",
  productoId: "prod-1",
  nombre: "Filtro",
  codigo: "FILT-01",
  categorias: ["Filtros"],
  tallerId: "taller-1",
  stockActual: 10,
  stockMinimo: 0,
  stockMaximo: 50,
  costoUnitario: 0,
  precioUnitario: 1000,
  proveedor: "Bosch",
  showInStock: true,
  ultimaActualizacion: "2026-01-01",
  historialMovimientos: [],
};

describe("StockPricesCard", () => {
  it("muestra N/A de margen cuando costoUnitario es 0 y precioUnitario > 0", () => {
    render(
      <StockPricesCard
        item={mockStock}
        draft={mockStock}
        isEditing={false}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("calcula y muestra porcentaje de margen cuando costoUnitario > 0", () => {
    const stockWithCost: StockItem = {
      ...mockStock,
      costoUnitario: 500,
      precioUnitario: 1000,
    };
    render(
      <StockPricesCard
        item={stockWithCost}
        draft={stockWithCost}
        isEditing={false}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("100.0%")).toBeInTheDocument();
  });
});
