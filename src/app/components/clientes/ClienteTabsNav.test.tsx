import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render, TenantTestProvider, mockHasPermission } from "@/tests/testUtils";
import ClienteTabsNav from "./ClienteTabsNav";
import { UserRole } from "@/lib/permissions";

describe("ClienteTabsNav", () => {
  it("renderiza todas las pestañas y destaca la activa", () => {
    const onChangeTab = vi.fn();
    render(
      <ClienteTabsNav
        activeTab="vehiculos"
        onChangeTab={onChangeTab}
      />
    );

    expect(screen.getByText("Vehículos")).toBeInTheDocument();
    expect(screen.getByText("Arreglos")).toBeInTheDocument();
    expect(screen.getByText("Ventas")).toBeInTheDocument();
    expect(screen.getByText("Cuenta Corriente")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ventas"));
    expect(onChangeTab).toHaveBeenCalledWith("ventas");

    fireEvent.click(screen.getByText("Cuenta Corriente"));
    expect(onChangeTab).toHaveBeenCalledWith("cuenta_corriente");
  });

  it("oculta las pestañas de Ventas y Cuenta Corriente si el rol no tiene permisos", () => {
    const onChangeTab = vi.fn();
    render(
      <TenantTestProvider
        hasPermission={mockHasPermission(UserRole.Operativo)}
      >
        <ClienteTabsNav
          activeTab="vehiculos"
          onChangeTab={onChangeTab}
        />
      </TenantTestProvider>
    );

    expect(screen.getByText("Vehículos")).toBeInTheDocument();
    expect(screen.getByText("Arreglos")).toBeInTheDocument();
    expect(screen.queryByText("Ventas")).not.toBeInTheDocument();
    expect(screen.queryByText("Cuenta Corriente")).not.toBeInTheDocument();
  });
});
