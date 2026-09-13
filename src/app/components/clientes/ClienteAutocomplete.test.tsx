import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClienteAutocomplete, { CREATE_CLIENTE_VALUE } from "./ClienteAutocomplete";
import { Cliente, TipoCliente } from "@/model/types";

const mockParticular: Cliente = {
  id: "p1",
  nombre: "Juan Perez",
  tipo_cliente: TipoCliente.PARTICULAR,
  dni_cuil: "35123456",
  email: "juan@test.com",
  telefono: "11223344",
  direccion: "Calle 1",
};

const mockEmpresa: Cliente = {
  id: "e1",
  nombre: "Transportes SA",
  tipo_cliente: TipoCliente.EMPRESA,
  cuit: "30-11111111-1",
  email: "contacto@transportes.com",
  telefono: "55667788",
  direccion: "Av. Siempre Viva",
};

const mockClientes = [mockParticular, mockEmpresa];

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({
    clientes: mockClientes,
    loading: false,
    searchClientes: vi.fn().mockResolvedValue([]),
    getClienteById: vi.fn(),
  }),
}));

describe("ClienteAutocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el input de autocomplete con las opciones y secondaryLabel correcto (DNI para particular, CUIT para empresa)", () => {
    render(<ClienteAutocomplete value="" onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Buscar o seleccionar cliente...");
    expect(input).toBeInTheDocument();

    fireEvent.click(input);

    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("DNI: 35123456")).toBeInTheDocument();
    expect(screen.queryByText(/juan@test\.com/)).not.toBeInTheDocument();

    expect(screen.getByText("Transportes SA")).toBeInTheDocument();
    expect(screen.getByText("CUIT: 30-11111111-1")).toBeInTheDocument();
    expect(screen.queryByText(/contacto@transportes\.com/)).not.toBeInTheDocument();
  });

  it("llama a onChange con id y objeto de cliente al seleccionar una opción", () => {
    const handleChange = vi.fn();
    render(<ClienteAutocomplete value="" onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Buscar o seleccionar cliente...");
    fireEvent.click(input);

    fireEvent.click(screen.getByText("Juan Perez"));

    expect(handleChange).toHaveBeenCalledWith("p1", expect.objectContaining({ nombre: "Juan Perez" }));
  });

  it("muestra la opción de crear cliente si allowCreate es true y llama onCreateClick", () => {
    const handleCreateClick = vi.fn();
    const handleChange = vi.fn();
    render(
      <ClienteAutocomplete
        value=""
        onChange={handleChange}
        allowCreate
        onCreateClick={handleCreateClick}
      />
    );

    const input = screen.getByPlaceholderText("Buscar o seleccionar cliente...");
    fireEvent.click(input);

    const createOption = screen.getByText("+ Crear cliente");
    expect(createOption).toBeInTheDocument();

    fireEvent.click(createOption);
    expect(handleCreateClick).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(CREATE_CLIENTE_VALUE);
  });
});
