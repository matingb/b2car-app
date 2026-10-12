import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArregloFormFields, { type ArregloFormFieldsValues } from "./ArregloFormFields";
import { TenantTestProvider, mockHasPermission } from "@/tests/testUtils";
import { UserRole } from "@/lib/permissions";

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
        hasPermission={mockHasPermission(UserRole.Admin)}
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
        hasPermission={mockHasPermission(UserRole.Operativo)}
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

describe("ArregloFormFields switches", () => {
  const renderFields = (props: Partial<React.ComponentProps<typeof ArregloFormFields>> = {}) => {
    const onValuesChange = vi.fn();
    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
        <ArregloFormFields
          vehiculoId="veh-1"
          vehiculoOptions={[]}
          isEdit={false}
          showFacturable={true}
          showPreciosSinIva={true}
          submitting={false}
          tallerId="taller-1"
          values={baseValues}
          onValuesChange={onValuesChange}
          {...props}
        />
      </TenantTestProvider>
    );
    return { onValuesChange };
  };

  it("muestra facturable y precios sin IVA como switches con una descripción corta", () => {
    renderFields();

    expect(screen.getByRole("switch", { name: "Arreglo facturable" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Precios sin IVA" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Suma al saldo a facturar del cliente.")).toBeInTheDocument();
    expect(screen.getByText("Se agrega el IVA al total del arreglo.")).toBeInTheDocument();
  });

  it("al activar precios sin IVA marca que los precios no incluyen IVA", () => {
    const { onValuesChange } = renderFields();

    fireEvent.click(screen.getByRole("switch", { name: "Precios sin IVA" }));

    expect(onValuesChange).toHaveBeenCalledWith({ preciosIncluyenIva: false });
  });

  it("deshabilita precios sin IVA cuando hay un bloqueo", () => {
    renderFields({ preciosSinIvaBloqueo: "Necesitás permiso para editar precios." });

    expect(screen.getByRole("switch", { name: "Precios sin IVA" })).toBeDisabled();
  });

  it("indica que el total calculado incluye IVA cuando los precios son sin IVA", () => {
    renderFields({ values: { ...baseValues, preciosIncluyenIva: false } });

    expect(screen.getByText("Total calculado (IVA incluido)")).toBeInTheDocument();
  });
});
