import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RemitoTipoSelector from "./RemitoTipoSelector";

describe("RemitoTipoSelector", () => {
  it("no preselecciona ningún tipo y deja ambos habilitados aunque R no sea emitible", () => {
    const onChange = vi.fn();
    render(<RemitoTipoSelector value={null} onChange={onChange} />);

    const selector = screen.getByTestId("remito-tipo");
    expect(selector).toHaveTextContent("Seleccioná un tipo");
    fireEvent.click(selector);
    const opciones = screen.getAllByRole("option");
    expect(opciones).toHaveLength(2);
    for (const opcion of opciones) expect(opcion).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Remito R" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Número siguiente" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("informa la elección del usuario y no la cambia por su cuenta", () => {
    const onChange = vi.fn();
    const { rerender } = render(<RemitoTipoSelector value={null} onChange={onChange} />);

    fireEvent.click(screen.getByTestId("remito-tipo"));
    fireEvent.click(screen.getByTestId("remito-tipo-option-R"));
    expect(onChange).toHaveBeenCalledWith("R");

    rerender(<RemitoTipoSelector value="R" onChange={onChange} />);
    expect(screen.getByTestId("remito-tipo")).toHaveTextContent("Remito R");
    fireEvent.click(screen.getByTestId("remito-tipo"));
    expect(screen.getByRole("option", { name: /Remito R/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Remito X/ })).toHaveAttribute("aria-selected", "false");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
