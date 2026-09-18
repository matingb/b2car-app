import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render, TenantTestProvider, mockHasPermission } from "@/tests/testUtils";
import ClienteTabsSection, { ClienteTabsContent } from "./ClienteTabsSection";
import { UserRole } from "@/lib/permissions";
import { Vehiculo } from "@/model/types";

vi.mock("./VehiculosAsociadosCard", () => ({
  default: ({ vehiculos, onAddVehiculo }: { vehiculos: Vehiculo[]; onAddVehiculo?: () => void }) => (
    <div data-testid="vehiculos-asociados-card">
      <span>Vehiculos count: {vehiculos.length}</span>
      {onAddVehiculo && <button onClick={onAddVehiculo}>Agregar Vehiculo</button>}
    </div>
  ),
}));

vi.mock("./ClienteArreglosTab", () => ({
  default: ({ clienteId }: { clienteId: string }) => (
    <div data-testid="cliente-arreglos-tab">Arreglos de {clienteId}</div>
  ),
}));

vi.mock("./ClienteCuentaCorrienteTab", () => ({
  default: ({ clienteId }: { clienteId: string }) => (
    <div data-testid="cliente-cuenta-corriente-tab">Cuenta Corriente de {clienteId}</div>
  ),
}));

const mockVehiculos: Vehiculo[] = [
  {
    id: "v-1",
    patente: "AA123BB",
    marca: "Toyota",
    modelo: "Corolla",
    nombre_cliente: "Juan Perez",
    fecha_patente: "2020-01-01",
    numero_chasis: "1234567890",
  },
];

describe("ClienteTabsSection", () => {
  it("renderiza por defecto la pestaña de vehículos y maneja onAddVehiculo", () => {
    const onAddVehiculo = vi.fn();
    render(
      <ClienteTabsSection
        clienteId="cli-1"
        vehiculos={mockVehiculos}
        onAddVehiculo={onAddVehiculo}
      />
    );

    expect(screen.getByTestId("vehiculos-asociados-card")).toBeInTheDocument();
    expect(screen.getByText("Vehiculos count: 1")).toBeInTheDocument();
    expect(screen.queryByTestId("cliente-arreglos-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cliente-cuenta-corriente-tab")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Agregar Vehiculo" }));
    expect(onAddVehiculo).toHaveBeenCalledTimes(1);
  });

  it("cambia a la pestaña de arreglos al hacer click", () => {
    render(
      <ClienteTabsSection
        clienteId="cli-1"
        vehiculos={mockVehiculos}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Arreglos/i }));

    expect(screen.getByTestId("cliente-arreglos-tab")).toBeInTheDocument();
    expect(screen.getByText("Arreglos de cli-1")).toBeInTheDocument();
    expect(screen.queryByTestId("vehiculos-asociados-card")).not.toBeInTheDocument();
  });

  it("cambia a la pestaña de cuenta corriente al hacer click", () => {
    render(
      <ClienteTabsSection
        clienteId="cli-1"
        vehiculos={mockVehiculos}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Cuenta Corriente/i }));

    expect(screen.getByTestId("cliente-cuenta-corriente-tab")).toBeInTheDocument();
    expect(screen.getByText("Cuenta Corriente de cli-1")).toBeInTheDocument();
    expect(screen.queryByTestId("vehiculos-asociados-card")).not.toBeInTheDocument();
  });

  it("oculta la pestaña y el contenido de Cuenta Corriente si el rol no tiene permisos", () => {
    render(
      <TenantTestProvider
        hasPermission={mockHasPermission(UserRole.Operativo)}
      >
        <ClienteTabsSection
          clienteId="cli-1"
          vehiculos={mockVehiculos}
        />
      </TenantTestProvider>
    );

    expect(screen.queryByRole("button", { name: /Cuenta Corriente/i })).not.toBeInTheDocument();
  });

  it("funciona en modo controlado", () => {
    const onChangeTab = vi.fn();
    const { rerender } = render(
      <ClienteTabsSection
        clienteId="cli-1"
        vehiculos={mockVehiculos}
        activeTab="arreglos"
        onChangeTab={onChangeTab}
      />
    );

    expect(screen.getByTestId("cliente-arreglos-tab")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Vehículos/i }));
    expect(onChangeTab).toHaveBeenCalledWith("vehiculos");

    rerender(
      <ClienteTabsSection
        clienteId="cli-1"
        vehiculos={mockVehiculos}
        activeTab="vehiculos"
        onChangeTab={onChangeTab}
      />
    );
    expect(screen.getByTestId("vehiculos-asociados-card")).toBeInTheDocument();
  });
});

describe("ClienteTabsContent", () => {
  it("renderiza el contenido correspondiente según activeTab", () => {
    const { rerender } = render(
      <ClienteTabsContent
        activeTab="vehiculos"
        clienteId="cli-1"
        vehiculos={mockVehiculos}
      />
    );
    expect(screen.getByTestId("vehiculos-asociados-card")).toBeInTheDocument();

    rerender(
      <ClienteTabsContent
        activeTab="arreglos"
        clienteId="cli-1"
        vehiculos={mockVehiculos}
      />
    );
    expect(screen.getByTestId("cliente-arreglos-tab")).toBeInTheDocument();

    rerender(
      <ClienteTabsContent
        activeTab="cuenta_corriente"
        clienteId="cli-1"
        vehiculos={mockVehiculos}
      />
    );
    expect(screen.getByTestId("cliente-cuenta-corriente-tab")).toBeInTheDocument();
  });
});
