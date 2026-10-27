import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render, TenantTestProvider, mockHasPermission } from "@/tests/testUtils";
import ProveedorTabsNav from "./ProveedorTabsNav";
import { UserRole } from "@/lib/permissions";

describe("ProveedorTabsNav", () => {
  it("renderiza las pestañas de Productos, Operaciones y Cuenta Corriente y cambia al hacer click", () => {
    const onChangeTab = vi.fn();
    render(
      <ProveedorTabsNav
        activeTab="productos"
        onChangeTab={onChangeTab}
        productosCount={5}
      />
    );

    expect(screen.getByText("Productos")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Operaciones")).toBeInTheDocument();
    expect(screen.getByText("Cuenta Corriente")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Operaciones"));
    expect(onChangeTab).toHaveBeenCalledWith("operaciones");

    fireEvent.click(screen.getByText("Cuenta Corriente"));
    expect(onChangeTab).toHaveBeenCalledWith("cuenta_corriente");
  });

  it("oculta pestañas de Operaciones y Cuenta Corriente si el rol no tiene OperacionesView", () => {
    const onChangeTab = vi.fn();
    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Operativo)}>
        <ProveedorTabsNav
          activeTab="productos"
          onChangeTab={onChangeTab}
          productosCount={3}
        />
      </TenantTestProvider>
    );

    expect(screen.getByText("Productos")).toBeInTheDocument();
    expect(screen.queryByText("Operaciones")).not.toBeInTheDocument();
    expect(screen.queryByText("Cuenta Corriente")).not.toBeInTheDocument();
  });
});
