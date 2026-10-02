import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RepuestoEditableFields from "./RepuestoEditableFields";

vi.mock("@/app/components/auth/Can", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("RepuestoEditableFields", () => {
  it("muestra la advertencia de costo 0 cuando showPurchaseUnit es true y precioCompra es 0", () => {
    render(
      <RepuestoEditableFields
        searchSlot={<div>Search</div>}
        cantidad="1"
        precioCompra="0"
        precioVenta="100"
        showPurchaseUnit={true}
        canInteract={true}
        onCantidadChange={vi.fn()}
        onPrecioCompraChange={vi.fn()}
        onPrecioVentaChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("zero-cost-warning")).toHaveTextContent(
      "⚠ Se registrará como adquisición sin costo"
    );
  });

  it("no muestra la advertencia cuando precioCompra es mayor a 0", () => {
    render(
      <RepuestoEditableFields
        searchSlot={<div>Search</div>}
        cantidad="1"
        precioCompra="50"
        precioVenta="100"
        showPurchaseUnit={true}
        canInteract={true}
        onCantidadChange={vi.fn()}
        onPrecioCompraChange={vi.fn()}
        onPrecioVentaChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId("zero-cost-warning")).not.toBeInTheDocument();
  });

  it("no muestra la advertencia ni el campo de compra cuando showPurchaseUnit es false", () => {
    render(
      <RepuestoEditableFields
        searchSlot={<div>Search</div>}
        cantidad="1"
        precioCompra="0"
        precioVenta="100"
        showPurchaseUnit={false}
        canInteract={true}
        onCantidadChange={vi.fn()}
        onPrecioCompraChange={vi.fn()}
        onPrecioVentaChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId("zero-cost-warning")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Precio compra")).not.toBeInTheDocument();
  });
});
