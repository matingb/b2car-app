import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VehiculoFormFields, { validateVehiculoForm, type VehiculoFormFieldsValue } from "./VehiculoFormFields";

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
    const value: VehiculoFormFieldsValue = {
      cliente_id: "",
      patente: "",
      marca: "",
      modelo: "",
      fecha_patente: "",
      numero_chasis: "",
      nro_interno: "",
    };

    render(<VehiculoFormFields value={value} onChange={() => {}} showClienteInput />);

    expect(screen.getByPlaceholderText("Buscar cliente...")).toBeInTheDocument();
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

