import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductosTabsNav from "./ProductosTabsNav";
import type { PermissionValue } from "@/lib/permissions";

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
        productosCount={15}
        proveedoresCount={3}
      />
    );

    expect(screen.getByText("Catálogo de Productos")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("Proveedores")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("cambia a la pestaña de proveedores al hacer click", () => {
    const onChange = vi.fn();
    render(
      <ProductosTabsNav
        activeTab="productos"
        onChangeTab={onChange}
        productosCount={15}
        proveedoresCount={3}
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
        productosCount={15}
        proveedoresCount={3}
      />
    );

    fireEvent.click(screen.getByTestId("tab-productos"));
    expect(onChange).toHaveBeenCalledWith("productos");
  });
});
