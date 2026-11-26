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

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({
    clientes: [{ id: "c1", nombre: "Cliente Test", tipo_cliente: "particular" }],
    loading: false,
    searchClientes: vi.fn().mockResolvedValue([]),
    getClienteById: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("@/app/providers/VehiculosProvider", () => ({
  useVehiculos: () => ({
    vehiculos: [{ id: "veh-1", patente: "ABC123", marca: "Ford", modelo: "Fiesta", cliente_id: "c1" }],
    loading: false,
    searchVehiculos: vi.fn().mockResolvedValue([]),
    getVehiculoById: vi.fn().mockResolvedValue(null),
    fetchAll: vi.fn(),
  }),
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
  it("muestra ¿Esta pago? y Total para un rol admin", () => {
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
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("oculta ¿Esta pago? y Total para un rol operativo", () => {
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
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
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

  it("muestra Total sin la leyenda de IVA incluido cuando los precios son sin IVA", () => {
    renderFields({ values: { ...baseValues, preciosIncluyenIva: false } });

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.queryByText(/IVA incluido/i)).not.toBeInTheDocument();
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

  describe("buscador de vehículo", () => {
    it("muestra el buscador de vehículo cuando vehiculoId no está definido", () => {
      render(
        <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
          <ArregloFormFields
            isEdit={false}
            showFacturable={true}
            submitting={false}
            tallerId="taller-1"
            values={{ ...baseValues, selectedVehiculoId: "" }}
            onValuesChange={vi.fn()}
          />
        </TenantTestProvider>
      );

      expect(screen.getByTestId("arreglo-vehiculo-autocomplete")).toBeInTheDocument();
    });

    it("permite seleccionar vehículo desde el autocompletado", () => {
      const onValuesChange = vi.fn();
      render(
        <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
          <ArregloFormFields
            isEdit={false}
            showFacturable={true}
            submitting={false}
            tallerId="taller-1"
            values={{ ...baseValues, selectedVehiculoId: "" }}
            onValuesChange={onValuesChange}
          />
        </TenantTestProvider>
      );

      const vehiculoInput = screen.getByTestId("arreglo-vehiculo-autocomplete");
      fireEvent.click(vehiculoInput);
      fireEvent.click(screen.getByText(/ABC 123 - Ford Fiesta/));

      expect(onValuesChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedVehiculoId: "veh-1",
        })
      );
    });
  });

  describe("cálculo de total con descuentos", () => {
    it("actualiza el total calculado y muestra el desglose cuando se agrega un servicio con descuento", async () => {
      const onChange = vi.fn();
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
            onValuesChange={vi.fn()}
            onChange={onChange}
          />
        </TenantTestProvider>
      );

      // Abrir editor para agregar servicio
      const addServiceBtn = screen.getByRole("button", { name: /agregar mano de obra/i });
      fireEvent.click(addServiceBtn);

      // Completar campos del servicio
      const descInput = screen.getByLabelText("Descripción");
      fireEvent.change(descInput, { target: { value: "Cambio de pastillas" } });

      const priceInput = screen.getByLabelText("Precio venta");
      fireEvent.change(priceInput, { target: { value: "10000" } });

      const descMontoInput = screen.getByLabelText("Descuento");
      fireEvent.change(descMontoInput, { target: { value: "2000" } });

      // Confirmar agregar servicio
      const confirmBtn = screen.getByRole("button", { name: "agregar servicio" });
      fireEvent.click(confirmBtn);

      // Debe mostrar subtotal $10.000, descuento -$2.000 y total calculado $8.000 (tanto en la línea como en el total del modal)
      expect(screen.getByText(/Subtotal:\s*\$10\.000/)).toBeInTheDocument();
      expect(screen.getByText(/Descuento:\s*-\$2\.000/)).toBeInTheDocument();
      expect(screen.getAllByText("$8.000").length).toBeGreaterThanOrEqual(2);

      // Debe notificar al snapshot con el total con descuento
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          subtotalServicios: 8000,
          subtotal: 10000,
          descuento: 2000,
          totalCalculado: 8000,
          totalCalculadoLabel: "$8.000",
        })
      );
    });

    it("cuando precios no incluyen IVA (Sumar IVA), el desglose muestra subtotal y descuento sin IVA, línea extra de IVA y total calculado con IVA", async () => {
      const onChange = vi.fn();
      render(
        <TenantTestProvider hasPermission={mockHasPermission(UserRole.Admin)}>
          <ArregloFormFields
            vehiculoId="veh-1"
            vehiculoOptions={[]}
            isEdit={false}
            showFacturable={true}
            submitting={false}
            tallerId="taller-1"
            values={{ ...baseValues, preciosIncluyenIva: false }}
            onValuesChange={vi.fn()}
            onChange={onChange}
          />
        </TenantTestProvider>
      );

      // Agregar servicio de $50.000 con descuento de $5.000
      const addServiceBtn = screen.getByRole("button", { name: /agregar mano de obra/i });
      fireEvent.click(addServiceBtn);

      const descInput = screen.getByLabelText("Descripción");
      fireEvent.change(descInput, { target: { value: "Service general" } });

      const priceInput = screen.getByLabelText("Precio venta");
      fireEvent.change(priceInput, { target: { value: "50000" } });

      const descMontoInput = screen.getByLabelText("Descuento");
      fireEvent.change(descMontoInput, { target: { value: "5000" } });

      const confirmBtn = screen.getByRole("button", { name: "agregar servicio" });
      fireEvent.click(confirmBtn);

      // El subtotal y descuento NO deben tener IVA aplicado:
      // Subtotal: $50.000 (no $60.500)
      // Descuento: -$5.000 (no -$6.050)
      // IVA: $9.450 (21% sobre $45.000)
      // Total: $54.450
      expect(screen.getByText(/Subtotal:\s*\$50\.000/)).toBeInTheDocument();
      expect(screen.getByText(/Descuento:\s*-\$5\.000/)).toBeInTheDocument();
      expect(screen.getByText(/IVA:\s*\$9\.450/)).toBeInTheDocument();
      expect(screen.getByText("Total")).toBeInTheDocument();
      expect(screen.queryByText(/calculado/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/IVA incluido/i)).not.toBeInTheDocument();
      expect(screen.getByText("$54.450")).toBeInTheDocument();

      // Debe notificar al snapshot con los importes correctos
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          subtotalServicios: 45000,
          subtotal: 50000,
          descuento: 5000,
          totalCalculado: 54450,
          totalCalculadoLabel: "$54.450",
        })
      );
    });
  });
});
