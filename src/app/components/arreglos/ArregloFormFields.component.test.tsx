import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArregloFormFields, { type ArregloFormFieldsValues } from "./ArregloFormFields";
import { TenantTestProvider } from "@/tests/testUtils";
import { hasPermission, UserRole } from "@/lib/permissions";

vi.mock("@/app/providers/CategoriasArregloProvider", () => ({
  useCategoriasArreglo: () => ({ categorias: [], isLoading: false }),
}));

vi.mock("@/app/providers/EmpleadosProvider", () => ({
  useEmpleados: () => ({ empleados: [], isLoading: false }),
}));

vi.mock("@/app/providers/InventarioProvider", () => ({
  useInventario: () => ({ inventario: [], isLoading: false }),
}));

const baseValues: ArregloFormFieldsValues = {
  estado: "SIN_INICIAR",
  fecha: "2026-05-16",
  km: "12345",
  combustible: "50",
  observaciones: "",
  estaPago: false,
  extraData: "",
  selectedVehiculoId: "veh-1",
  esFacturable: true,
};

describe("ArregloFormFields permissions", () => {
  it("muestra ¿Esta pago? y Total calculado para un rol admin", () => {
    render(
      <TenantTestProvider
        hasPermission={(p) => hasPermission(UserRole.Admin, p)}
      >
        <ArregloFormFields
          vehiculoId="veh-1"
          vehiculoOptions={[]}
          isEdit={false}
          showFacturable={true}
          submitting={false}
          tallerId="taller-1"
          values={baseValues}
          onValuesChange={vi.fn()}
        />
      </TenantTestProvider>
    );

    expect(screen.getByText("¿Esta pago?")).toBeInTheDocument();
    expect(screen.getByText("Total calculado")).toBeInTheDocument();
  });

  it("oculta ¿Esta pago? y Total calculado para un rol operativo", () => {
    render(
      <TenantTestProvider
        hasPermission={(p) => hasPermission(UserRole.Operativo, p)}
      >
        <ArregloFormFields
          vehiculoId="veh-1"
          vehiculoOptions={[]}
          isEdit={false}
          showFacturable={false}
          submitting={false}
          tallerId="taller-1"
          values={baseValues}
          onValuesChange={vi.fn()}
        />
      </TenantTestProvider>
    );

    expect(screen.queryByText("¿Esta pago?")).not.toBeInTheDocument();
    expect(screen.queryByText("Total calculado")).not.toBeInTheDocument();
  });
});
