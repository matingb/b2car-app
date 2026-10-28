import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReassignPropietarioModal from "./ReassignPropietarioModal";
import { createCliente } from "@/tests/factories";
import { TipoCliente } from "@/model/types";

const mocks = vi.hoisted(() => ({
  searchClientes: vi.fn(),
  getClienteById: vi.fn(),
  reassignOwner: vi.fn(),
}));

const clienteActual = createCliente({ id: "C-1", nombre: "Juan Actual", dni_cuil: "11111111" });
const clientesIniciales = [clienteActual];
const empresaRemota = createCliente({
  id: "E-900",
  nombre: "Remota SA",
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
    reassignOwner: mocks.reassignOwner,
  }),
}));

describe("ReassignPropietarioModal", () => {
  beforeEach(() => {
    mocks.searchClientes.mockResolvedValue([]);
    mocks.getClienteById.mockResolvedValue(null);
    mocks.reassignOwner.mockResolvedValue(undefined);
  });

  it("permite buscar en el servidor un cliente fuera de la carga inicial y lo envía como nuevo propietario", async () => {
    mocks.searchClientes.mockResolvedValue([empresaRemota]);
    const onClose = vi.fn();
    render(
      <ReassignPropietarioModal open vehiculoId="V-1" currentClienteId="C-1" onClose={onClose} />
    );

    expect(screen.getByDisplayValue("Juan Actual")).toBeDisabled();

    const input = screen.getByPlaceholderText("Seleccionar nuevo propietario...");
    await userEvent.type(input, "30-99");
    await userEvent.click(await screen.findByText("Remota SA"));

    expect(mocks.searchClientes).toHaveBeenCalledWith("30-99", { tipo: undefined, limit: 25 });
    expect(input).toHaveValue("Remota SA");

    const submit = screen.getByRole("button", { name: "Guardar" });
    await waitFor(() => expect(submit).not.toBeDisabled());
    await userEvent.click(submit);

    await waitFor(() => expect(mocks.reassignOwner).toHaveBeenCalledWith("V-1", "E-900"));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("no permite guardar si el nuevo propietario es el actual", async () => {
    mocks.searchClientes.mockResolvedValue([clienteActual]);
    render(
      <ReassignPropietarioModal open vehiculoId="V-1" currentClienteId="C-1" onClose={vi.fn()} />
    );

    await userEvent.type(screen.getByPlaceholderText("Seleccionar nuevo propietario..."), "Juan");
    await userEvent.click(await screen.findByText("Juan Actual"));

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(mocks.reassignOwner).not.toHaveBeenCalled();
  });

  it("al limpiar el nuevo propietario vuelve a deshabilitar Guardar", async () => {
    mocks.searchClientes.mockResolvedValue([empresaRemota]);
    render(
      <ReassignPropietarioModal open vehiculoId="V-1" currentClienteId="C-1" onClose={vi.fn()} />
    );

    const input = screen.getByPlaceholderText("Seleccionar nuevo propietario...");
    await userEvent.type(input, "Remota");
    await userEvent.click(await screen.findByText("Remota SA"));

    const submit = screen.getByRole("button", { name: "Guardar" });
    await waitFor(() => expect(submit).not.toBeDisabled());

    await userEvent.click(screen.getByTestId("autocomplete-clear-button"));

    expect(submit).toBeDisabled();
    expect(input).toHaveValue("");
  });
});
