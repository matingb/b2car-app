import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, render } from "@testing-library/react";
import ViewModeToggle from "./ViewModeToggle";

describe("ViewModeToggle", () => {
  it("renderiza ambos botones con el estado activo correcto", () => {
    const onChange = vi.fn();
    render(<ViewModeToggle value="table" onChange={onChange} />);

    const tableBtn = screen.getByTestId("view-toggle-table");
    const cardsBtn = screen.getByTestId("view-toggle-cards");

    expect(tableBtn).toHaveAttribute("aria-pressed", "true");
    expect(cardsBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("llama a onChange al hacer click en el botón inactivo", () => {
    const onChange = vi.fn();
    render(<ViewModeToggle value="table" onChange={onChange} />);

    const cardsBtn = screen.getByTestId("view-toggle-cards");
    fireEvent.click(cardsBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("cards");
  });
});
