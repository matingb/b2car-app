import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import VehiculoAutocomplete from "./VehiculoAutocomplete";
import { createVehiculo } from "@/tests/factories";

const mocks = vi.hoisted(() => ({
  searchVehiculos: vi.fn(),
  getVehiculoById: vi.fn(),
}));

const vehiculo1 = createVehiculo({
  id: "v1",
  patente: "AB123CD",
  marca: "Ford",
  modelo: "Focus",
  cliente_id: "c1",
  nombre_cliente: "Juan Perez",
  nro_interno: "12",
});

const vehiculo2 = createVehiculo({
  id: "v2",
  patente: "XY789ZT",
  marca: "Toyota",
  modelo: "Corolla",
  cliente_id: "c2",
  nombre_cliente: "Maria Lopez",
  nro_interno: "",
});

vi.mock("@/app/providers/VehiculosProvider", () => ({
  useVehiculos: () => ({
    vehiculos: [vehiculo1, vehiculo2],
    loading: false,
    searchVehiculos: mocks.searchVehiculos,
    getVehiculoById: mocks.getVehiculoById,
  }),
}));

describe("VehiculoAutocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchVehiculos.mockResolvedValue([vehiculo1, vehiculo2]);
    mocks.getVehiculoById.mockResolvedValue(null);
  });

  it("renderiza con placeholder por defecto", () => {
    render(<VehiculoAutocomplete value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Buscar por patente, modelo, cliente...")).toBeInTheDocument();
  });

  it("renderiza con placeholder personalizado cuando hay clienteId", () => {
    render(<VehiculoAutocomplete value="" onChange={vi.fn()} clienteId="c1" />);
    expect(screen.getByPlaceholderText("Buscar vehículo del cliente...")).toBeInTheDocument();
  });

  it("filtra opciones por clienteId", async () => {
    render(
      <VehiculoAutocomplete
        value=""
        onChange={vi.fn()}
        clienteId="c1"
        vehiculos={[vehiculo1, vehiculo2]}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.click(input);

    expect(await screen.findByText(/AB 123 CD - Ford Focus/)).toBeInTheDocument();
    expect(screen.queryByText(/XY 789 ZT - Toyota Corolla/)).not.toBeInTheDocument();
  });

  it("muestra el nombre del cliente en la misma línea y no muestra el número de interno", async () => {
    render(
      <VehiculoAutocomplete
        value=""
        onChange={vi.fn()}
        vehiculos={[vehiculo1]}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.click(input);

    expect(await screen.findByText(/AB 123 CD - Ford Focus/)).toBeInTheDocument();
    expect(screen.getByText(/Juan Perez/)).toBeInTheDocument();
    expect(screen.queryByText(/Int:/)).not.toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
  });

  it("realiza búsqueda con debounce llamando al cliente", async () => {
    const handleChange = vi.fn();
    render(
      <VehiculoAutocomplete
        value=""
        onChange={handleChange}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Focus" } });

    await waitFor(() => {
      expect(mocks.searchVehiculos).toHaveBeenCalledWith("Focus", {
        clienteId: undefined,
        limit: 25,
      });
    });
  });

  it("llama a onChange con el id y el objeto del vehiculo seleccionado", async () => {
    const handleChange = vi.fn();
    render(
      <VehiculoAutocomplete
        value=""
        onChange={handleChange}
        vehiculos={[vehiculo1]}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.click(input);

    const option = await screen.findByText(/AB 123 CD - Ford Focus/);
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith("v1", vehiculo1);
  });

  it("resuelve el vehículo seleccionado por getById cuando no está en la lista inicial", async () => {
    mocks.getVehiculoById.mockResolvedValue(vehiculo1);

    render(
      <VehiculoAutocomplete
        value="v1"
        onChange={vi.fn()}
        vehiculos={[]}
      />
    );

    await waitFor(() => {
      expect(mocks.getVehiculoById).toHaveBeenCalledWith("v1");
    });
  });
});
