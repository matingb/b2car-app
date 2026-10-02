import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ClienteFormFields, { createEmptyClienteFormFieldsValue } from "./ClienteFormFields";
import { TipoCliente } from "@/model/types";
import type { ArcaPadronLookupState } from "@/app/hooks/useArcaPadronLookup";

const mockLookup = vi.fn<() => ArcaPadronLookupState>(() => ({ status: "IDLE" }));

vi.mock("@/app/hooks/useArcaPadronLookup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/hooks/useArcaPadronLookup")>();
  return {
    ...actual,
    useArcaPadronLookup: () => mockLookup(),
  };
});

it("alinea la altura de los inputs y selectores del formulario de cliente", () => {
  const { container } = render(
    <ClienteFormFields
      value={createEmptyClienteFormFieldsValue(TipoCliente.PARTICULAR)}
      onChange={() => {}}
    />,
  );

  const controls = Array.from(container.querySelectorAll<HTMLInputElement>("input"));

  expect(controls).toHaveLength(8);
  expect(new Set(controls.map((control) => control.style.height))).toEqual(new Set(["43px"]));
});

it("muestra el campo de DNI como el primero del formulario para clientes particulares", () => {
  const { container } = render(
    <ClienteFormFields
      value={createEmptyClienteFormFieldsValue(TipoCliente.PARTICULAR)}
      onChange={() => {}}
    />,
  );

  const firstInput = container.querySelector<HTMLInputElement>("input");
  expect(firstInput).not.toBeNull();
  expect(firstInput?.placeholder).toBe("Ej: 12345678 o 20-12345678-6");
});

it("muestra el campo de CUIT como el primero del formulario para empresas", () => {
  const { container } = render(
    <ClienteFormFields
      value={createEmptyClienteFormFieldsValue(TipoCliente.EMPRESA)}
      onChange={() => {}}
    />,
  );

  const firstInput = container.querySelector<HTMLInputElement>("input");
  expect(firstInput).not.toBeNull();
  expect(firstInput?.placeholder).toBe("99-12345678-9");
});

it("muestra placeholder de carga y no muestra texto 'Consultando datos en ARCA...' durante LOADING", () => {
  mockLookup.mockReturnValueOnce({ status: "LOADING" });

  const { container } = render(
    <ClienteFormFields
      value={createEmptyClienteFormFieldsValue(TipoCliente.PARTICULAR)}
      onChange={() => {}}
      enableArcaPadronLookup
    />,
  );

  expect(screen.queryByText(/consultando datos en arca/i)).toBeNull();
  const nombreInput = container.querySelector<HTMLInputElement>("input[placeholder='Consultando en ARCA...']");
  expect(nombreInput).not.toBeNull();
  expect(nombreInput?.disabled).toBe(true);
});

it("muestra advertencia con estilo warning y mensaje para completar manualmente cuando no se encuentran datos", () => {
  mockLookup.mockReturnValueOnce({
    status: "NOT_FOUND",
    message: "No se encontraron datos en ARCA",
  });

  render(
    <ClienteFormFields
      value={createEmptyClienteFormFieldsValue(TipoCliente.PARTICULAR)}
      onChange={() => {}}
      enableArcaPadronLookup
    />,
  );

  expect(
    screen.getByText("No se encontraron datos en ARCA. Completá los datos manualmente."),
  ).toBeInTheDocument();
});


