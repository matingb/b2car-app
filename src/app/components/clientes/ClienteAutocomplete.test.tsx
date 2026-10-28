import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClienteAutocomplete, { CREATE_CLIENTE_VALUE } from "./ClienteAutocomplete";
import { Cliente, TipoCliente } from "@/model/types";

const mocks = vi.hoisted(() => ({
  searchClientes: vi.fn(),
  getClienteById: vi.fn(),
}));

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

const remoto: Cliente = {
  id: "r1",
  nombre: "Carlos Gomez",
  tipo_cliente: TipoCliente.PARTICULAR,
  dni_cuil: "40111222",
  email: "cg@mail.com",
  telefono: "",
  direccion: "",
};

const remoto2: Cliente = {
  id: "r2",
  nombre: "Beatriz Lopez",
  tipo_cliente: TipoCliente.PARTICULAR,
  dni_cuil: "40333444",
  email: "",
  telefono: "",
  direccion: "",
};

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({
    clientes: mockClientes,
    loading: false,
    searchClientes: mocks.searchClientes,
    getClienteById: mocks.getClienteById,
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function ControlledClienteAutocomplete({
  onChange,
  initialValue = "",
}: {
  onChange: (clienteId: string, cliente?: Cliente) => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ClienteAutocomplete
      value={value}
      onChange={(clienteId, cliente) => {
        setValue(clienteId);
        onChange(clienteId, cliente);
      }}
    />
  );
}

describe("ClienteAutocomplete", () => {
  beforeEach(() => {
    mocks.searchClientes.mockResolvedValue([]);
    mocks.getClienteById.mockResolvedValue(null);
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

  it("busca en el servidor con el término recortado, límite 25 y tipo, y muestra coincidencias por campos distintos de la etiqueta", async () => {
    mocks.searchClientes.mockResolvedValue([remoto]);
    render(<ClienteAutocomplete value="" onChange={vi.fn()} tipoCliente="particular" />);

    await userEvent.type(screen.getByPlaceholderText("Buscar o seleccionar cliente..."), " cg@mail ");

    expect(await screen.findByText("Carlos Gomez")).toBeInTheDocument();
    expect(mocks.searchClientes).toHaveBeenCalledTimes(1);
    expect(mocks.searchClientes).toHaveBeenCalledWith("cg@mail", { tipo: "particular", limit: 25 });
    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
  });

  it("conserva la etiqueta y el documento del cliente remoto seleccionado sin volver a resolverlo", async () => {
    mocks.searchClientes.mockResolvedValue([remoto]);
    const handleChange = vi.fn();
    render(<ControlledClienteAutocomplete onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Buscar o seleccionar cliente...");
    await userEvent.type(input, "carlos");
    await userEvent.click(await screen.findByText("Carlos Gomez"));

    expect(handleChange).toHaveBeenCalledWith("r1", remoto);
    expect(input).toHaveValue("Carlos Gomez");

    await userEvent.click(input);
    expect(screen.getByText("DNI: 40111222")).toBeInTheDocument();
    expect(mocks.getClienteById).not.toHaveBeenCalled();
  });

  it("al limpiar la selección emite id vacío y no conserva la etiqueta anterior", async () => {
    mocks.searchClientes.mockResolvedValue([remoto]);
    const handleChange = vi.fn();
    render(<ControlledClienteAutocomplete onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Buscar o seleccionar cliente...");
    await userEvent.type(input, "carlos");
    await userEvent.click(await screen.findByText("Carlos Gomez"));

    await userEvent.click(screen.getByTestId("autocomplete-clear-button"));

    expect(handleChange).toHaveBeenLastCalledWith("", undefined);
    expect(input).toHaveValue("");
  });

  it("descarta respuestas de búsquedas anteriores que llegan tarde", async () => {
    const primera = deferred<Cliente[]>();
    const segunda = deferred<Cliente[]>();
    mocks.searchClientes
      .mockReturnValueOnce(primera.promise)
      .mockReturnValueOnce(segunda.promise);
    render(<ClienteAutocomplete value="" onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Buscar o seleccionar cliente...");
    await userEvent.type(input, "car");
    await waitFor(() => expect(mocks.searchClientes).toHaveBeenCalledTimes(1));
    await userEvent.type(input, "los", { skipClick: true });
    await waitFor(() => expect(mocks.searchClientes).toHaveBeenCalledTimes(2));
    expect(mocks.searchClientes).toHaveBeenLastCalledWith("carlos", { tipo: undefined, limit: 25 });

    await act(async () => {
      segunda.resolve([remoto2]);
    });
    expect(await screen.findByText("Beatriz Lopez")).toBeInTheDocument();

    await act(async () => {
      primera.resolve([remoto]);
    });
    expect(screen.queryByText("Carlos Gomez")).not.toBeInTheDocument();
    expect(screen.getByText("Beatriz Lopez")).toBeInTheDocument();
  });

  it("no restaura resultados de una búsqueda pendiente después de cerrar la búsqueda", async () => {
    const pendiente = deferred<Cliente[]>();
    mocks.searchClientes.mockReturnValueOnce(pendiente.promise);
    render(<ClienteAutocomplete value="" onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Buscar o seleccionar cliente...");
    await userEvent.type(input, "carlos");
    await waitFor(() => expect(mocks.searchClientes).toHaveBeenCalledTimes(1));
    await userEvent.keyboard("{Escape}");

    await act(async () => {
      pendiente.resolve([remoto]);
    });

    await userEvent.click(input);
    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.queryByText("Carlos Gomez")).not.toBeInTheDocument();
  });

  it("descarta resultados pendientes cuando cambia el tipo de cliente", async () => {
    const pendiente = deferred<Cliente[]>();
    mocks.searchClientes.mockReturnValueOnce(pendiente.promise);
    const { rerender } = render(
      <ClienteAutocomplete value="" onChange={vi.fn()} tipoCliente="particular" />
    );

    await userEvent.type(screen.getByPlaceholderText("Buscar o seleccionar cliente..."), "carlos");
    await waitFor(() => expect(mocks.searchClientes).toHaveBeenCalledTimes(1));

    rerender(<ClienteAutocomplete value="" onChange={vi.fn()} tipoCliente="empresa" />);
    await act(async () => {
      pendiente.resolve([remoto]);
    });

    expect(screen.queryByText("Carlos Gomez")).not.toBeInTheDocument();
  });

  it("una resolución por ID tardía no reemplaza al cliente vigente", async () => {
    const tardia = deferred<Cliente | null>();
    mocks.getClienteById.mockImplementation((id: string) =>
      id === "r1" ? tardia.promise : Promise.resolve(id === "r2" ? remoto2 : null)
    );
    const { rerender } = render(<ClienteAutocomplete value="r1" onChange={vi.fn()} />);
    rerender(<ClienteAutocomplete value="r2" onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Buscar o seleccionar cliente...");
    await waitFor(() => expect(input).toHaveValue("Beatriz Lopez"));

    await act(async () => {
      tardia.resolve(remoto);
    });

    expect(input).toHaveValue("Beatriz Lopez");
  });

  it("resuelve por ID un valor fuera del listado y lo descarta si el valor se limpia externamente", async () => {
    mocks.getClienteById.mockResolvedValue(remoto);
    const { rerender } = render(<ClienteAutocomplete value="r1" onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Buscar o seleccionar cliente...");
    await waitFor(() => expect(input).toHaveValue("Carlos Gomez"));
    expect(mocks.getClienteById).toHaveBeenCalledWith("r1");

    rerender(<ClienteAutocomplete value="" onChange={vi.fn()} />);
    expect(input).toHaveValue("");

    await userEvent.click(input);
    expect(screen.queryByText("Carlos Gomez")).not.toBeInTheDocument();
  });
});
