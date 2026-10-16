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

vi.mock("@/app/providers/ArreglosProvider", () => ({
  useArreglos: () => ({ update: vi.fn(), loading: false }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
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

  it("muestra facturable y toggle de IVA como switches con una descripción corta", () => {
    renderFields();

    expect(screen.getByRole("switch", { name: "Arreglo facturable" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("toggle-iva")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Suma al saldo a facturar del cliente.")).toBeInTheDocument();
    expect(screen.getByText("Se agregará el 21% sobre el total ingresado en los detalles del arreglo.")).toBeInTheDocument();
  });

  it("al activar el toggle de IVA marca que los precios no incluyen IVA", () => {
    const { onValuesChange } = renderFields();

    fireEvent.click(screen.getByTestId("toggle-iva"));

    expect(onValuesChange).toHaveBeenCalledWith({ preciosIncluyenIva: false });
  });

  it("deshabilita el toggle de IVA cuando hay un bloqueo", () => {
    renderFields({ preciosSinIvaBloqueo: "Necesitás permiso para editar precios." });

    expect(screen.getByTestId("toggle-iva")).toBeDisabled();
  });

  it("indica que el total calculado incluye IVA cuando los precios son sin IVA", () => {
    renderFields({ values: { ...baseValues, preciosIncluyenIva: false } });

    expect(screen.getByText("Total calculado (IVA incluido)")).toBeInTheDocument();
  });
});

describe("ArregloFormFields selector de estado", () => {
  it("renderiza ArregloEstadoBadge y actualiza el estado al seleccionar una opción", () => {
    const onValuesChange = vi.fn();
    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
        <ArregloFormFields
          vehiculoId="veh-1"
          vehiculoOptions={[]}
          isEdit={false}
          showFacturable={true}
          submitting={false}
          tallerId="taller-1"
          values={baseValues}
          onValuesChange={onValuesChange}
        />
      </TenantTestProvider>
    );

    const estadoTrigger = screen.getByTestId("arreglo-estado-badge");
    expect(estadoTrigger).toBeInTheDocument();
    expect(screen.getByText("Sin iniciar")).toBeInTheDocument();

    fireEvent.click(estadoTrigger);

    const terminadoOption = screen.getByTestId("arreglo-estado-option-TERMINADO");
    fireEvent.click(terminadoOption);

    expect(onValuesChange).toHaveBeenCalledWith({ estado: "TERMINADO" });
  });

  it("si se selecciona PRESUPUESTO, resetea estaPago a false", () => {
    const onValuesChange = vi.fn();
    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
        <ArregloFormFields
          vehiculoId="veh-1"
          vehiculoOptions={[]}
          isEdit={false}
          showFacturable={true}
          submitting={false}
          tallerId="taller-1"
          values={{ ...baseValues, estaPago: true }}
          onValuesChange={onValuesChange}
        />
      </TenantTestProvider>
    );

    fireEvent.click(screen.getByTestId("arreglo-estado-badge"));
    fireEvent.click(screen.getByTestId("arreglo-estado-option-PRESUPUESTO"));

    expect(onValuesChange).toHaveBeenCalledWith({
      estado: "PRESUPUESTO",
      estaPago: false,
    });
  });

  it("en edición sin estado previo presupuesto, no muestra opción PRESUPUESTO", () => {
    render(
      <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
        <ArregloFormFields
          vehiculoId="veh-1"
          vehiculoOptions={[]}
          isEdit={true}
          persistedEstado="EN_PROGRESO"
          showFacturable={true}
          submitting={false}
          tallerId="taller-1"
          values={{ ...baseValues, estado: "EN_PROGRESO" }}
          onValuesChange={vi.fn()}
        />
      </TenantTestProvider>
    );

    fireEvent.click(screen.getByTestId("arreglo-estado-badge"));

    expect(screen.queryByTestId("arreglo-estado-option-PRESUPUESTO")).not.toBeInTheDocument();
  });
});
