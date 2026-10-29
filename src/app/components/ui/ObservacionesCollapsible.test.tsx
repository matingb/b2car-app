import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ObservacionesCollapsible from "./ObservacionesCollapsible";

describe("ObservacionesCollapsible", () => {
  it("renderiza el botón toggle con label por defecto y permite escribir observaciones", async () => {
    const onChange = vi.fn();
    render(
      <ObservacionesCollapsible
        value=""
        onChange={onChange}
      />
    );

    const toggle = screen.getByTestId("operaciones-observaciones-toggle");
    expect(toggle).toHaveTextContent("Observaciones adicionales");

    const textarea = screen.getByTestId("operaciones-stock-observaciones");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute(
      "placeholder",
      "Observaciones adicionales sobre la operación..."
    );

    await userEvent.type(textarea, "Nota de prueba");
    expect(onChange).toHaveBeenCalled();
  });

  it("permite personalizar label, placeholder, dataTestId y defaultOpen", async () => {
    const onChange = vi.fn();
    render(
      <ObservacionesCollapsible
        value="Texto previo"
        onChange={onChange}
        label="Comentarios del cliente"
        placeholder="Escriba comentarios aquí..."
        rows={4}
        dataTestId="custom-observaciones"
        toggleDataTestId="custom-toggle"
        defaultOpen
      />
    );

    const toggle = screen.getByTestId("custom-toggle");
    expect(toggle).toHaveTextContent("Comentarios del cliente");

    const textarea = screen.getByTestId("custom-observaciones");
    expect(textarea).toHaveValue("Texto previo");
    expect(textarea).toHaveAttribute("placeholder", "Escriba comentarios aquí...");
    expect(textarea).toHaveAttribute("rows", "4");
  });

  it("conmuta el estado de apertura al hacer clic en el botón toggle", async () => {
    const onChange = vi.fn();
    render(
      <ObservacionesCollapsible
        value=""
        onChange={onChange}
        toggleDataTestId="my-toggle"
      />
    );

    const toggle = screen.getByTestId("my-toggle");
    await userEvent.click(toggle);
    expect(screen.getByTestId("operaciones-stock-observaciones")).toBeInTheDocument();
  });
});
