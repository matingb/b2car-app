import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import ClienteFormFields, { createEmptyClienteFormFieldsValue } from "./ClienteFormFields";
import { TipoCliente } from "@/model/types";

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
