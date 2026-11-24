import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DiscountInput from "./DiscountInput";

describe("DiscountInput", () => {
  it("renderiza en modo monto por defecto", () => {
    const onDescuentoChange = vi.fn();
    render(
      <DiscountInput
        subtotal={10000}
        descuento={2000}
        onDescuentoChange={onDescuentoChange}
        dataTestId="discount-input"
      />
    );

    const toggleBtn = screen.getByRole("button", { name: "$" });
    expect(toggleBtn).toBeDefined();

    const input = screen.getByLabelText("Descuento");
    expect((input as HTMLInputElement).value).toBe("2000");
  });

  it("permite alternar a modo porcentaje y calcula el monto correctamente", () => {
    const onDescuentoChange = vi.fn();
    render(
      <DiscountInput
        subtotal={10000}
        descuento={2000}
        onDescuentoChange={onDescuentoChange}
        dataTestId="discount-input"
      />
    );

    const toggleBtn = screen.getByRole("button", { name: "$" });
    fireEvent.click(toggleBtn);

    // Ahora el botón muestra '%' y el input tiene 20%
    expect(screen.getByRole("button", { name: "%" })).toBeDefined();
    const percentInput = screen.getByLabelText("Descuento porcentaje");
    expect((percentInput as HTMLInputElement).value).toBe("20");

    // Cambiar porcentaje a 15%
    fireEvent.change(percentInput, { target: { value: "15" } });
    expect(onDescuentoChange).toHaveBeenCalledWith(1500);
  });

  it("restringe el monto al subtotal", () => {
    const onDescuentoChange = vi.fn();
    render(
      <DiscountInput
        subtotal={10000}
        descuento={0}
        onDescuentoChange={onDescuentoChange}
      />
    );

    const input = screen.getByLabelText("Descuento");
    fireEvent.change(input, { target: { value: "15000" } });
    expect(onDescuentoChange).toHaveBeenCalledWith(10000);
  });
});
