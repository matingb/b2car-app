import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render, TenantTestProvider } from "@/tests/testUtils";
import ClienteTabsNav from "./ClienteTabsNav";
import { hasPermission, UserRole } from "@/lib/permissions";

describe("ClienteTabsNav", () => {
  it("renderiza todas las pestañas y destaca la activa", () => {
    const onChangeTab = vi.fn();
    render(
      <ClienteTabsNav
        activeTab="vehiculos"
        onChangeTab={onChangeTab}
        vehiculosCount={4}
        arreglosCount={12}
      />
    );

    expect(screen.getByText("Vehículos")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Arreglos")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Cuenta Corriente")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cuenta Corriente"));
    expect(onChangeTab).toHaveBeenCalledWith("cuenta_corriente");
  });

  it("oculta la pestaña Cuenta Corriente para un rol operativo", () => {
    const onChangeTab = vi.fn();
    render(
      <TenantTestProvider
        hasPermission={(p) => hasPermission(UserRole.Operativo, p)}
      >
        <ClienteTabsNav
          activeTab="vehiculos"
          onChangeTab={onChangeTab}
          vehiculosCount={4}
          arreglosCount={12}
        />
      </TenantTestProvider>
    );

    expect(screen.getByText("Vehículos")).toBeInTheDocument();
    expect(screen.getByText("Arreglos")).toBeInTheDocument();
    expect(screen.queryByText("Cuenta Corriente")).not.toBeInTheDocument();
  });
});
