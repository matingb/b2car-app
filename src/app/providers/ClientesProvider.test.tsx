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
