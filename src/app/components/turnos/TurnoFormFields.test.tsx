import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TurnoFormFields, {
  CREATE_CLIENTE_VALUE,
  type TurnoFormFieldsContext,
  type TurnoFormFieldsModel,
  type TurnoFormFieldsPatch,
  type TurnoFormFieldsState,
} from "./TurnoFormFields";
import { createEmptyClienteFormFieldsValue } from "@/app/components/clientes/ClienteFormFields";
import { createCliente, createVehiculo } from "@/tests/factories";
import { TipoCliente } from "@/model/types";

const mocks = vi.hoisted(() => ({
  searchClientes: vi.fn(),
  getClienteById: vi.fn(),
}));

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({
    clientes: [],
    loading: false,
    searchClientes: mocks.searchClientes,
    getClienteById: mocks.getClienteById,
  }),
}));

const mockCategorias = [
  { id: "c1", nombre: "Chapa y pintura" },
  { id: "c2", nombre: "Frenos" },
];

vi.mock("@/app/providers/CategoriasArregloProvider", () => ({
  useCategoriasArreglo: () => ({
    categorias: mockCategorias,
    isLoading: false,
    loadCategorias: vi.fn(),
    createCategoria: vi.fn(),
    updateCategoria: vi.fn(),
    deleteCategoria: vi.fn(),
  }),
}));

describe("TurnoFormFields - Componente UI", () => {
  const model: TurnoFormFieldsModel = {
    state: {
      titulo: "Revisión técnica",
      clienteId: "",
      vehiculoId: "",
      fecha: "2026-09-09",
      hora: "09:00",
      duracion: 60,
      tipo: "Mecánica",
      descripcion: "",
      observaciones: "",
      clienteDraft: createEmptyClienteFormFieldsValue(),
      clienteInlineIsValid: false,
      vehiculoDraft: {
        cliente_id: "",
        patente: "",
        marca: "",
        modelo: "",
        fecha_patente: "",
        numero_chasis: "",
        nro_interno: "",
      },
      vehiculoInlineIsValid: false,
    },
    context: {
      clientes: [],
      vehiculos: [],
    },
  };

  it("renderiza la píldora de fecha y los dropdowns de hora desde y hasta en desktop", () => {
    render(<TurnoFormFields model={model} onChange={vi.fn()} />);

    expect(screen.getByText(/miércoles.*9.*septiembre/i)).toBeInTheDocument();
    expect(screen.getByTestId("turno-hora-desde")).toHaveTextContent("09:00");
    expect(screen.getByTestId("turno-hora-hasta")).toHaveTextContent("10:00");
    expect(screen.getByTestId("turno-hora-hasta")).not.toHaveTextContent("10:00 (1 h)");
    expect(screen.getByRole("checkbox", { name: "Todo el día" })).not.toBeChecked();
  });

  it("renderiza el formato mobile con fecha corta, toggle switch y fila de horarios Desde/Hasta", () => {
    render(<TurnoFormFields model={model} onChange={vi.fn()} />);

    // 1 fila de fecha mobile con formato corto "Mié, 9 Sep 2026"
    expect(screen.getAllByText(/mié,\s*9\s*sep/i).length).toBe(1);
    expect(screen.getByText("Desde:")).toBeInTheDocument();
    expect(screen.getByTestId("turno-hora-desde-mobile")).toHaveTextContent("9:00 am");
    expect(screen.getByText("Hasta:")).toBeInTheDocument();
    expect(screen.getByTestId("turno-hora-hasta-mobile")).toHaveTextContent("10:00 am");
    expect(screen.getByRole("switch", { name: "Todo el día" })).toHaveAttribute("aria-checked", "false");
  });

  it("cuando Todo el día está activo en mobile no muestra los dropdowns ni etiquetas de hora pero mantiene la fecha", () => {
    const allDayModel = {
      ...model,
      state: {
        ...model.state,
        hora: "06:00",
        duracion: 960,
      },
    };
    render(<TurnoFormFields model={allDayModel} onChange={vi.fn()} />);

    expect(screen.getAllByText(/mié,\s*9\s*sep/i).length).toBe(1);
    expect(screen.queryByText("Desde:")).not.toBeInTheDocument();
    expect(screen.queryByText("Hasta:")).not.toBeInTheDocument();
    expect(screen.queryByTestId("turno-hora-desde-mobile")).not.toBeInTheDocument();
    expect(screen.queryByTestId("turno-hora-hasta-mobile")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Todo el día" })).toHaveAttribute("aria-checked", "true");
  });

  it("al marcar Todo el día en desktop emite hora 06:00 y duración 960", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Todo el día" });
    await userEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      hora: "06:00",
      duracion: 960,
    });
  });

  it("al alternar el switch de Todo el día en mobile emite hora 06:00 y duración 960", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const toggle = screen.getByRole("switch", { name: "Todo el día" });
    await userEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith({
      hora: "06:00",
      duracion: 960,
    });
  });

  it("al cambiar la hora desde mediante el dropdown emite la nueva hora", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const triggerDesde = screen.getByTestId("turno-hora-desde");
    await userEvent.click(triggerDesde);

    const opcion1030 = screen.getByRole("option", { name: "10:30" });
    await userEvent.click(opcion1030);

    expect(onChange).toHaveBeenCalledWith({
      hora: "10:30",
    });
  });

  it("al cambiar la hora hasta mediante el dropdown calcula y emite la nueva duración", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const triggerHasta = screen.getByTestId("turno-hora-hasta");
    await userEvent.click(triggerHasta);

    const opcion1100 = screen.getByRole("option", { name: "11:00 (2 h)" });
    expect(opcion1100).toBeInTheDocument();
    await userEvent.click(opcion1100);

    // De 09:00 a 11:00 son 120 minutos
    expect(onChange).toHaveBeenCalledWith({
      duracion: 120,
    });
  });

  it("al hacer clic en la píldora de fecha abre el calendario y permite seleccionar una nueva fecha", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const pill = screen.getByText(/miércoles.*9.*septiembre/i);
    await userEvent.click(pill);

    expect(screen.getByRole("dialog", { name: "Selector de fecha" })).toBeInTheDocument();

    const dia15 = screen.getByRole("button", { name: "15 de Septiembre" });
    await userEvent.click(dia15);

    expect(onChange).toHaveBeenCalledWith({
      fecha: "2026-09-15",
    });
  });

  it("muestra las categorías de arreglos configuradas como opciones del tipo de servicio", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const tipoInput = screen.getByPlaceholderText("Ej: Mecánica");
    await userEvent.click(tipoInput);

    expect(screen.getByText("Chapa y pintura")).toBeInTheDocument();
    expect(screen.getByText("Frenos")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Chapa y pintura"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "Chapa y pintura",
      })
    );
  });
});

describe("TurnoFormFields - selector de clientes con búsqueda remota", () => {
  const clienteInicial = createCliente({ id: "C-1", nombre: "Juan Inicial", dni_cuil: "11111111" });
  const particularRemoto = createCliente({ id: "R-1", nombre: "Ana Remota", dni_cuil: "40111222" });
  const empresaRemota = createCliente({
    id: "E-1",
    nombre: "Remota SA",
    tipo_cliente: TipoCliente.EMPRESA,
    cuit: "30-99999999-9",
  });

  const vehiculoInicial = createVehiculo({
    id: "V-1",
    cliente_id: "C-1",
    nombre_cliente: "Juan Inicial",
    patente: "REW164",
    marca: "",
    modelo: "",
  });
  const vehiculoRemoto = createVehiculo({
    id: "V-9",
    cliente_id: "R-1",
    nombre_cliente: "Ana Remota",
    patente: "AB123CD",
    marca: "",
    modelo: "",
  });
  const otroVehiculoRemoto = createVehiculo({
    id: "V-10",
    cliente_id: "R-1",
    nombre_cliente: "Ana Remota",
    patente: "AC456EF",
    marca: "",
    modelo: "",
  });

  const baseState: TurnoFormFieldsState = {
    titulo: "",
    clienteId: "",
    vehiculoId: "",
    fecha: "2026-09-09",
    hora: "09:00",
    duracion: 60,
    tipo: "Mecánica",
    descripcion: "",
    observaciones: "",
    clienteDraft: createEmptyClienteFormFieldsValue(),
    clienteInlineIsValid: false,
    vehiculoDraft: {
      cliente_id: "",
      patente: "",
      marca: "",
      modelo: "",
      fecha_patente: "",
      numero_chasis: "",
      nro_interno: "",
    },
    vehiculoInlineIsValid: false,
  };

  function TurnoHarness({
    initialState = baseState,
    context,
    onChange,
    onValidityChange,
  }: {
    initialState?: TurnoFormFieldsState;
    context: TurnoFormFieldsContext;
    onChange?: (patch: TurnoFormFieldsPatch) => void;
    onValidityChange?: (isValid: boolean) => void;
  }) {
    const [state, setState] = useState(initialState);
    return (
      <TurnoFormFields
        model={{ state, context }}
        onValidityChange={onValidityChange}
        onChange={(patch) => {
          onChange?.(patch);
          setState((prev) => {
            const { clienteDraft, vehiculoDraft, ...rest } = patch;
            return {
              ...prev,
              ...rest,
              clienteDraft: { ...prev.clienteDraft, ...(clienteDraft ?? {}) },
              vehiculoDraft: { ...prev.vehiculoDraft, ...(vehiculoDraft ?? {}) },
            };
          });
        }}
      />
    );
  }

  beforeEach(() => {
    mocks.searchClientes.mockResolvedValue([]);
    mocks.getClienteById.mockResolvedValue(null);
  });

  it("selecciona un cliente remoto, sugiere el título y autoselecciona su único vehículo", async () => {
    mocks.searchClientes.mockResolvedValue([particularRemoto]);
    const context = { clientes: [clienteInicial], vehiculos: [vehiculoInicial, vehiculoRemoto] };
    const onChange = vi.fn();
    render(<TurnoHarness context={context} onChange={onChange} />);

    const clienteInput = screen.getByPlaceholderText("Buscar cliente");
    await userEvent.type(clienteInput, "40111");
    await userEvent.click(await screen.findByText("Ana Remota"));

    expect(mocks.searchClientes).toHaveBeenCalledWith("40111", { tipo: undefined, limit: 25 });
    expect(onChange).toHaveBeenCalledWith({
      clienteId: "R-1",
      vehiculoId: "V-9",
      titulo: "Mecánica - AB123CD - Ana Remota",
    });
    expect(clienteInput).toHaveValue("Ana Remota");
    expect(screen.getByPlaceholderText("Buscar o crear vehículo...")).toHaveValue("AB123CD");
    expect(mocks.getClienteById).not.toHaveBeenCalled();
  });

  it("al cambiar a un cliente remoto con varios vehículos limpia el vehículo del propietario anterior y filtra los suyos", async () => {
    mocks.searchClientes.mockResolvedValue([particularRemoto]);
    const context = {
      clientes: [clienteInicial],
      vehiculos: [vehiculoInicial, vehiculoRemoto, otroVehiculoRemoto],
    };
    const onChange = vi.fn();
    render(
      <TurnoHarness
        initialState={{ ...baseState, clienteId: "C-1", vehiculoId: "V-1", titulo: "Mecánica - REW164 - Juan Inicial" }}
        context={context}
        onChange={onChange}
      />
    );

    await userEvent.type(screen.getByPlaceholderText("Buscar cliente"), "Ana");
    await userEvent.click(await screen.findByText("Ana Remota"));

    expect(onChange).toHaveBeenCalledWith({
      clienteId: "R-1",
      vehiculoId: "",
      titulo: "Mecánica - Ana Remota",
    });

    await userEvent.click(screen.getByPlaceholderText("Buscar o crear vehículo..."));
    expect(screen.getByText("AB123CD")).toBeInTheDocument();
    expect(screen.getByText("AC456EF")).toBeInTheDocument();
    expect(screen.queryByText("REW164")).not.toBeInTheDocument();
  });

  it("resuelve por ID un cliente precargado fuera del listado sin emitir cambios ni pisar el título", async () => {
    mocks.getClienteById.mockResolvedValue(particularRemoto);
    const context = { clientes: [clienteInicial], vehiculos: [vehiculoInicial, vehiculoRemoto] };
    const onChange = vi.fn();
    render(
      <TurnoHarness
        initialState={{ ...baseState, clienteId: "R-1", vehiculoId: "V-9", titulo: "Turno guardado" }}
        context={context}
        onChange={onChange}
      />
    );

    await waitFor(() => expect(screen.getByPlaceholderText("Buscar cliente")).toHaveValue("Ana Remota"));
    expect(mocks.getClienteById).toHaveBeenCalledWith("R-1");
    expect(screen.getByPlaceholderText(/Ej: Service/i)).toHaveValue("Turno guardado");
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByPlaceholderText("Buscar o crear vehículo..."));
    expect(screen.queryByText("REW164")).not.toBeInTheDocument();
  });

  it("al elegir primero un vehículo cuyo dueño no está en el listado asigna y resuelve ese cliente", async () => {
    mocks.getClienteById.mockResolvedValue(particularRemoto);
    const context = { clientes: [clienteInicial], vehiculos: [vehiculoInicial, vehiculoRemoto] };
    const onChange = vi.fn();
    render(<TurnoHarness context={context} onChange={onChange} />);

    await userEvent.click(screen.getByPlaceholderText("Buscar o crear vehículo..."));
    await userEvent.click(screen.getByText("AB123CD"));

    expect(onChange).toHaveBeenCalledWith({
      vehiculoId: "V-9",
      clienteId: "R-1",
      titulo: "Mecánica - AB123CD - Ana Remota",
    });
    await waitFor(() => expect(screen.getByPlaceholderText("Buscar cliente")).toHaveValue("Ana Remota"));
  });

  it("una empresa remota sin vehículos permite crear el vehículo inline con Nro interno", async () => {
    mocks.searchClientes.mockResolvedValue([empresaRemota]);
    const context = { clientes: [clienteInicial], vehiculos: [vehiculoInicial] };
    render(<TurnoHarness context={context} />);

    await userEvent.type(screen.getByPlaceholderText("Buscar cliente"), "Remota");
    await userEvent.click(await screen.findByText("Remota SA"));

    await userEvent.click(screen.getByPlaceholderText("No hay vehículos registrados"));
    expect(screen.queryByText("REW164")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("+ Crear vehículo"));

    expect(screen.getByText("Nro interno")).toBeInTheDocument();
  });

  it("mantiene la opción + Crear cliente con los formularios inline de cliente y vehículo", async () => {
    const context = { clientes: [clienteInicial], vehiculos: [vehiculoInicial] };
    const onChange = vi.fn();
    render(<TurnoHarness context={context} onChange={onChange} />);

    await userEvent.click(screen.getByPlaceholderText("Buscar cliente"));
    await userEvent.click(screen.getByText("+ Crear cliente"));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clienteId: CREATE_CLIENTE_VALUE }));
    expect(screen.queryByPlaceholderText("Buscar o crear vehículo...")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("AAA000 ~ AA000AA")).toBeInTheDocument();
  });

  it("limpiar el cliente no lo vuelve obligatorio", async () => {
    mocks.searchClientes.mockResolvedValue([particularRemoto]);
    const context = { clientes: [clienteInicial], vehiculos: [] };
    const onValidityChange = vi.fn();
    const onChange = vi.fn();
    render(
      <TurnoHarness
        initialState={{ ...baseState, titulo: "Revisión" }}
        context={context}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />
    );

    await userEvent.type(screen.getByPlaceholderText("Buscar cliente"), "Ana");
    await userEvent.click(await screen.findByText("Ana Remota"));
    // El primer botón de limpiar corresponde al selector de cliente.
    await userEvent.click(screen.getAllByTestId("autocomplete-clear-button")[0]);

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ clienteId: "" }));
    expect(screen.getByPlaceholderText("Buscar cliente")).toHaveValue("");
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });
});
