import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TipoCliente, type Cliente } from "@/model/types";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  getParticularById: vi.fn(),
  getEmpresaById: vi.fn(),
}));

vi.mock("@/clients/clientes/clientesClient", () => ({
  clientesClient: { getAll: mocks.getAll },
}));

vi.mock("@/clients/clientes/particularClient", () => ({
  particularClient: {
    getById: mocks.getParticularById,
  },
}));

vi.mock("@/clients/clientes/empresaClient", () => ({
  empresaClient: {
    getById: mocks.getEmpresaById,
  },
}));

import { ClientesProvider, useClientes } from "./ClientesProvider";
import ClienteAutocomplete from "@/app/components/clientes/ClienteAutocomplete";
import userEvent from "@testing-library/user-event";

function TestProbe() {
  const { getClienteById } = useClientes();
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const load = async (id: string) => {
    setCliente(await getClienteById(id));
  };

  return (
    <div>
      <output data-testid="cliente-result">{JSON.stringify(cliente)}</output>
      <button type="button" onClick={() => void load("cliente-1")}>
        Cargar cliente
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <ClientesProvider>
      <TestProbe />
    </ClientesProvider>
  );
}

describe("ClientesProvider getClienteById", () => {
  beforeEach(() => {
    mocks.getAll.mockReset();
    mocks.getParticularById.mockReset();
    mocks.getEmpresaById.mockReset();
    mocks.getAll.mockResolvedValue({ data: [], error: null });
  });

  it("mapea un particular a Cliente incluyendo tipo_cliente", async () => {
    mocks.getParticularById.mockResolvedValue({
      data: {
        id: "cliente-1",
        nombre: "Ana",
        apellido: "Perez",
        telefono: "123",
        email: "ana@example.com",
        direccion: "Calle 1",
        vehiculos: [],
      },
      error: null,
    });

    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Cargar cliente" }));

    await waitFor(() => {
      const cliente = JSON.parse(screen.getByTestId("cliente-result").textContent || "null") as Cliente;
      expect(cliente).toMatchObject({
        id: "cliente-1",
        nombre: "Ana Perez",
        tipo_cliente: TipoCliente.PARTICULAR,
      });
    });
    expect(mocks.getEmpresaById).not.toHaveBeenCalled();
  });

  it("continua con empresa cuando el cliente no es particular", async () => {
    mocks.getParticularById.mockResolvedValue({ data: null, error: null });
    mocks.getEmpresaById.mockResolvedValue({
      data: {
        id: "cliente-1",
        nombre: "Taller SA",
        cuit: "30-12345678-9",
        telefono: "456",
        email: "empresa@example.com",
        direccion: "Calle 2",
        vehiculos: [],
      },
      error: null,
    });

    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Cargar cliente" }));

    await waitFor(() => {
      const cliente = JSON.parse(screen.getByTestId("cliente-result").textContent || "null") as Cliente;
      expect(cliente).toMatchObject({
        id: "cliente-1",
        tipo_cliente: TipoCliente.EMPRESA,
        nombre: "Taller SA",
        cuit: "30-12345678-9",
      });
    });
  });
});

describe("ClientesProvider searchClientes desde ClienteAutocomplete", () => {
  const clienteInicial: Cliente = {
    id: "C-1",
    nombre: "Juan Inicial",
    tipo_cliente: TipoCliente.PARTICULAR,
    telefono: "",
    email: "",
    direccion: "",
  };
  const empresaRemota: Cliente = {
    id: "E-900",
    nombre: "Remota SA",
    tipo_cliente: TipoCliente.EMPRESA,
    cuit: "30-99999999-9",
    telefono: "",
    email: "",
    direccion: "",
  };

  function ListadoProbe() {
    const { clientes } = useClientes();
    return <output data-testid="listado">{clientes.map((c) => c.id).join(",")}</output>;
  }

  beforeEach(() => {
    mocks.getAll.mockReset();
    mocks.getParticularById.mockReset();
    mocks.getEmpresaById.mockReset();
    mocks.getAll.mockImplementation(async (filters?: { search?: string }) =>
      filters?.search
        ? { data: [empresaRemota], page: { hasMore: false }, error: null }
        : { data: [clienteInicial], page: { hasMore: true }, error: null }
    );
  });

  it("consulta GET /api/clientes con search, tipo y límite acotado sin reemplazar el listado compartido", async () => {
    const handleChange = vi.fn();
    render(
      <ClientesProvider>
        <ListadoProbe />
        <ClienteAutocomplete value="" onChange={handleChange} tipoCliente="empresa" />
      </ClientesProvider>
    );

    await waitFor(() => expect(screen.getByTestId("listado")).toHaveTextContent("C-1"));
    expect(mocks.getAll).toHaveBeenCalledWith({ limit: 50 });

    await userEvent.type(screen.getByPlaceholderText("Buscar o seleccionar cliente..."), " 30-9999 ");
    await userEvent.click(await screen.findByText("Remota SA"));

    expect(mocks.getAll).toHaveBeenCalledWith({ search: "30-9999", tipo: "empresa", limit: 25 });
    expect(handleChange).toHaveBeenCalledWith("E-900", expect.objectContaining({ nombre: "Remota SA" }));
    expect(screen.getByTestId("listado")).toHaveTextContent(/^C-1$/);
    expect(mocks.getParticularById).not.toHaveBeenCalled();
    expect(mocks.getEmpresaById).not.toHaveBeenCalled();
  });
});
