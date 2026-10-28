import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateVehiculoModal from "./CreateVehiculoModal";
import { createCliente } from "@/tests/factories";
import { TipoCliente } from "@/model/types";

const mocks = vi.hoisted(() => ({
  searchClientes: vi.fn(),
  getClienteById: vi.fn(),
  createVehiculo: vi.fn(),
}));

const clientesIniciales = [createCliente({ id: "C-1", nombre: "Juan Inicial", dni_cuil: "11111111" })];
const empresaRemota = createCliente({
  id: "E-900",
  nombre: "Transportes Lejanos SA",
  tipo_cliente: TipoCliente.EMPRESA,
  cuit: "30-99999999-9",
});

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({
    clientes: clientesIniciales,
    loading: false,
    searchClientes: mocks.searchClientes,
    getClienteById: mocks.getClienteById,
  }),
}));

vi.mock("@/app/providers/VehiculosProvider", () => ({
  useVehiculos: () => ({
    create: mocks.createVehiculo,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe("CreateVehiculoModal", () => {
  beforeEach(() => {
    mocks.searchClientes.mockResolvedValue([]);
    mocks.getClienteById.mockResolvedValue(null);
    mocks.createVehiculo.mockResolvedValue("V-NEW");
  });

  it("crea el vehículo con un cliente encontrado en el servidor fuera de la carga inicial", async () => {
    mocks.searchClientes.mockResolvedValue([empresaRemota]);
    const onClose = vi.fn();
    render(<CreateVehiculoModal open onClose={onClose} />);

    const clienteInput = screen.getByPlaceholderText("Buscar cliente...");
    await userEvent.type(clienteInput, "30-9999");
    await userEvent.click(await screen.findByText("Transportes Lejanos SA"));

    expect(mocks.searchClientes).toHaveBeenCalledWith("30-9999", { tipo: undefined, limit: 25 });
    expect(clienteInput).toHaveValue("Transportes Lejanos SA");

    await userEvent.type(screen.getByPlaceholderText("AAA000 ~ AA000AA"), "AB123CD");
    await userEvent.type(screen.getByPlaceholderText("123"), "77");

    const submit = screen.getByTestId("modal-submit");
    await waitFor(() => expect(submit).not.toBeDisabled());
    await userEvent.click(submit);

    await waitFor(() =>
      expect(mocks.createVehiculo).toHaveBeenCalledWith(
        expect.objectContaining({ cliente_id: "E-900", patente: "AB123CD", nro_interno: "77" })
      )
    );
    expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ id: "V-NEW" }));
  });

  it("con cliente predefinido no muestra selector ni busca clientes", async () => {
    render(<CreateVehiculoModal open onClose={vi.fn()} clienteId="C-77" tipoCliente="particular" />);

    expect(screen.queryByPlaceholderText("Buscar cliente...")).not.toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("AAA000 ~ AA000AA"), "AAA000");
    const submit = screen.getByTestId("modal-submit");
    await waitFor(() => expect(submit).not.toBeDisabled());
    await userEvent.click(submit);

    await waitFor(() =>
      expect(mocks.createVehiculo).toHaveBeenCalledWith(
        expect.objectContaining({ cliente_id: "C-77", patente: "AAA000" })
      )
    );
    expect(mocks.searchClientes).not.toHaveBeenCalled();
  });
});
