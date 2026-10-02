import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductoPricesCard from "./ProductoPricesCard";

describe("ProductoPricesCard", () => {
  it("muestra N/A de margen cuando costoUnitario es 0 y precioUnitario > 0", () => {
    render(
      <ProductoPricesCard
        costoUnitario={0}
        precioUnitario={1500}
        stockTotal={5}
        isEditing={false}
        draft={{ costoUnitario: 0, precioUnitario: 1500 }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("calcula y muestra porcentaje de margen cuando costoUnitario > 0", () => {
    render(
      <ProductoPricesCard
        costoUnitario={500}
        precioUnitario={1500}
        stockTotal={5}
        isEditing={false}
        draft={{ costoUnitario: 500, precioUnitario: 1500 }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("200.0%")).toBeInTheDocument();
  });
});
