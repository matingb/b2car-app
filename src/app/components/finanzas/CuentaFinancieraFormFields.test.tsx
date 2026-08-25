import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CuentaFinancieraFormFields, {
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
} from "./CuentaFinancieraFormFields";

describe("CuentaFinancieraFormFields", () => {
  it("valida correctamente el formulario", () => {
    expect(validateCuentaFinancieraForm({ nombre: "", tipo: "EFECTIVO" })).toBe(false);
    expect(validateCuentaFinancieraForm({ nombre: "   ", tipo: "EFECTIVO" })).toBe(false);
    expect(validateCuentaFinancieraForm({ nombre: "Caja", tipo: "EFECTIVO" })).toBe(true);
  });

  it("renderiza campos compactos y emite cambios", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onValidityChange = vi.fn();

    render(
      <CuentaFinancieraFormFields
        values={EMPTY_CUENTA_FINANCIERA_DRAFT}
        onChange={onChange}
        onValidityChange={onValidityChange}
        compact
      />
    );

    const inputNombre = screen.getByTestId("cuenta-financiera-nombre");
    await user.type(inputNombre, "Caja");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ nombre: "C" }));

    const dropdownTipo = screen.getByTestId("cuenta-financiera-tipo");
    await user.click(dropdownTipo);
    await user.click(screen.getByRole("option", { name: "Cuenta bancaria" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tipo: "CUENTA_BANCARIA" }));
  });
});
