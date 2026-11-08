import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Button from "./Button";

describe("Button", () => {
  it("renderiza el texto correctamente", () => {
    render(<Button text="Guardar" />);
    expect(screen.getByText("Guardar")).toBeInTheDocument();
  });

  it("renderiza el icono si se especifica", () => {
    render(<Button text="Guardar" icon={<span data-testid="test-icon">icon</span>} />);
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("ejecuta onClick al hacer click", () => {
    const handleClick = vi.fn();
    render(<Button text="Guardar" onClick={handleClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("no ejecuta onClick cuando está disabled", () => {
    const handleClick = vi.fn();
    render(<Button text="Guardar" onClick={handleClick} disabled />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("usa ariaLabel personalizado si se provee, o el texto por defecto", () => {
    const { rerender } = render(<Button text="Guardar" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Guardar");

    rerender(<Button text="Guardar" ariaLabel="Guardar cambios del formulario" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Guardar cambios del formulario");
  });

  it("permite hover y rerender sin advertencias de conflicto de background", () => {
    const consoleErrorSpy = vi.spyOn(console, "error");
    const { rerender } = render(<Button text="Probar" dataTestId="btn" />);

    const button = screen.getByTestId("btn");
    fireEvent.mouseEnter(button);
    rerender(<Button text="Probar actualizado" dataTestId="btn" />);
    fireEvent.mouseLeave(button);

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Updating a style property during rerender (backgroundColor)")
    );
    consoleErrorSpy.mockRestore();
  });
});

