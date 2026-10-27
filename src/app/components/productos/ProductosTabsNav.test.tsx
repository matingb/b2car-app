import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductosTabsNav from "./ProductosTabsNav";

vi.mock("@/app/components/auth/Can", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("ProductosTabsNav", () => {
  it("renderiza las dos pestañas con sus conteos", () => {
    const onChange = vi.fn();
    render(
      <ProductosTabsNav
        activeTab="productos"
        onChangeTab={onChange}
      />
    );

    expect(screen.getByText("Catálogo de Productos")).toBeInTheDocument();
    expect(screen.getByText("Proveedores")).toBeInTheDocument();
  });

  it("cambia a la pestaña de proveedores al hacer click", () => {
    const onChange = vi.fn();
    render(
      <ProductosTabsNav
        activeTab="productos"
        onChangeTab={onChange}
      />
    );

    fireEvent.click(screen.getByTestId("tab-proveedores"));
    expect(onChange).toHaveBeenCalledWith("proveedores");
  });

  it("cambia a la pestaña de productos al hacer click", () => {
    const onChange = vi.fn();
    render(
      <ProductosTabsNav
        activeTab="proveedores"
        onChangeTab={onChange}
      />
    );

    fireEvent.click(screen.getByTestId("tab-productos"));
    expect(onChange).toHaveBeenCalledWith("productos");
  });
});
