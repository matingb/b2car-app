import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import VehiculoFormFields, { validateVehiculoForm } from "./VehiculoFormFields";
import { createVehiculoFormFieldsValue } from "@/tests/factories";

const mockClientes = vi.hoisted(() => ([]));

vi.mock("@/app/providers/ClientesProvider", () => ({
  useClientes: () => ({ clientes: mockClientes }),
}));

vi.mock("../ui/Autocomplete", () => ({
  __esModule: true,
  default: ({ placeholder, value }: { placeholder?: string; value?: string }) => (
    <input data-testid="autocomplete" placeholder={placeholder} value={value ?? ""} readOnly />
  ),
}));

describe("VehiculoFormFields", () => {
  it("muestra el input de cliente cuando showClienteInput=true", () => {
    const value = createVehiculoFormFieldsValue();

    render(<VehiculoFormFields value={value} onChange={() => {}} showClienteInput />);

    expect(screen.getByPlaceholderText("Buscar cliente...")).toBeInTheDocument();
  });

  it("convierte el número de chasis a mayúsculas al escribir", () => {
    const handleChange = vi.fn();
    const value = createVehiculoFormFieldsValue({ patente: "AAA000" });
    render(<VehiculoFormFields value={value} onChange={handleChange} />);

    const chasisInput = screen.getByTestId("numero-chasis-input");
    fireEvent.change(chasisInput, { target: { value: "abc123xyz" } });

    expect(handleChange).toHaveBeenCalledWith({ numero_chasis: "ABC123XYZ" });
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

