import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StockPurchaseHint from "./StockPurchaseHint";

describe("StockPurchaseHint", () => {
  it("muestra el costo por unidad cuando precioCompra > 0", () => {
    render(<StockPurchaseHint stockActual={2} faltante={3} precioCompra={1500} />);
    expect(screen.getByText(/Se comprarán 3 unidades a \$1\.500 c\/u al guardar/i)).toBeInTheDocument();
  });

  it("muestra a costo $0 (sin cargo) cuando precioCompra === 0", () => {
    render(<StockPurchaseHint stockActual={0} faltante={1} precioCompra={0} />);
    expect(screen.getByText(/Se comprarán 1 unidad a costo \$0 \(sin cargo\) al guardar/i)).toBeInTheDocument();
  });

  it("muestra al activar el arreglo cuando deferred es true", () => {
    render(<StockPurchaseHint stockActual={1} faltante={2} precioCompra={0} deferred={true} />);
    expect(screen.getByText(/al activar el arreglo/i)).toBeInTheDocument();
  });
});
