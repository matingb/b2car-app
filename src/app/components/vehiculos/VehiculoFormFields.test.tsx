import React, { useState } from "react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VehiculoFormFields, { validateVehiculoForm, type VehiculoFormFieldsValue } from "./VehiculoFormFields";
import { createCliente, createVehiculoFormFieldsValue } from "@/tests/factories";
import { TipoCliente } from "@/model/types";

const mocks = vi.hoisted(() => ({
  searchClientes: vi.fn(),
  getClienteById: vi.fn(),
}));

const mockClientes = [createCliente({ id: "C-1", nombre: "Juan Inicial", dni_cuil: "11111111" })];
const empresaRemota = createCliente({
  id: "E-900",
  nombre: "Transportes Lejanos SA",
  tipo_cliente: TipoCliente.EMPRESA,
  cuit: "30-99999999-9",
});
const particularRemoto = createCliente({ id: "P-900", nombre: "Ana Remota", dni_cuil: "40111222" });

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({
    clientes: mockClientes,
    loading: false,
    searchClientes: mocks.searchClientes,
    getClienteById: mocks.getClienteById,
  }),
}));

function ControlledVehiculoFormFields({
  onChange,
  tipoCliente,
}: {
  onChange?: (patch: Partial<VehiculoFormFieldsValue>) => void;
  tipoCliente?: "particular" | "empresa";
}) {
  const [value, setValue] = useState(createVehiculoFormFieldsValue());
  return (
    <VehiculoFormFields
      value={value}
      onChange={(patch) => {
        setValue((prev) => ({ ...prev, ...patch }));
        onChange?.(patch);
      }}
      showClienteInput
      tipoCliente={tipoCliente}
    />
  );
}

describe("VehiculoFormFields", () => {
  beforeEach(() => {
    mocks.searchClientes.mockResolvedValue([]);
    mocks.getClienteById.mockResolvedValue(null);
  });

  it("muestra el input de cliente cuando showClienteInput=true", () => {
    const value = createVehiculoFormFieldsValue();

    render(<VehiculoFormFields value={value} onChange={() => {}} showClienteInput />);

    expect(screen.getByPlaceholderText("Buscar cliente...")).toBeInTheDocument();
  });

  it("no monta el selector de cliente ni busca clientes cuando showClienteInput=false", () => {
    render(<VehiculoFormFields value={createVehiculoFormFieldsValue()} onChange={() => {}} />);

    expect(screen.queryByPlaceholderText("Buscar cliente...")).not.toBeInTheDocument();
    expect(mocks.searchClientes).not.toHaveBeenCalled();
  });

  it("busca clientes en el servidor y selecciona uno fuera de la carga inicial", async () => {
    mocks.searchClientes.mockResolvedValue([particularRemoto]);
    const handleChange = vi.fn();
    render(<ControlledVehiculoFormFields onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Buscar cliente...");
    await userEvent.type(input, "ana@remota.com");
    await userEvent.click(await screen.findByText("Ana Remota"));

    expect(mocks.searchClientes).toHaveBeenCalledWith("ana@remota.com", { tipo: undefined, limit: 25 });
    expect(handleChange).toHaveBeenCalledWith({ cliente_id: "P-900" });
    expect(input).toHaveValue("Ana Remota");
    expect(screen.queryByText("Nro interno")).not.toBeInTheDocument();
  });

  it("muestra Nro interno al seleccionar una empresa remota y lo oculta al limpiar el cliente", async () => {
    mocks.searchClientes.mockResolvedValue([empresaRemota]);
    const handleChange = vi.fn();
    render(<ControlledVehiculoFormFields onChange={handleChange} />);

    await userEvent.type(screen.getByPlaceholderText("Buscar cliente..."), "Lejanos");
    await userEvent.click(await screen.findByText("Transportes Lejanos SA"));

    expect(screen.getByText("Nro interno")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("autocomplete-clear-button"));

    expect(handleChange).toHaveBeenLastCalledWith({ cliente_id: "" });
    expect(screen.queryByText("Nro interno")).not.toBeInTheDocument();
  });

  it("restringe la búsqueda al tipo de cliente indicado", async () => {
    render(<ControlledVehiculoFormFields tipoCliente="empresa" />);

    await userEvent.type(screen.getByPlaceholderText("Buscar cliente..."), "Lejanos");

    await vi.waitFor(() =>
      expect(mocks.searchClientes).toHaveBeenCalledWith("Lejanos", { tipo: "empresa", limit: 25 })
    );
  });

  it("convierte el número de chasis a mayúsculas al escribir", () => {
    const handleChange = vi.fn();
    const value = createVehiculoFormFieldsValue({ patente: "AAA000" });
    render(<VehiculoFormFields value={value} onChange={handleChange} />);

    const chasisInput = screen.getByTestId("numero-chasis-input");
    fireEvent.change(chasisInput, { target: { value: "abc123xyz" } });

    expect(handleChange).toHaveBeenCalledWith({ numero_chasis: "ABC123XYZ" });
  });

  it("normaliza el numero de motor al escribir", () => {
    const handleChange = vi.fn();
    const value = createVehiculoFormFieldsValue();
    render(
      <VehiculoFormFields
        value={value}
        onChange={handleChange}
      />
    );

    fireEvent.change(screen.getByTestId("color-input"), { target: { value: "Gris" } });
    fireEvent.change(screen.getByTestId("numero-motor-input"), { target: { value: "ab123" } });

    expect(handleChange).toHaveBeenNthCalledWith(1, { color: "Gris" });
    expect(handleChange).toHaveBeenNthCalledWith(2, { numero_motor: "AB123" });
  });

  [
    { patente: "", expected: false },
    { patente: "   ", expected: false },
    { patente: "AAA000", expected: true },
  ].forEach(({ patente, expected }) => {
    it(`Dada una patente ${JSON.stringify(patente)}, entonces es ${expected ? "válido" : "inválido"}`, () => {
      const values = { patente };

      const result = validateVehiculoForm(values, { requireCliente: false });

      expect(result).toBe(expected);
    });
  });

  [
    { cliente_id: "", requireCliente: false, expected: true },
    { cliente_id: "   ", requireCliente: false, expected: true },
    { cliente_id: undefined, requireCliente: false, expected: true },
    { cliente_id: "", requireCliente: true, expected: false },
    { cliente_id: "   ", requireCliente: true, expected: false },
    { cliente_id: undefined, requireCliente: true, expected: false },
    { cliente_id: "123", requireCliente: true, expected: true },
  ].forEach(({ cliente_id, requireCliente, expected }) => {
    it(
      `Dado cliente_id=${JSON.stringify(cliente_id)} y requireCliente=${requireCliente}, entonces es ${expected ? "válido" : "inválido"}`,
      () => {
        const values = { patente: "AAA000", cliente_id };

        const result = validateVehiculoForm(values, { requireCliente });

        expect(result).toBe(expected);
      }
    );
  });
});

